import { generateHmacSignature } from './hmacSignature';
import { sanitizeProductPayload, logAttributeValidation } from '../utils/encodingUtils';

const COUPANG_API_BASE = 'https://api-gateway.coupang.com';
const COUPANG_PROXY_URL = process.env.COUPANG_PROXY_URL;
const COUPANG_PROXY_SECRET = process.env.COUPANG_PROXY_SECRET;

// Retry configuration for transient failures
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2000; // 2 seconds, doubles each retry

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable (transient network issues)
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    error.name === 'AbortError' ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('socket') ||
    message.includes('network') ||
    message.includes('headers_timeout') ||
    message.includes('und_err')
  );
}

/**
 * Make a single proxy request attempt
 */
async function makeProxyRequest(
  proxyPayload: any,
  headers: Record<string, string>,
  timeoutMs: number = 60000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${COUPANG_PROXY_URL}/proxy`, {
      method: 'POST',
      headers,
      body: JSON.stringify(proxyPayload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Unified helper to call Coupang API
 * Routes request through Proxy if configured, otherwise calls directly.
 * Includes retry logic with exponential backoff for transient failures.
 */
async function callCoupangApi(
  method: string,
  path: string,
  query: string,
  accessKey: string,
  secretKey: string,
  body: any = null
): Promise<Response> {
  // Option 1: Use Proxy (checking if configured)
  if (COUPANG_PROXY_URL) {
    const proxyPayload = {
      method,
      path,
      query,
      body
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (COUPANG_PROXY_SECRET) {
      headers['x-proxy-secret'] = COUPANG_PROXY_SECRET;
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[API] Proxy request attempt ${attempt}/${MAX_RETRIES}: ${method} ${path}`);
        const response = await makeProxyRequest(proxyPayload, headers);

        // If we get a response (even error codes), return it - let caller handle
        return response;
      } catch (error) {
        lastError = error as Error;
        console.error(`[API] Proxy attempt ${attempt}/${MAX_RETRIES} failed:`, lastError.message);

        // Check if we should retry
        if (attempt < MAX_RETRIES && isRetryableError(lastError)) {
          const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1); // 2s, 4s, 8s
          console.log(`[API] Retrying in ${delay / 1000}s due to transient error...`);
          await sleep(delay);
          continue;
        }

        // Final attempt or non-retryable error - throw with helpful message
        if (lastError.name === 'AbortError') {
          throw new Error(`Proxy request timed out after ${MAX_RETRIES} attempts. The proxy server may be overloaded or unresponsive.`);
        }
        if (lastError.message.includes('HeadersTimeout') || lastError.message.includes('UND_ERR_HEADERS_TIMEOUT')) {
          throw new Error('Proxy server did not respond in time. Please check if the Oracle proxy is running.');
        }
        throw new Error(`Failed to connect to proxy after ${attempt} attempt(s): ${lastError.message}`);
      }
    }

    // Should not reach here, but just in case
    throw lastError || new Error('Proxy request failed for unknown reason');
  }

  // Option 2: Direct Call (Legacy/Local)
  else {
    const { authorization } = generateHmacSignature(method, path, query, secretKey, accessKey);
    const url = `${COUPANG_API_BASE}${path}${query ? '?' + query : ''}`;

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json;charset=UTF-8'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    return fetch(url, options);
  }
}


/**
 * Validate and clean barcode value
 * Coupang only accepts standard barcode formats:
 * - EAN-13 (13 digits)
 * - EAN-8 (8 digits)
 * - UPC-A (12 digits)
 * - JAN (8 or 13 digits)
 * - GTIN-14 (14 digits)
 * Amazon ASINs are NOT valid barcodes for Coupang!
 */
function cleanBarcode(barcode: string | undefined | null): string {
  if (!barcode || typeof barcode !== 'string') {
    return '';
  }

  const trimmed = barcode.trim();

  // If it's a URL (Amazon or otherwise), we cannot use it as barcode
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('amazon.')) {
    console.log(`[Barcode] URL detected, setting to empty (Coupang requires standard barcode formats): ${trimmed.substring(0, 50)}...`);
    return '';
  }

  // Validate barcode: must be numeric and proper length for standard formats
  // EAN-8: 8 digits, UPC-A: 12 digits, EAN-13/JAN: 13 digits, GTIN-14: 14 digits
  if (/^\d{8}$/.test(trimmed) || /^\d{12}$/.test(trimmed) || /^\d{13}$/.test(trimmed) || /^\d{14}$/.test(trimmed)) {
    console.log(`[Barcode] Valid standard barcode format: ${trimmed}`);
    return trimmed;
  }

  // Also accept shorter numeric codes (some products have 6-7 digit codes)
  if (/^\d{6,14}$/.test(trimmed)) {
    console.log(`[Barcode] Numeric barcode accepted: ${trimmed}`);
    return trimmed;
  }

  // Reject non-standard formats (including ASINs like B0FSL81J9S)
  console.log(`[Barcode] Invalid format rejected (not a standard numeric barcode): ${trimmed}`);
  return '';
}

export function extractDisplayCategoryCode(category: any): number {
  if (!category) return 0;
  const parts = String(category).split('>');
  const lastPart = parts[parts.length - 1].trim();
  const parsed = parseInt(lastPart, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchDisplayCategoryStatus(
  displayCategoryCode: number,
  accessKey: string,
  secretKey: string,
  cache: Map<number, boolean>
): Promise<boolean> {
  const cached = cache.get(displayCategoryCode);
  if (cached !== undefined) return cached;

  const method = 'GET';
  const path = `/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories/${displayCategoryCode}/status`;
  const query = '';

  /* Refactored to use callCoupangApi */
  const response = await callCoupangApi(method, path, query, accessKey, secretKey);


  const responseText = await response.text();

  if (response.status !== 200) {
    console.log('[CategoryStatus] Non-200 response:', response.status, responseText.slice(0, 500));
    cache.set(displayCategoryCode, false);
    return false;
  }

  try {
    const json = JSON.parse(responseText);
    const ok = json?.code === 'SUCCESS' && json?.data === true;
    cache.set(displayCategoryCode, ok);
    return ok;
  } catch {
    cache.set(displayCategoryCode, false);
    return false;
  }
}

export async function fetchCategoryRelatedMeta(
  displayCategoryCode: number,
  accessKey: string,
  secretKey: string,
  cache: Map<number, any>
): Promise<any> {
  const cached = cache.get(displayCategoryCode);
  if (cached) return cached;

  const method = 'GET';
  const path = `/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/${displayCategoryCode}`;
  const query = '';

  console.log('[CategoryMeta] Fetching metadata for displayCategoryCode:', displayCategoryCode);

  /* Refactored to use callCoupangApi */
  const response = await callCoupangApi(method, path, query, accessKey, secretKey);


  const responseText = await response.text();

  if (response.status !== 200) {
    console.log('[CategoryMeta] Non-200 response:', response.status, responseText.slice(0, 500));
    throw new Error(`Category metadata API returned ${response.status}`);
  }

  const json = JSON.parse(responseText);
  const meta = Array.isArray(json?.data) ? json.data[0] : json?.data;

  // Log detailed attribute information
  if (meta?.attributeTypeMetas) {
    const mandatory = meta.attributeTypeMetas.filter((a: any) => a.required === 'MANDATORY');
    console.log(`[CategoryMeta] Category ${displayCategoryCode} has ${mandatory.length} mandatory attributes:`);
    mandatory.forEach((attr: any) => {
      const hasValues = attr.attributeValueMetas?.length > 0;
      const valuesInfo = hasValues ? ` (${attr.attributeValueMetas.length} predefined values)` : ' (free text)';
      console.log(`  - ${attr.attributeTypeName} [group:${attr.groupNumber || 0}]${valuesInfo}`);
    });
  }

  cache.set(displayCategoryCode, meta);
  return meta;
}

// New: Fetch and return required attributes for a category (for preview/debugging)
export async function getCategoryRequiredAttributes(
  displayCategoryCode: number,
  accessKey: string,
  secretKey: string
): Promise<{ success: boolean; attributes?: any[]; message?: string; error?: string }> {
  try {
    const cache = new Map<number, any>();
    const meta = await fetchCategoryRelatedMeta(displayCategoryCode, accessKey, secretKey, cache);

    // If no meta returned at all, category might not exist
    if (!meta) {
      return {
        success: false,
        error: `Category ${displayCategoryCode} not found. Please verify the category code is correct.`
      };
    }

    // If category exists but has no attribute metadata, return success with empty list
    if (!meta.attributeTypeMetas || meta.attributeTypeMetas.length === 0) {
      console.log(`[CategoryMeta] Category ${displayCategoryCode} exists but has no attribute metadata`);
      return {
        success: true,
        attributes: [],
        message: 'This category has no specific attribute requirements.'
      };
    }

    const attributes = meta.attributeTypeMetas.map((attr: any) => ({
      name: attr.attributeTypeName,
      required: attr.required === 'MANDATORY',
      groupNumber: attr.groupNumber || 0,
      dataType: attr.dataType,
      usableUnits: attr.usableUnits || [],
      predefinedValues: (attr.attributeValueMetas || []).map((v: any) => v.attributeValueName)
    }));

    return { success: true, attributes };
  } catch (error: any) {
    // Provide more descriptive error messages
    const errorMsg = error.message || 'Unknown error';
    if (errorMsg.includes('404') || errorMsg.includes('not found')) {
      return { success: false, error: `Category ${displayCategoryCode} not found. Please check the category code.` };
    }
    if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('unauthorized')) {
      return { success: false, error: 'API authentication failed. Please verify your credentials.' };
    }
    return { success: false, error: `Failed to fetch category data: ${errorMsg}` };
  }
}

function getAutoNoticeContent(detailName: string, product: any, wingSettings: any): string {
  const normalized = String(detailName || '').replace(/\s+/g, '');

  const productName = String(product?.productName || '').trim();
  const modelNo = String(product?.modelNumber || product?.modelNo || '').trim();
  const manufacturer = String(product?.manufacturer || product?.brand || '').trim();
  const contact = String(wingSettings?.companyContactNumber || '').trim();
  const countryCode = String(wingSettings?.countryCode || 'KR').trim();

  if (normalized.includes('품명') || normalized.includes('모델명')) {
    return modelNo ? `${productName} (${modelNo})` : (productName || '상세페이지 참조');
  }

  if (normalized.includes('인증')) {
    return '해당없음';
  }

  if (normalized.includes('제조국') || normalized.includes('원산지')) {
    return countryCode && countryCode !== 'KR' ? '해외(상세페이지 참조)' : '대한민국';
  }

  if (normalized.includes('제조자') || normalized.includes('수입자')) {
    return manufacturer || '상세페이지 참조';
  }

  if (normalized.includes('전화번호') || normalized.includes('A/S') || normalized.includes('AS')) {
    return contact || '상세페이지 참조';
  }

  if (normalized.includes('출시')) {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  if (normalized.includes('크기') || normalized.includes('사이즈') || normalized.includes('용량') || normalized.includes('중량')) {
    return '상세페이지 참조';
  }

  if (normalized.includes('품질보증')) {
    return '관련 법령 및 소비자분쟁해결기준에 따름';
  }

  return '상세페이지 참조';
}

export function buildNoticesFromCategoryMeta(product: any, wingSettings: any, meta: any): any[] {
  const noticeCategories = meta?.noticeCategories;
  if (!Array.isArray(noticeCategories) || noticeCategories.length === 0) return [];

  const preferredName = String(product?.noticeCategory || '').trim();

  let chosen = preferredName
    ? noticeCategories.find((c: any) => String(c?.noticeCategoryName || '').trim() === preferredName)
    : undefined;

  if (!chosen) {
    chosen = noticeCategories
      .map((c: any) => {
        const details = Array.isArray(c?.noticeCategoryDetailNames) ? c.noticeCategoryDetailNames : [];
        const mandatoryCount = details.filter((d: any) => String(d?.required || '').toUpperCase() === 'MANDATORY').length;
        return { c, mandatoryCount };
      })
      .sort((a: any, b: any) => a.mandatoryCount - b.mandatoryCount)[0]?.c;
  }

  if (!chosen) return [];

  const details = Array.isArray(chosen?.noticeCategoryDetailNames) ? chosen.noticeCategoryDetailNames : [];
  const mandatoryDetails = details.filter((d: any) => String(d?.required || '').toUpperCase() === 'MANDATORY');

  const providedValues = Array.isArray(product?.noticeValues)
    ? product.noticeValues.map((v: any) => String(v).trim()).filter(Boolean)
    : [];

  let cursor = 0;

  return mandatoryDetails.map((d: any) => {
    const detailName = String(d?.noticeCategoryDetailName || '').trim();
    const provided = providedValues[cursor];
    const content = provided ? (cursor++, provided) : getAutoNoticeContent(detailName, product, wingSettings);

    return {
      noticeCategoryName: chosen.noticeCategoryName,
      noticeCategoryDetailName: detailName,
      content,
    };
  });
}

// Check if a value is invalid/placeholder (like "1", "0", empty, etc.)
function isInvalidAttributeValue(value: string | undefined | null): boolean {
  if (!value) return true;
  const trimmed = String(value).trim();
  if (trimmed === '') return true;
  // Check for placeholder values
  if (/^[0-9]+$/.test(trimmed)) return true; // Just numbers like "1", "123"
  if (trimmed.toLowerCase() === 'n/a') return true;
  if (trimmed.toLowerCase() === 'none') return true;
  if (trimmed === '-') return true;
  return false;
}

function extractCountFromText(text: string, patterns: string[]): string | null {
  // First try to match with L prefix (like L60, L180)
  const lMatch = text.match(/L\s*(\d+)\s*(?:tablet|capsule|정|캡슐|cap|tab)/i);
  if (lMatch) {
    return `${lMatch[1]}정`;
  }

  for (const pattern of patterns) {
    const regex = new RegExp(`(\\d+)\\s*${pattern}s?`, 'i');
    const match = text.match(regex);
    if (match) {
      return `${match[1]}정`;
    }
  }
  return null;
}

function extractWeightFromText(text: string): string | null {
  const patterns = [
    { regex: /(\d+(?:\.\d+)?)\s*kg/i, suffix: 'kg' },
    { regex: /(\d+(?:\.\d+)?)\s*gm/i, suffix: 'g' },  // Handle 'gm' before 'g'
    { regex: /(\d+(?:\.\d+)?)\s*gram/i, suffix: 'g' },
    { regex: /(\d+(?:\.\d+)?)\s*g(?!ram)/i, suffix: 'g' },
    { regex: /(\d+(?:\.\d+)?)\s*mg/i, suffix: 'mg' }
  ];

  for (const { regex, suffix } of patterns) {
    const match = text.match(regex);
    if (match) {
      return `${match[1]}${suffix}`;
    }
  }
  return null;
}

function extractVolumeFromText(text: string): string | null {
  const patterns = [
    { regex: /(\d+(?:\.\d+)?)\s*ml/i, suffix: 'ml' },
    { regex: /(\d+(?:\.\d+)?)\s*l(?:iter)?/i, suffix: 'L' },
    { regex: /(\d+(?:\.\d+)?)\s*oz/i, suffix: 'oz' }
  ];

  for (const { regex, suffix } of patterns) {
    const match = text.match(regex);
    if (match) {
      return `${match[1]}${suffix}`;
    }
  }
  return null;
}

function extractQuantityFromText(text: string): string | null {
  const patterns = [
    { regex: /(\d+)\s*(?:bag|pack|piece|ea|개|팩|box|set)s?/i, suffix: '개' }
  ];

  for (const { regex, suffix } of patterns) {
    const match = text.match(regex);
    if (match) {
      return `${match[1]}${suffix}`;
    }
  }
  return null;
}

// Normalize unit to match usableUnits list
function normalizeUnit(unit: string): string {
  const unitMap: { [key: string]: string } = {
    'g': 'g',
    'gram': 'g',
    'grams': 'g',
    'kg': 'kg',
    'kilogram': 'kg',
    'kilograms': 'kg',
    'mg': 'mg',
    'milligram': 'mg',
    'milligrams': 'mg',
    'ml': 'ml',
    'milliliter': 'ml',
    'milliliters': 'ml',
    'l': 'L',
    'liter': 'L',
    'liters': 'L',
    'oz': 'oz',
    'ounce': 'oz',
    'ounces': 'oz',
    '개': '개',
    'ea': '개',
    'pcs': '개',
    'piece': '개',
    'pieces': '개',
    '정': '정',
    'tablet': '정',
    'tablets': '정',
    'tab': '정',
    'tabs': '정',
    '캡슐': '캡슐',
    'capsule': '캡슐',
    'capsules': '캡슐',
    'cap': '캡슐',
    'caps': '캡슐',
    '팩': '팩',
    'pack': '팩',
    'packs': '팩',
    'bag': '봉',
    'bags': '봉',
    '봉': '봉'
  };
  return unitMap[unit.toLowerCase()] || unit;
}

// Validate and fix value to match usableUnits
function validateValueWithUnits(value: string, usableUnits: string[]): string | null {
  if (!value || !usableUnits || usableUnits.length === 0) return value;

  // Extract number and unit from value
  const match = value.match(/^([\d.]+)\s*(.*)$/);
  if (!match) return value;

  const [, number, unit] = match;
  if (!unit) {
    // No unit provided, try to add the first usable unit
    if (usableUnits.length > 0) {
      return `${number}${usableUnits[0]}`;
    }
    return value;
  }

  const normalizedUnit = normalizeUnit(unit);

  // Check if normalized unit is in usableUnits
  if (usableUnits.includes(normalizedUnit)) {
    return `${number}${normalizedUnit}`;
  }

  // Try to find a matching unit
  for (const usableUnit of usableUnits) {
    if (normalizedUnit === normalizeUnit(usableUnit)) {
      return `${number}${usableUnit}`;
    }
  }

  // Unit not found in usableUnits, use the first usable unit
  console.log(`[ValidateUnits] Unit "${unit}" not in usableUnits [${usableUnits.join(', ')}], using ${usableUnits[0]}`);
  return `${number}${usableUnits[0]}`;
}

// Check if value exists in predefined values list
function findMatchingPredefinedValue(value: string, predefinedValues: string[]): string | null {
  if (!predefinedValues || predefinedValues.length === 0) return null;

  const normalizedValue = value.toLowerCase().trim();

  // Exact match
  for (const predefined of predefinedValues) {
    if (predefined.toLowerCase().trim() === normalizedValue) {
      return predefined;
    }
  }

  // Partial match
  for (const predefined of predefinedValues) {
    if (predefined.toLowerCase().includes(normalizedValue) ||
      normalizedValue.includes(predefined.toLowerCase())) {
      return predefined;
    }
  }

  return null;
}

function selectBestAttributeFromGroup(groupAttrs: any[], product: any): any | null {
  const productName = (product.productName || '').toLowerCase();
  const description = (product.detailedDescription || product.description || '').toLowerCase();
  const searchKeywords = (product.searchKeywords || '').toLowerCase();

  // Include option values in the search text
  const optionValues = [
    product.optionValue1 || '',
    product.optionValue2 || '',
    product.optionValue3 || '',
    product.optionValue4 || ''
  ].join(' ').toLowerCase();

  const combined = `${productName} ${description} ${searchKeywords} ${optionValues}`;

  const priorityMap: { [key: string]: { patterns: string[]; extractor: (p: any, c: string) => string | null } } = {
    '개당 캡슐/정': {
      patterns: ['tablet', 'capsule', 'cap', '정', '캡슐', 'tabs', 'vcaps', 'softgel', 'pills', 'ct'],
      extractor: (p, c) => extractCountFromText(c, ['tablet', 'capsule', '정', '캡슐', 'cap', 'tabs', 'ct']) || '60정'
    },
    '개당 중량': {
      patterns: ['g', 'gram', 'kg', 'mg', 'gm', '그램', 'weight', '중량', 'oz', 'lb'],
      extractor: (p, c) => extractWeightFromText(c) || '100g'
    },
    '개당 용량': {
      patterns: ['ml', 'l', 'oz', 'liter', '리터', 'volume', '용량', 'fl oz'],
      extractor: (p, c) => extractVolumeFromText(c) || '100ml'
    },
    '최소 중량': {
      patterns: ['g', 'gram', 'kg', 'mg', 'gm', '그램', 'weight', '중량'],
      extractor: (p, c) => extractWeightFromText(c) || '100g'
    },
    '최소 용량': {
      patterns: ['ml', 'l', 'oz', 'liter', '리터', 'volume', '용량'],
      extractor: (p, c) => extractVolumeFromText(c) || '100ml'
    },
    '수량': {
      patterns: ['pack', 'bag', 'piece', 'ea', '개', '팩', 'set', 'box', 'count', 'ct', 'bags'],
      extractor: (p, c) => extractQuantityFromText(c) || '1개'
    },
    '개당 수량': {
      patterns: ['pack', 'bag', 'piece', 'ea', '개', '팩', 'set', 'box', 'per', 'bags'],
      extractor: (p, c) => extractQuantityFromText(c) || '1개'
    }
  };

  for (const attr of groupAttrs) {
    const typeName = attr.attributeTypeName || '';
    const usableUnits = attr.usableUnits || [];
    const predefinedValues = (attr.attributeValueMetas || []).map((v: any) => v.attributeValueName);
    const config = priorityMap[typeName];

    if (config) {
      const hasMatch = config.patterns.some(pattern => combined.includes(pattern));
      if (hasMatch) {
        let value = config.extractor(product, combined);

        // Validate against predefined values
        if (predefinedValues.length > 0) {
          const matched = findMatchingPredefinedValue(value || '', predefinedValues);
          value = matched || predefinedValues[0];
        }
        // Validate against usableUnits
        else if (value && usableUnits.length > 0) {
          value = validateValueWithUnits(value, usableUnits) || value;
        }

        return {
          attributeTypeName: typeName.substring(0, 25),
          attributeValueName: (value || '상세페이지 참조').substring(0, 30)
        };
      }
    }
  }

  const firstAttr = groupAttrs[0];
  if (firstAttr) {
    const typeName = firstAttr.attributeTypeName || '';
    const usableUnits = firstAttr.usableUnits || [];
    const predefinedValues = (firstAttr.attributeValueMetas || []).map((v: any) => v.attributeValueName);
    const config = priorityMap[typeName];
    let value = config ? config.extractor(product, combined) : '상세페이지 참조';

    // Validate against predefined values
    if (predefinedValues.length > 0) {
      const matched = findMatchingPredefinedValue(value || '', predefinedValues);
      value = matched || predefinedValues[0];
    }
    // Validate against usableUnits
    else if (value && usableUnits.length > 0) {
      value = validateValueWithUnits(value, usableUnits) || value;
    }

    return {
      attributeTypeName: typeName.substring(0, 25),
      attributeValueName: (value || '상세페이지 참조').substring(0, 30)
    };
  }

  return null;
}

function inferAttributeValue(attrMeta: any, product: any): string | null {
  const typeName = (attrMeta.attributeTypeName || '').toLowerCase();
  const productName = (product.productName || '').toLowerCase();
  const description = (product.detailedDescription || product.description || '').toLowerCase();
  const searchKeywords = (product.searchKeywords || '').toLowerCase();

  // Also include option values in the text to search
  const optionValues = [
    product.optionValue1 || '',
    product.optionValue2 || '',
    product.optionValue3 || '',
    product.optionValue4 || ''
  ].join(' ').toLowerCase();

  const combined = `${productName} ${description} ${searchKeywords} ${optionValues}`;

  // Get validation constraints
  const usableUnits = attrMeta.usableUnits || [];
  const predefinedValues = (attrMeta.attributeValueMetas || []).map((v: any) => v.attributeValueName);

  let extractedValue: string | null = null;

  // 수량 (quantity) - extract numeric count
  if (typeName.includes('수량') || typeName.includes('quantity')) {
    extractedValue = extractQuantityFromText(combined) || '1개';
  }
  // 개당 수량 (per unit count)
  else if (typeName.includes('개당 수량')) {
    const match = combined.match(/(\d+)\s*(bags?|packs?|pieces?|개|팩|ea)/i);
    extractedValue = match ? `${match[1]}개` : '1개';
  }
  // 용량/개당 용량/최소 용량 (volume)
  else if (typeName.includes('용량') || typeName.includes('volume')) {
    extractedValue = extractVolumeFromText(combined);
  }
  // 중량/개당 중량/최소 중량 (weight)
  else if (typeName.includes('중량') || typeName.includes('weight')) {
    extractedValue = extractWeightFromText(combined);
  }
  // 캡슐/정 (tablets/capsules)
  else if (typeName.includes('캡슐') || typeName.includes('정') || typeName.includes('tablet')) {
    extractedValue = extractCountFromText(combined, ['tablet', 'capsule', '정', '캡슐', 'ct', 'tabs']);
  }

  // Validate against predefined values first
  if (predefinedValues.length > 0) {
    if (extractedValue) {
      const matched = findMatchingPredefinedValue(extractedValue, predefinedValues);
      if (matched) {
        console.log(`[InferValue] Matched predefined value: ${matched}`);
        return matched;
      }
    }
    // Use first predefined value as fallback
    console.log(`[InferValue] Using first predefined value: ${predefinedValues[0]}`);
    return predefinedValues[0];
  }

  // Validate against usableUnits
  if (extractedValue && usableUnits.length > 0) {
    const validated = validateValueWithUnits(extractedValue, usableUnits);
    if (validated) {
      console.log(`[InferValue] Validated value: ${validated}`);
      return validated;
    }
  }

  // Return extracted value or fallback
  return extractedValue || '상세페이지 참조';
}

// English to Korean attribute name mapping for value extraction
const ENGLISH_ATTR_PATTERNS: { [key: string]: { koreanNames: string[]; valuePatterns: RegExp[] } } = {
  'size': {
    koreanNames: ['사이즈', '크기'],
    valuePatterns: [/(\d+)\s*(tablets?|capsules?|정|캡슐|ct)/i, /(\d+)\s*(g|kg|mg|ml|l)/i]
  },
  'weight': {
    koreanNames: ['중량', '개당 중량', '최소 중량'],
    valuePatterns: [/(\d+(?:\.\d+)?)\s*(g|kg|mg|oz|lb)/i]
  },
  'volume': {
    koreanNames: ['용량', '개당 용량', '최소 용량'],
    valuePatterns: [/(\d+(?:\.\d+)?)\s*(ml|l|oz|fl)/i]
  },
  'pack size': {
    koreanNames: ['개당 수량', '수량'],
    valuePatterns: [/(\d+)\s*(bags?|packs?|pieces?|개|팩|box|set)/i]
  },
  'quantity': {
    koreanNames: ['수량', '개당 수량'],
    valuePatterns: [/(\d+)\s*(개|ea|pcs?|pieces?)/i]
  },
  'tablets': {
    koreanNames: ['개당 캡슐/정'],
    valuePatterns: [/(\d+)\s*(tablets?|정)/i]
  },
  'capsules': {
    koreanNames: ['개당 캡슐/정'],
    valuePatterns: [/(\d+)\s*(capsules?|캡슐)/i]
  },
  'type': {
    koreanNames: ['종류', '형태'],
    valuePatterns: []
  },
};

// Extract a numeric value with unit from text based on patterns
function extractValueFromText(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

export function buildAttributesFromCategoryMeta(product: any, meta: any): any[] {
  const attributes: any[] = [];
  const usedAttrNames = new Set<string>();

  // Debug: Log the meta structure to understand what we're receiving
  console.log(`[Attributes] Meta keys: ${meta ? Object.keys(meta).join(', ') : 'null'}`);

  // Try different possible paths for attributeTypeMetas
  const attributeTypeMetas = meta?.attributeTypeMetas || meta?.data?.attributeTypeMetas || [];

  console.log(`[Attributes] Raw attributeTypeMetas count: ${attributeTypeMetas.length}`);
  if (attributeTypeMetas.length > 0) {
    console.log(`[Attributes] First attr sample: ${JSON.stringify(attributeTypeMetas[0]).substring(0, 200)}`);
  }

  const bundleGroups = new Map<number, any[]>();
  const mandatoryAttributes: any[] = [];

  // Collect valid attribute names from category metadata
  const validAttrNames = new Set<string>();
  for (const attrMeta of attributeTypeMetas) {
    validAttrNames.add(attrMeta.attributeTypeName?.toLowerCase() || '');
  }

  // Build combined text for extraction
  const productName = (product.productName || '').toLowerCase();
  const description = (product.detailedDescription || product.description || '').toLowerCase();
  const searchKeywords = (product.searchKeywords || '').toLowerCase();
  const combined = `${productName} ${description} ${searchKeywords}`;

  // Collect user-provided options - VALIDATE THEM FIRST
  const userProvidedOptions: Array<{ type: string; value: string }> = [];

  // Check each option pair and only add if BOTH are valid
  if (!isInvalidAttributeValue(product.optionType1) && !isInvalidAttributeValue(product.optionValue1)) {
    userProvidedOptions.push({ type: product.optionType1.trim(), value: product.optionValue1.trim() });
    console.log(`[Attributes] User option 1: ${product.optionType1} = ${product.optionValue1}`);
  } else if (product.optionType1 || product.optionValue1) {
    console.log(`[Attributes] Ignoring invalid option 1: type="${product.optionType1}", value="${product.optionValue1}"`);
  }

  if (!isInvalidAttributeValue(product.optionType2) && !isInvalidAttributeValue(product.optionValue2)) {
    userProvidedOptions.push({ type: product.optionType2.trim(), value: product.optionValue2.trim() });
    console.log(`[Attributes] User option 2: ${product.optionType2} = ${product.optionValue2}`);
  } else if (product.optionType2 || product.optionValue2) {
    console.log(`[Attributes] Ignoring invalid option 2: type="${product.optionType2}", value="${product.optionValue2}"`);
  }

  if (!isInvalidAttributeValue(product.optionType3) && !isInvalidAttributeValue(product.optionValue3)) {
    userProvidedOptions.push({ type: product.optionType3.trim(), value: product.optionValue3.trim() });
    console.log(`[Attributes] User option 3: ${product.optionType3} = ${product.optionValue3}`);
  } else if (product.optionType3 || product.optionValue3) {
    console.log(`[Attributes] Ignoring invalid option 3: type="${product.optionType3}", value="${product.optionValue3}"`);
  }

  if (!isInvalidAttributeValue(product.optionType4) && !isInvalidAttributeValue(product.optionValue4)) {
    userProvidedOptions.push({ type: product.optionType4.trim(), value: product.optionValue4.trim() });
    console.log(`[Attributes] User option 4: ${product.optionType4} = ${product.optionValue4}`);
  } else if (product.optionType4 || product.optionValue4) {
    console.log(`[Attributes] Ignoring invalid option 4: type="${product.optionType4}", value="${product.optionValue4}"`);
  }

  // Categorize attributes from metadata
  for (const attrMeta of attributeTypeMetas) {
    const required = attrMeta.required === 'MANDATORY';
    const groupNumber = attrMeta.groupNumber || 0;

    if (required) {
      if (groupNumber > 0) {
        if (!bundleGroups.has(groupNumber)) {
          bundleGroups.set(groupNumber, []);
        }
        bundleGroups.get(groupNumber)!.push(attrMeta);
      } else {
        mandatoryAttributes.push(attrMeta);
      }
    }
  }

  console.log(`[Attributes] Found ${mandatoryAttributes.length} mandatory attrs, ${bundleGroups.size} bundle groups`);
  console.log(`[Attributes] Valid attr names for category: ${Array.from(validAttrNames).slice(0, 10).join(', ')}...`);
  console.log(`[Attributes] Valid user-provided options: ${userProvidedOptions.length}`);

  // Try to use user-provided options for mandatory attributes first
  for (const userOption of userProvidedOptions) {
    // Find matching attribute in metadata
    const matchingAttr = attributeTypeMetas.find((meta: any) =>
      meta.attributeTypeName?.toLowerCase() === userOption.type.toLowerCase() ||
      meta.attributeTypeName?.includes(userOption.type) ||
      userOption.type.includes(meta.attributeTypeName || '')
    );

    if (matchingAttr && matchingAttr.required === 'MANDATORY') {
      const usableUnits = matchingAttr.usableUnits || [];
      const predefinedValues = (matchingAttr.attributeValueMetas || []).map((v: any) => v.attributeValueName);
      let finalValue = userOption.value;

      // Validate user-provided value
      if (predefinedValues.length > 0) {
        const matched = findMatchingPredefinedValue(finalValue, predefinedValues);
        finalValue = matched || predefinedValues[0];
        console.log(`[Attributes] User value validated against predefined: ${finalValue}`);
      } else if (usableUnits.length > 0) {
        finalValue = validateValueWithUnits(finalValue, usableUnits) || finalValue;
        console.log(`[Attributes] User value validated against units: ${finalValue}`);
      }

      attributes.push({
        attributeTypeName: matchingAttr.attributeTypeName.substring(0, 25),
        attributeValueName: finalValue.substring(0, 30)
      });
      usedAttrNames.add(matchingAttr.attributeTypeName.toLowerCase());
      console.log(`[Attributes] Used user-provided: ${matchingAttr.attributeTypeName}=${finalValue}`);
    }
  }

  // Process bundle groups - MUST select exactly one from each group
  for (const [groupNum, groupAttrs] of bundleGroups) {
    // Skip if already handled by user options
    const alreadyUsed = groupAttrs.some((attr: any) =>
      usedAttrNames.has(attr.attributeTypeName?.toLowerCase())
    );
    if (alreadyUsed) {
      console.log(`[Attributes] Bundle group ${groupNum}: already satisfied by user option`);
      continue;
    }

    // Try to find the best match based on product content
    const selectedAttr = selectBestAttributeFromGroup(groupAttrs, product);
    if (selectedAttr) {
      attributes.push(selectedAttr);
      usedAttrNames.add(selectedAttr.attributeTypeName.toLowerCase());
      console.log(`[Attributes] Bundle group ${groupNum}: selected ${selectedAttr.attributeTypeName}=${selectedAttr.attributeValueName}`);
    } else {
      // Fallback: use the first attribute in the group with inferred value
      const firstAttr = groupAttrs[0];
      if (firstAttr) {
        const value = inferAttributeValue(firstAttr, product) || '상세페이지 참조';
        attributes.push({
          attributeTypeName: firstAttr.attributeTypeName.substring(0, 25),
          attributeValueName: value.substring(0, 30)
        });
        usedAttrNames.add(firstAttr.attributeTypeName.toLowerCase());
        console.log(`[Attributes] Bundle group ${groupNum}: fallback ${firstAttr.attributeTypeName}=${value}`);
      }
    }
  }

  // Process standalone mandatory attributes
  for (const attrMeta of mandatoryAttributes) {
    const attrName = attrMeta.attributeTypeName;

    if (usedAttrNames.has(attrName?.toLowerCase())) {
      continue;
    }

    const value = inferAttributeValue(attrMeta, product) || '상세페이지 참조';
    attributes.push({
      attributeTypeName: attrName.substring(0, 25),
      attributeValueName: value.substring(0, 30)
    });
    usedAttrNames.add(attrName.toLowerCase());
    console.log(`[Attributes] Mandatory: ${attrName}=${value}`);
  }

  // MANDATORY ATTRIBUTES - Add required attributes with SMART defaults
  // Priority: Explicit CSV values > Extracted from name > Reasonable defaults (only for quantity)

  // 1. Ensure 수량 (quantity) exists - Safe to default to 1개
  const hasQuantity = attributes.some(a => a.attributeTypeName?.includes('수량'));
  if (!hasQuantity) {
    const explicitQty = product.quantity;
    const qtyValue = explicitQty || extractQuantityFromText(combined) || '1개';
    attributes.push({
      attributeTypeName: "수량",
      attributeValueName: qtyValue
    });
    console.log(`[Attributes] Added 수량=${qtyValue}${explicitQty ? ' (from CSV)' : ''}`);
  }

  // 2. Ensure EITHER 개당 용량 OR 개당 중량 exists
  const hasVolume = attributes.some(a => a.attributeTypeName?.includes('용량'));
  const hasWeight = attributes.some(a => a.attributeTypeName?.includes('중량'));

  if (!hasVolume && !hasWeight) {
    const explicitVolume = product.volume;
    const explicitWeight = product.weight;
    const extractedVolume = extractVolumeFromText(productName);

    if (explicitVolume) {
      // User provided volume in CSV - use it
      attributes.push({
        attributeTypeName: "개당 용량",
        attributeValueName: explicitVolume
      });
      console.log(`[Attributes] Added 개당 용량=${explicitVolume} (from CSV column)`);
    } else if (explicitWeight) {
      // User provided weight in CSV - use it
      attributes.push({
        attributeTypeName: "개당 중량",
        attributeValueName: explicitWeight
      });
      console.log(`[Attributes] Added 개당 중량=${explicitWeight} (from CSV column)`);
    } else if (extractedVolume) {
      // Found volume in product name - safe to extract
      attributes.push({
        attributeTypeName: "개당 용량",
        attributeValueName: extractedVolume
      });
      console.log(`[Attributes] Added 개당 용량=${extractedVolume} (auto-extracted from product name)`);
    } else {
      // NO DATA AVAILABLE - Log warning
      console.log(`[Attributes] WARNING: No volume/weight data found. Product name: "${productName}". User should add 'volume' or 'weight' column to CSV.`);
      // Last resort: Add a minimal default to prevent hard failure, but log it clearly
      attributes.push({
        attributeTypeName: "개당 중량",
        attributeValueName: "상세페이지 참조"
      });
      console.log(`[Attributes] Added fallback 개당 중량=상세페이지 참조 (USER SHOULD FIX THIS)`);
    }
  }

  console.log(`[Attributes] Final attributes count: ${attributes.length}`);
  return attributes;
}

export function transformProductToCoupangFormat(product: any, vendorId: string, wingSettings: any, notices?: any[], categoryMeta?: any): any {
  let categoryCode = 0;
  if (product.category) {
    const parts = product.category.toString().split('>');
    const lastPart = parts[parts.length - 1].trim();
    categoryCode = parseInt(lastPart) || 0;
  }

  const formatDate = (dateStr: string, isEnd: boolean = false): string => {
    if (!dateStr) {
      const now = new Date();
      if (isEnd) {
        return "2099-12-31T23:59:59";
      }
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`;
    }
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return isEnd ? "2099-12-31T23:59:59" : new Date().toISOString().split('T')[0] + "T00:00:00";
      }
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${isEnd ? '23:59:59' : '00:00:00'}`;
    } catch {
      return isEnd ? "2099-12-31T23:59:59" : new Date().toISOString().split('T')[0] + "T00:00:00";
    }
  };

  let attributes: any[];
  if (categoryMeta) {
    attributes = buildAttributesFromCategoryMeta(product, categoryMeta);
    console.log(`[Transform] Built ${attributes.length} attributes from category metadata`);
  } else {
    attributes = [];
    if (product.optionType1 && product.optionValue1) {
      attributes.push({
        attributeTypeName: product.optionType1.substring(0, 25),
        attributeValueName: product.optionValue1.substring(0, 30)
      });
    }
    if (product.optionType2 && product.optionValue2) {
      attributes.push({
        attributeTypeName: product.optionType2.substring(0, 25),
        attributeValueName: product.optionValue2.substring(0, 30)
      });
    }
    if (product.optionType3 && product.optionValue3) {
      attributes.push({
        attributeTypeName: product.optionType3.substring(0, 25),
        attributeValueName: product.optionValue3.substring(0, 30)
      });
    }
    if (product.optionType4 && product.optionValue4) {
      attributes.push({
        attributeTypeName: product.optionType4.substring(0, 25),
        attributeValueName: product.optionValue4.substring(0, 30)
      });
    }

    if (attributes.length === 0) {
      attributes.push({
        attributeTypeName: "수량",
        attributeValueName: "1개"
      });
    }
  }

  const images: any[] = [];
  if (product.mainImage) {
    images.push({
      imageOrder: 0,
      imageType: "REPRESENTATION",
      vendorPath: product.mainImage.trim()
    });
  }

  if (product.additionalImages && Array.isArray(product.additionalImages)) {
    product.additionalImages.slice(0, 9).forEach((img: string, idx: number) => {
      if (img && img.trim()) {
        images.push({
          imageOrder: idx + 1,
          imageType: "DETAIL",
          vendorPath: img.trim()
        });
      }
    });
  }

  const contents: any[] = [];
  if (product.detailedDescription && product.detailedDescription.trim()) {
    const isHtml = /<[^>]+>/.test(product.detailedDescription);
    const cleanContent = product.detailedDescription.trim();

    contents.push({
      contentsType: isHtml ? "HTML" : "TEXT",
      contentDetails: [{
        content: cleanContent,
        detailType: "TEXT"
      }]
    });
    console.log(`[Transform] Added content: ${cleanContent.substring(0, 100)}...`);
  } else {
    console.log(`[Transform] WARNING: No detailed description provided - validation should have caught this`);
  }

  const searchTags: string[] = [];
  if (product.searchKeywords) {
    const keywords = product.searchKeywords.split(',').map((k: string) => k.trim()).filter((k: string) => k);
    keywords.slice(0, 20).forEach((keyword: string) => {
      if (keyword.length <= 20) {
        searchTags.push(keyword);
      }
    });
  }

  const certifications: any[] = [];
  if (product.certInfoType1) {
    certifications.push({
      certificationType: product.certInfoType1,
      certificationCode: product.certInfoValue1 || ""
    });
  } else {
    certifications.push({
      certificationType: "NOT_REQUIRED",
      certificationCode: ""
    });
  }

  const isShippingFromOverseas = wingSettings.countryCode && wingSettings.countryCode !== 'KR';
  const isOverseasProduct = product.overseasPurchase || isShippingFromOverseas;

  console.log(`[Overseas Check] Country: ${wingSettings.countryCode}, Product overseas flag: ${product.overseasPurchase}, Final overseas: ${isOverseasProduct}`);

  // Clean and validate barcode - extracts ASIN from Amazon URLs or validates format
  const validBarcode = cleanBarcode(product.barcode);

  // Generate unique vendorItemId - MUST be a numeric Long value (not string!)
  // Use timestamp + random number to ensure uniqueness
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000);
  const vendorItemId = parseInt(`${timestamp}${randomSuffix}`);

  const item: any = {
    vendorItemId: vendorItemId,  // REQUIRED: Unique numeric identifier for this purchasable SKU
    itemName: (product.productName || "Product").substring(0, 150),
    originalPrice: Math.round(product.discountBasePrice || product.salePrice || 0),
    salePrice: Math.round(product.salePrice || 0),
    maximumBuyCount: Math.min(Math.round(product.stockQuantity || 100), 99999),
    maximumBuyForPerson: Math.round(product.maxPurchasePerPerson || 0),
    maximumBuyForPersonPeriod: Math.round(product.maxPurchasePeriod || 1) || 1,
    outboundShippingTimeDay: Math.round(product.leadTime || 1) || 1,
    unitCount: 1,
    adultOnly: product.adultOnly ? "ADULT_ONLY" : "EVERYONE",
    taxType: product.taxable === false ? "FREE" : "TAX",
    parallelImported: product.parallelImport ? "PARALLEL_IMPORTED" : "NOT_PARALLEL_IMPORTED",
    overseasPurchased: isOverseasProduct ? "OVERSEAS_PURCHASED" : "NOT_OVERSEAS_PURCHASED",
    pccNeeded: isOverseasProduct,
    externalVendorSku: product.vendorProductCode || `SKU-${vendorItemId}`,
    barcode: validBarcode,
    emptyBarcode: !validBarcode,
    emptyBarcodeReason: !validBarcode ? "상품확인불가_바코드없음사유" : "",
    modelNo: product.modelNumber || "",
    certifications: certifications,
    searchTags: searchTags,
    images: images,
    attributes: attributes,
    offerCondition: "NEW",
    offerDescription: ""
  };

  console.log(`[Transform] Created item with vendorItemId: ${vendorItemId}`);

  if (Array.isArray(notices) && notices.length > 0) {
    item.notices = notices;
  }

  const deliveryMethod = isOverseasProduct ? "AGENT_BUY" : "SEQUENCIAL";
  console.log(`[Delivery] Method: ${deliveryMethod}, Overseas: ${isOverseasProduct}`);

  let cleanBrand = (product.brand || "").trim();
  if (cleanBrand.includes("입력하세요") || cleanBrand.includes("예)") || cleanBrand.length > 100) {
    cleanBrand = cleanBrand.substring(0, 100);
  }

  const payload = {
    displayCategoryCode: categoryCode,
    sellerProductName: (product.productName || "").substring(0, 100),
    vendorId: vendorId,
    saleStartedAt: formatDate(product.saleStartDate, false),
    saleEndedAt: formatDate(product.saleEndDate, true),
    displayProductName: cleanBrand ? `${cleanBrand} ${product.productName}`.substring(0, 100) : (product.productName || "").substring(0, 100),
    brand: cleanBrand.substring(0, 100),
    generalProductName: (product.productName || "").substring(0, 100),
    productGroup: "",
    deliveryMethod: deliveryMethod,
    deliveryCompanyCode: (wingSettings.deliveryCompanyCode || "CJGLS"),
    deliveryChargeType: "FREE",
    deliveryCharge: 0,
    freeShipOverAmount: 0,
    deliveryChargeOnReturn: Math.round(wingSettings.deliveryChargeOnReturn || 2500),
    remoteAreaDeliverable: "N",
    unionDeliveryType: "NOT_UNION_DELIVERY",
    returnCenterCode: wingSettings.returnCenterCode || "",
    returnChargeName: wingSettings.returnChargeName || "",
    companyContactNumber: wingSettings.companyContactNumber || "",
    returnZipCode: wingSettings.returnZipCode || "",
    returnAddress: wingSettings.returnAddress || "",
    returnAddressDetail: wingSettings.returnAddressDetail || "",
    returnCharge: Math.round(wingSettings.returnCharge || 2500),
    outboundShippingPlaceCode: parseInt(wingSettings.outboundShippingPlaceCode) || 0,
    vendorUserId: wingSettings.vendorUserId || "",
    requested: true,
    items: [item],
    contents: contents,
    requiredDocuments: [],
    extraInfoMessage: "",
    manufacture: product.manufacturer || product.brand || "",
    bundleInfo: {
      bundleType: "SINGLE"
    }
  };

  return payload;
}

export function validateProductForUpload(product: any, wingSettings: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required basic fields
  if (!product.category) errors.push("Category is required");
  if (!product.productName || product.productName.trim().length < 3) errors.push("Product name is required (minimum 3 characters)");
  if (!product.salePrice || product.salePrice <= 0) errors.push("Sale price must be greater than 0");
  if (!product.discountBasePrice || product.discountBasePrice <= 0) errors.push("Discount base price must be greater than 0");
  if (!product.stockQuantity || product.stockQuantity <= 0) errors.push("Stock quantity must be greater than 0");
  if (!product.leadTime || product.leadTime < 1) errors.push("Lead time must be at least 1 day");
  if (!product.mainImage) errors.push("Main image URL is required");
  if (!product.brand || product.brand.trim().length < 2) errors.push("Brand is required (minimum 2 characters)");
  if (!product.manufacturer || product.manufacturer.trim().length < 2) errors.push("Manufacturer is required (minimum 2 characters)");

  // Detailed description - CRITICAL for product content
  if (!product.detailedDescription || product.detailedDescription.trim().length < 20) {
    errors.push("Detailed description is required (minimum 20 characters). Add product details, features, and usage information.");
  }

  // Image URL validation
  if (product.mainImage && !product.mainImage.startsWith('http')) {
    errors.push("Main image must be a valid URL starting with http:// or https://");
  }

  // Required attributes validation for common categories
  const productName = product.productName?.toLowerCase() || '';
  const hasVolumeInName = /\d+\s*(ml|l|밀리|리터)/i.test(productName);
  const hasWeightInName = /\d+\s*(g|kg|그램|킬로)/i.test(productName);

  // If no volume/weight in name and not provided explicitly, warn user
  if (!hasVolumeInName && !hasWeightInName && !product.volume && !product.weight) {
    errors.push("Volume or Weight is required. Add 'volume' column (e.g., 200ml) or 'weight' column (e.g., 100g) to your Excel, or include it in the product name.");
  }

  if (!wingSettings.returnCenterCode) errors.push("Return Center Code is required (from Wing settings)");
  if (!wingSettings.returnChargeName) errors.push("Return Location Name is required (from Wing settings)");
  if (!wingSettings.companyContactNumber) errors.push("Contact Number is required (from Wing settings)");
  if (!wingSettings.returnZipCode) errors.push("Return Postal Code is required (from Wing settings)");
  if (!wingSettings.returnAddress) errors.push("Return Address is required (from Wing settings)");
  if (!wingSettings.returnAddressDetail) errors.push("Return Address Detail is required (from Wing settings)");
  if (!wingSettings.outboundShippingPlaceCode) errors.push("Shipping Place Code is required (from Wing settings)");
  if (!wingSettings.deliveryCompanyCode) errors.push("Courier Code is required (from Wing settings)");
  if (!wingSettings.vendorUserId) errors.push("Wing Login ID is required (from Wing settings)");

  return { valid: errors.length === 0, errors };
}

export async function validateCredentials(accessKey: string, secretKey: string, vendorId: string): Promise<{ valid: boolean; message: string }> {
  const method = "GET";
  const path = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`;
  const query = `vendorId=${vendorId}&nextToken=&maxPerPage=1&status=APPROVED`;

  try {
    console.log('[Validate] Making API request...');
    /* Refactored to use callCoupangApi */
    const response = await callCoupangApi(method, path, query, accessKey, secretKey);


    console.log('[Validate] Response status:', response.status);
    const responseText = await response.text();
    console.log('[Validate] Response body:', responseText.slice(0, 500));

    if (response.status === 200) {
      return { valid: true, message: 'API credentials verified successfully!' };
    } else if (response.status === 401) {
      return { valid: false, message: 'Invalid API credentials. Please check your Access Key and Secret Key.' };
    } else if (response.status === 403) {
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.message && errorData.message.includes('ip address')) {
          const ipMatch = errorData.message.match(/(\d+\.\d+\.\d+\.\d+)/);
          const ip = ipMatch ? ipMatch[1] : 'unknown';
          return {
            valid: false,
            message: `IP not whitelisted. Please add IP "${ip}" to your Wing API settings.`
          };
        }
      } catch { }
      return { valid: false, message: 'Access forbidden. Please check your Vendor ID and API permissions.' };
    } else {
      return { valid: false, message: `API error (${response.status}): ${responseText.slice(0, 200)}` };
    }
  } catch (error: unknown) {
    console.error('[Validate] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, message: `Connection error: ${errorMessage}` };
  }
}

export async function uploadProduct(
  product: any,
  accessKey: string,
  secretKey: string,
  vendorId: string,
  wingSettings: any,
  notices?: any[],
  categoryMeta?: any
): Promise<{ success: boolean; productId?: string; error?: string; details?: any; payload?: any }> {
  const method = "POST";
  const path = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`;
  const query = "";

  try {
    const validation = validateProductForUpload(product, wingSettings);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
        details: { validationErrors: validation.errors }
      };
    }

    const rawPayload = transformProductToCoupangFormat(product, vendorId, wingSettings, notices, categoryMeta);

    // CRITICAL: Sanitize payload to fix encoding corruption and unit mapping
    // Converts "60 tablet" → "60정", "1ê°" → "1개", etc.
    const payload = sanitizeProductPayload(rawPayload);

    console.log('[Upload] Uploading product:', product.productName);
    console.log('[Upload] Sanitized Payload:', JSON.stringify(payload, null, 2).slice(0, 2000));

    // Log attributes for debugging with validation status
    if (payload.items && payload.items[0] && payload.items[0].attributes) {
      console.log('[Upload] Sanitized attributes being sent:', JSON.stringify(payload.items[0].attributes, null, 2));
      logAttributeValidation(payload.items[0].attributes, categoryMeta);
    }

    /* Refactored to use callCoupangApi */
    const response = await callCoupangApi(method, path, query, accessKey, secretKey, payload);


    const responseText = await response.text();
    console.log('[Upload] Response status:', response.status);
    console.log('[Upload] Response body:', responseText.slice(0, 1000));

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { rawResponse: responseText };
    }

    const isHttpSuccess = response.status === 200 || response.status === 201;
    const isCoupangSuccess = responseData.code === 'SUCCESS';

    if (isHttpSuccess && isCoupangSuccess) {
      return {
        success: true,
        productId: responseData.data?.sellerProductId || responseData.sellerProductId,
        details: responseData,
        payload: payload
      };
    } else {
      let errorMsg = `HTTP ${response.status}`;
      if (responseData.code === 'ERROR' && responseData.message) {
        errorMsg = responseData.message;
      } else if (responseData.message) {
        errorMsg = responseData.message;
      } else if (responseData.data?.message) {
        errorMsg = responseData.data.message;
      } else if (responseData.error) {
        errorMsg = responseData.error;
      }

      console.log('[Upload] Product rejected by Coupang:', errorMsg);

      return {
        success: false,
        error: errorMsg,
        details: responseData,
        payload: payload
      };
    }
  } catch (error: unknown) {
    console.error('[Upload] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      error: errorMessage
    };
  }
}

export async function batchUpload(
  products: any[],
  accessKey: string,
  secretKey: string,
  vendorId: string,
  wingSettings: any
): Promise<{ results: any[]; successCount: number; failedCount: number }> {
  const results: any[] = [];
  let successCount = 0;
  let failedCount = 0;

  const categoryMetaCache = new Map<number, any>();

  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    console.log(`[Batch] Processing product ${i + 1}/${products.length}: ${product.productName}`);

    let notices: any[] = [];
    let categoryMeta: any = null;
    try {
      const categoryCode = extractDisplayCategoryCode(product.category);
      if (categoryCode > 0) {
        categoryMeta = await fetchCategoryRelatedMeta(categoryCode, accessKey, secretKey, categoryMetaCache);
        notices = buildNoticesFromCategoryMeta(product, wingSettings, categoryMeta);
        console.log(`[Batch] Generated ${notices.length} notice(s) for product ${i + 1}`);
      }
    } catch (err) {
      console.error(`[Batch] Failed to fetch category meta for product ${i + 1}:`, err);
    }

    const result = await uploadProduct(product, accessKey, secretKey, vendorId, wingSettings, notices, categoryMeta);

    results.push({
      productIndex: i,
      productName: product.productName,
      ...result
    });

    if (result.success) {
      successCount++;
    } else {
      failedCount++;
    }

    if (i < products.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  return { results, successCount, failedCount };
}

export async function fetchShippingCenters(
  accessKey: string,
  secretKey: string,
  vendorId: string
): Promise<{ returnCenters: any[]; shippingPlaces: any[]; error?: string }> {
  const results: { returnCenters: any[]; shippingPlaces: any[]; error?: string } = {
    returnCenters: [],
    shippingPlaces: []
  };

  // Fetch return shipping centers
  try {
    const returnPath = `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/returnShippingCenters`;
    const returnQuery = `pageSize=50&pageNum=1`;
    console.log('[API] Fetching return centers from:', returnPath);
    /* Refactored to use callCoupangApi */
    const returnResponse = await callCoupangApi('GET', returnPath, returnQuery, accessKey, secretKey);


    const returnText = await returnResponse.text();
    console.log('[API] Return centers response:', returnResponse.status, returnText.slice(0, 500));

    if (returnResponse.status === 200) {
      const returnData = JSON.parse(returnText);
      const content =
        Array.isArray(returnData?.data)
          ? returnData.data
          : Array.isArray(returnData?.data?.content)
            ? returnData.data.content
            : Array.isArray(returnData?.content)
              ? returnData.content
              : [];

      if (Array.isArray(content)) {
        results.returnCenters = content.map((center: any) => ({
          code: center.returnCenterCode,
          name: center.shippingPlaceName || center.returnCenterName || 'Unknown',
          address: center.returnAddress || '',
          addressDetail: center.returnAddressDetail || '',
          zipCode: center.returnZipCode || '',
          contactNumber: center.companyContactNumber || ''
        }));
      }
    }
  } catch (err) {
    console.error('[API] Error fetching return centers:', err);
  }

  // Fetch outbound shipping places
  try {
    const shippingPath = `/v2/providers/marketplace_openapi/apis/api/v2/vendor/shipping-place/outbound`;
    const shippingQuery = `pageNum=1&pageSize=50`;
    console.log('[API] Fetching outbound shipping places from:', shippingPath);
    /* Refactored to use callCoupangApi */
    const shippingResponse = await callCoupangApi('GET', shippingPath, shippingQuery, accessKey, secretKey);


    const shippingText = await shippingResponse.text();
    console.log('[API] Shipping places response:', shippingResponse.status, shippingText.slice(0, 1000));

    if (shippingResponse.status === 200) {
      const shippingData = JSON.parse(shippingText);
      const content = shippingData.content || shippingData.data?.content || [];

      if (Array.isArray(content)) {
        results.shippingPlaces = content.map((place: any) => ({
          code: place.outboundShippingPlaceCode,
          name: place.shippingPlaceName || 'Unknown',
          address: place.placeAddresses?.[0]?.returnAddress || '',
          addressDetail: place.placeAddresses?.[0]?.returnAddressDetail || '',
          zipCode: place.placeAddresses?.[0]?.returnZipCode || '',
          contactNumber: place.placeAddresses?.[0]?.companyContactNumber || '',
          countryCode: place.placeAddresses?.[0]?.countryCode || 'KR',
          usable: place.usable
        }));
      }
    } else {
      results.error = `Shipping places API returned ${shippingResponse.status}: ${shippingText.slice(0, 200)}`;
    }
  } catch (err) {
    console.error('[API] Error fetching shipping places:', err);
    results.error = `Error fetching shipping places: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }

  return results;
}

export async function recommendCategory(
  accessKey: string,
  secretKey: string,
  productName: string,
  productDescription?: string,
  brand?: string,
  reqAttributes?: any
): Promise<{ success: boolean; categoryCode?: string; categoryName?: string; error?: string }> {
  const method = 'POST';
  const path = '/v2/providers/openapi/apis/api/v1/categorization/predict';
  const query = '';

  const requestBody: any = { productName };
  if (productDescription) requestBody.productDescription = productDescription;
  if (brand) requestBody.brand = brand;
  if (reqAttributes) requestBody.attributes = reqAttributes;

  console.log('[RecommendCategory] Request:', JSON.stringify(requestBody));

  /* Refactored to use callCoupangApi */
  const response = await callCoupangApi(method, path, query, accessKey, secretKey, requestBody);


  const responseText = await response.text();
  console.log('[RecommendCategory] Response:', response.status, responseText.slice(0, 500));

  if (response.status !== 200) {
    return { success: false, error: `Category recommendation failed: ${responseText.slice(0, 200)}` };
  }

  const data = JSON.parse(responseText);
  const result = data?.data;

  if (result?.autoCategorizationPredictionResultType === 'SUCCESS') {
    return {
      success: true,
      categoryCode: result.predictedCategoryId,
      categoryName: result.predictedCategoryName
    };
  } else {
    return {
      success: false,
      error: result?.comment || 'Could not determine category. Please provide more detailed product information.'
    };
  }
}

// ============================================
// REPRICING API FUNCTIONS
// ============================================

/**
 * Fetch product inventory details (including current price)
 * GET /v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/inventories
 */
export async function fetchVendorItemInventory(
  vendorItemId: string,
  accessKey: string,
  secretKey: string
): Promise<{
  success: boolean;
  price?: number;
  quantity?: number;
  status?: string;
  error?: string;
}> {
  const method = 'GET';
  const path = `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/${vendorItemId}/inventories`;
  const query = '';

  console.log('[FetchInventory] Fetching inventory for vendorItemId:', vendorItemId);

  try {
    /* Refactored to use callCoupangApi */
    const response = await callCoupangApi(method, path, query, accessKey, secretKey);


    const responseText = await response.text();
    console.log('[FetchInventory] Response:', response.status, responseText.slice(0, 500));

    if (response.status !== 200) {
      return {
        success: false,
        error: `Failed to fetch inventory: HTTP ${response.status} - ${responseText.slice(0, 200)}`
      };
    }

    const data = JSON.parse(responseText);

    // Parse Coupang response structure
    // Expected structure: { code: 'SUCCESS', data: { price: number, quantity: number, ... } }
    if (data?.code === 'SUCCESS' && data?.data) {
      const inventoryData = data.data;
      return {
        success: true,
        price: inventoryData.originalPrice || inventoryData.salePrice || inventoryData.price,
        quantity: inventoryData.quantity,
        status: inventoryData.status
      };
    } else {
      return {
        success: false,
        error: data?.message || 'Invalid response format from Coupang API'
      };
    }
  } catch (error) {
    console.error('[FetchInventory] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error fetching inventory'
    };
  }
}

/**
 * Update price for a vendor item
 * PUT /v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/prices/{price}
 */
export async function updateVendorItemPrice(
  vendorItemId: string,
  newPrice: number,
  accessKey: string,
  secretKey: string
): Promise<{
  success: boolean;
  updatedPrice?: number;
  error?: string;
}> {
  // Validate price is a positive integer
  if (!Number.isInteger(newPrice) || newPrice <= 0) {
    return {
      success: false,
      error: `Invalid price: ${newPrice}. Price must be a positive integer.`
    };
  }

  const method = 'PUT';
  const path = `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/${vendorItemId}/prices/${newPrice}`;
  const query = '';

  console.log('[UpdatePrice] Updating price for vendorItemId:', vendorItemId, 'New price:', newPrice);

  try {
    /* Refactored to use callCoupangApi */
    const response = await callCoupangApi(method, path, query, accessKey, secretKey);


    const responseText = await response.text();
    console.log('[UpdatePrice] Response:', response.status, responseText.slice(0, 500));

    if (response.status !== 200) {
      return {
        success: false,
        error: `Failed to update price: HTTP ${response.status} - ${responseText.slice(0, 200)}`
      };
    }

    const data = JSON.parse(responseText);

    if (data?.code === 'SUCCESS') {
      return {
        success: true,
        updatedPrice: newPrice
      };
    } else {
      return {
        success: false,
        error: data?.message || 'Price update failed'
      };
    }
  } catch (error) {
    console.error('[UpdatePrice] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error updating price'
    };
  }
}

/**
 * Fetch seller's product list with pagination
 * GET /v2/providers/seller_api/apis/api/v1/marketplace/seller-products
 * 
 * This can be used to resolve sellerProductId to vendorItemId
 */
export async function fetchSellerProducts(
  accessKey: string,
  secretKey: string,
  options?: {
    sellerProductId?: string;
    page?: number;
    size?: number;
  }
): Promise<{
  success: boolean;
  products?: Array<{
    sellerProductId: string;
    vendorItemId: string;
    itemId: string;
    productName: string;
    status?: string;
  }>;
  totalCount?: number;
  error?: string;
}> {
  const method = 'GET';
  const path = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products';

  // Build query string
  const params = new URLSearchParams();
  if (options?.sellerProductId) params.append('sellerProductId', options.sellerProductId);
  if (options?.page) params.append('page', options.page.toString());
  if (options?.size) params.append('size', options.size.toString());

  const query = params.toString() ? `?${params.toString()}` : '';

  console.log('[FetchSellerProducts] Query:', query || '(no filters)');

  try {
    /* Refactored to use callCoupangApi */
    const response = await callCoupangApi(method, path, query, accessKey, secretKey);


    const responseText = await response.text();
    console.log('[FetchSellerProducts] Response:', response.status, responseText.slice(0, 500));

    if (response.status !== 200) {
      return {
        success: false,
        error: `Failed to fetch products: HTTP ${response.status} - ${responseText.slice(0, 200)}`
      };
    }

    const data = JSON.parse(responseText);

    if (data?.code === 'SUCCESS' && data?.data) {
      const productList = Array.isArray(data.data.content) ? data.data.content : [];

      return {
        success: true,
        products: productList.map((p: any) => ({
          sellerProductId: p.sellerProductId,
          vendorItemId: p.vendorItemId,
          itemId: p.itemId,
          productName: p.productName || p.name,
          status: p.status
        })),
        totalCount: data.data.totalElements || productList.length
      };
    } else {
      return {
        success: false,
        error: data?.message || 'Invalid response format'
      };
    }
  } catch (error) {
    console.error('[FetchSellerProducts] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error fetching products'
    };
  }
}
