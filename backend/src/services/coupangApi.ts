import { generateHmacSignature } from './hmacSignature';
import { sanitizeProductPayload, logAttributeValidation } from '../utils/encodingUtils';

const COUPANG_API_BASE = 'https://api-gateway.coupang.com';

// Retry configuration for transient failures
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2000; // 2 seconds, doubles each retry
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds per request

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
 * Unified helper to call Coupang API directly.
 * Uses HMAC signature authentication.
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

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      console.log(`[API] Direct request attempt ${attempt}/${MAX_RETRIES}: ${method} ${path}`);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      // If we get a response (even error codes), return it - let caller handle
      return response;
    } catch (error) {
      lastError = error as Error;
      console.error(`[API] Attempt ${attempt}/${MAX_RETRIES} failed:`, lastError.message);

      // Check if we should retry
      if (attempt < MAX_RETRIES && isRetryableError(lastError)) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1); // 2s, 4s, 8s
        console.log(`[API] Retrying in ${delay / 1000}s due to transient error...`);
        await sleep(delay);
        continue;
      }

      // Final attempt or non-retryable error
      if (lastError.name === 'AbortError') {
        throw new Error(`Coupang API request timed out after ${MAX_RETRIES} attempts.`);
      }
      throw new Error(`Failed to call Coupang API after ${attempt} attempt(s): ${lastError.message}`);
    }
  }

  throw lastError || new Error('Coupang API request failed for unknown reason');
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
  const catStr = String(category).trim();

  // Format 1: "[56442] 뷰티>메이크업>..." — extract number from brackets
  const bracketMatch = catStr.match(/\[(\d+)\]/);
  if (bracketMatch) {
    return parseInt(bracketMatch[1], 10);
  }

  // Format 2: Pure number like "56442" or "16014270152"
  const parsed = parseInt(catStr, 10);
  if (Number.isFinite(parsed) && String(parsed) === catStr.replace(/\s/g, '')) {
    return parsed;
  }

  // Format 3: "뷰티 > 메이크업 > 56442" — last segment is number
  const parts = catStr.split('>');
  const lastPart = parts[parts.length - 1].trim();
  const lastParsed = parseInt(lastPart, 10);
  if (Number.isFinite(lastParsed)) {
    return lastParsed;
  }

  return 0;
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

// Check if a value is invalid/placeholder (like "0", empty, etc.)
// IMPORTANT: Only reject truly meaningless values, not legitimate option data
function isInvalidAttributeValue(value: string | undefined | null): boolean {
  if (!value) return true;
  const trimmed = String(value).trim();
  if (trimmed === '') return true;
  // Only reject single-digit placeholders "0" and "1" (common Excel defaults)
  // Do NOT reject larger numbers like "100", "2", "3" etc. as they may be legitimate
  if (trimmed === '0' || trimmed === '1') return true;
  if (trimmed.toLowerCase() === 'n/a') return true;
  if (trimmed.toLowerCase() === 'none') return true;
  if (trimmed === '-') return true;
  return false;
}

// English-to-Korean option type name translation map
const OPTION_TYPE_TRANSLATION: Record<string, string> = {
  'quantity': '수량',
  'qty': '수량',
  'weight': '개당 중량',
  'weight per unit': '개당 중량',
  'net weight': '개당 중량',
  'volume': '개당 용량',
  'capacity': '개당 용량',
  'volume per unit': '개당 용량',
  'size': '사이즈',
  'color': '색상',
  'colour': '색상',
  'type': '종류',
  'flavor': '맛',
  'flavour': '맛',
  'scent': '향',
  'pack size': '개당 수량',
  'count': '수량',
};

/**
 * Translate English option type names to Korean equivalents.
 * Returns the original value if no translation is found.
 */
function translateOptionTypeName(typeName: string): string {
  if (!typeName) return typeName;
  const lower = typeName.trim().toLowerCase();
  return OPTION_TYPE_TRANSLATION[lower] || typeName.trim();
}

/**
 * Normalize English option values to Coupang-compatible format.
 * Translates English unit words to Korean units and ensures number+unit format.
 * Examples: "1 pieces" → "1개", "100g" → "100g", "2 packs" → "2팩"
 */
function normalizeOptionValue(value: string, typeName?: string): string {
  if (!value) return value;
  let str = value.trim();

  // Unit word replacements (English → Korean/standard)
  const unitReplacements: [RegExp, string][] = [
    [/\bpieces?\b/gi, '개'],
    [/\bpcs?\b/gi, '개'],
    [/\bea\b/gi, '개'],
    [/\bunits?\b/gi, '개'],
    [/\bpacks?\b/gi, '팩'],
    [/\bsets?\b/gi, '세트'],
    [/\bboxe?s?\b/gi, '박스'],
    [/\bbags?\b/gi, '봉'],
    [/\btablets?\b/gi, '정'],
    [/\btabs?\b/gi, '정'],
    [/\bcapsules?\b/gi, '캡슐'],
    [/\bcaps?\b/gi, '캡슐'],
    [/\bgrams?\b/gi, 'g'],
    [/\bgm\b/gi, 'g'],
    [/\bkilograms?\b/gi, 'kg'],
    [/\bmilligrams?\b/gi, 'mg'],
    [/\bmilliliters?\b/gi, 'ml'],
    [/\bliters?\b/gi, 'L'],
    [/\bounces?\b/gi, 'oz'],
  ];

  for (const [pattern, replacement] of unitReplacements) {
    str = str.replace(pattern, replacement);
  }

  // Remove extra spaces between number and unit: "1 개" → "1개"
  str = str.replace(/(\d+)\s+([a-zA-Z가-힣]+)/, '$1$2');

  return str.trim();
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
    { regex: /(\d+(?:\.\d+)?)\s*kg(?![a-z])/i, suffix: 'kg' },
    { regex: /(\d+(?:\.\d+)?)\s*gm(?![a-z])/i, suffix: 'g' },  // Handle 'gm' before 'g'
    { regex: /(\d+(?:\.\d+)?)\s*grams?(?![a-z])/i, suffix: 'g' },
    // For 'g' unit: require it to NOT be followed by another letter and
    // the number must be a reasonable weight (>= 1g) to avoid matching
    // things like "0.35G" in product name decorations
    { regex: /(?:^|[\s,])((\d+(?:\.\d+)?))\s*g(?![a-z])/i, suffix: 'g', groupIndex: 1 },
    { regex: /(\d+(?:\.\d+)?)\s*mg(?![a-z])/i, suffix: 'mg' }
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      const numStr = match[(pattern as any).groupIndex || 1];
      const num = parseFloat(numStr);
      // Skip very small gram values like 0.35g that are likely not weights
      if (pattern.suffix === 'g' && num < 1) continue;
      return `${numStr}${pattern.suffix}`;
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
    'gm': 'g',
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

  // Get validation constraints from category metadata
  const usableUnits = attrMeta.usableUnits || [];
  const predefinedValues = (attrMeta.attributeValueMetas || []).map((v: any) => v.attributeValueName);

  console.log(`[InferValue] Attr: ${typeName}, usableUnits: [${usableUnits.join(', ')}], predefinedValues: ${predefinedValues.length}`);

  let extractedValue: string | null = null;

  // PRIORITY 0: Use explicit fields from frontend parser (volume, weight, quantity)
  // These come directly from XLSX headers like "[7823]개당 용량(필수)(기본 단위 : ml)"
  if (typeName.includes('수량') || typeName.includes('quantity')) {
    if (product.quantity) {
      extractedValue = product.quantity;
      console.log(`[InferValue] Using explicit quantity field: ${extractedValue}`);
    } else {
      extractedValue = extractQuantityFromText(combined);
      if (!extractedValue) {
        extractedValue = '1'; // Just the number, unit will be added from usableUnits
      }
    }
  }
  // 개당 수량 (per unit count)
  else if (typeName.includes('개당 수량')) {
    if (product.quantity) {
      extractedValue = product.quantity;
    } else {
      const match = combined.match(/(\d+)\s*(bags?|packs?|pieces?|개|팩|ea)/i);
      extractedValue = match ? match[1] : '1'; // Just the number
    }
  }
  // 용량/개당 용량/최소 용량 (volume)
  else if (typeName.includes('용량') || typeName.includes('volume')) {
    if (product.volume) {
      extractedValue = product.volume;
      console.log(`[InferValue] Using explicit volume field: ${extractedValue}`);
    } else {
      extractedValue = extractVolumeFromText(combined);
    }
  }
  // 중량/개당 중량/최소 중량 (weight)
  else if (typeName.includes('중량') || typeName.includes('weight')) {
    if (product.weight) {
      extractedValue = product.weight;
      console.log(`[InferValue] Using explicit weight field: ${extractedValue}`);
    } else {
      extractedValue = extractWeightFromText(combined);
    }
  }
  // 캡슐/정 (tablets/capsules)
  else if (typeName.includes('캡슐') || typeName.includes('정') || typeName.includes('tablet')) {
    extractedValue = extractCountFromText(combined, ['tablet', 'capsule', '정', '캡슐', 'ct', 'tabs']);
  }

  // PRIORITY 1: If there are predefined values, use them
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

  // PRIORITY 2: Validate against usableUnits - ALWAYS ensure valid unit
  if (usableUnits.length > 0) {
    if (extractedValue) {
      const validated = validateValueWithUnits(extractedValue, usableUnits);
      if (validated) {
        console.log(`[InferValue] Validated value: ${validated}`);
        return validated;
      }
    }
    // No extracted value, use first usable unit with default number
    const defaultValue = `1${usableUnits[0]}`;
    console.log(`[InferValue] No extraction, using default with first usable unit: ${defaultValue}`);
    return defaultValue;
  }

  // PRIORITY 3: Return extracted value if we have it (no constraints)
  if (extractedValue) {
    console.log(`[InferValue] Using extracted value (no constraints): ${extractedValue}`);
    return extractedValue;
  }

  // FALLBACK: Only when no metadata constraints exist
  console.log(`[InferValue] No constraints and no extraction, using fallback text`);
  return '상세페이지 참조';
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

// Helper to ensure a unit is present for attributes
function ensureUnit(value: any, defaultUnit: string): string {
  if (!value) return '';
  let str = String(value).trim();

  // Normalize common bad units BEFORE regex check
  if (defaultUnit === 'g') {
    str = str.replace(/gm$/i, 'g').replace(/grams?$/i, 'g');
  } else if (defaultUnit === 'ml') {
    str = str.replace(/milliliters?$/i, 'ml');
  } else if (defaultUnit === '개') {
    str = str.replace(/ea$/i, '개').replace(/pieces?$/i, '개');
  }

  // Remove spaces before units (e.g., "100 g" -> "100g")
  str = str.replace(/\s+([a-zA-Z가-힣]+)$/, '$1');

  // If it's just a number or number with decimal, append the default unit
  if (/^[\d.]+$/.test(str)) {
    return `${str}${defaultUnit}`;
  }
  return str;
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
  // Filter out option types that overlap with mandatory attributes (수량, 개당 용량, 개당 중량)
  // Those are handled by dedicated quantity/volume/weight columns with proper validation
  const MANDATORY_OVERLAP_NAMES = new Set(['수량', '개당 용량', '개당 중량', '용량', '중량']);
  const userProvidedOptions: Array<{ type: string; value: string }> = [];

  const optionSlots = [
    { type: product.optionType1, value: product.optionValue1, num: 1 },
    { type: product.optionType2, value: product.optionValue2, num: 2 },
    { type: product.optionType3, value: product.optionValue3, num: 3 },
    { type: product.optionType4, value: product.optionValue4, num: 4 },
  ];

  for (const slot of optionSlots) {
    if (!isInvalidAttributeValue(slot.type) && !isInvalidAttributeValue(slot.value)) {
      const translatedType = translateOptionTypeName(slot.type);
      // Skip if this option type overlaps with mandatory attributes
      if (MANDATORY_OVERLAP_NAMES.has(translatedType.toLowerCase()) || MANDATORY_OVERLAP_NAMES.has(slot.type.toLowerCase())) {
        console.log(`[Attributes] Skipping option ${slot.num}: "${slot.type}" → "${translatedType}" (handled by dedicated column, value: ${slot.value})`);
        continue;
      }
      const normalizedValue = normalizeOptionValue(slot.value.trim(), slot.type);
      userProvidedOptions.push({ type: translatedType, value: normalizedValue });
      console.log(`[Attributes] User option ${slot.num}: ${slot.type} -> ${translatedType} = ${normalizedValue}`);
    } else if (slot.type || slot.value) {
      console.log(`[Attributes] Ignoring invalid option ${slot.num}: type="${slot.type}", value="${slot.value}"`);
    }
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

  // Try to use user-provided options for attributes
  // Enhanced matching: fuzzy Korean name matching + English-to-Korean translation
  for (const userOption of userProvidedOptions) {
    // Build a list of alternative names to try for matching
    const alternativeNames: string[] = [userOption.type.toLowerCase()];

    // Add Korean synonyms for common unit-related attribute types
    const koreanSynonyms: Record<string, string[]> = {
      '용량': ['개당 용량', '총 용량', '순 내용 양'],
      '개당 용량': ['용량', '총 용량', '순 내용 양'],
      '중량': ['개당 중량', '총 중량', '순 함량 중량'],
      '개당 중량': ['중량', '총 중량', '순 함량 중량'],
      '수량': ['총 수량'],
      '총 수량': ['수량'],
      '사이즈': ['크기'],
      '크기': ['사이즈'],
    };

    // Add synonyms for the user's option type
    const typeKey = userOption.type.trim();
    for (const [key, synonyms] of Object.entries(koreanSynonyms)) {
      if (typeKey.includes(key) || key.includes(typeKey)) {
        for (const syn of synonyms) {
          alternativeNames.push(syn.toLowerCase());
        }
      }
    }

    // Also try English-to-Korean lookup
    for (const [engKey, patternInfo] of Object.entries(ENGLISH_ATTR_PATTERNS)) {
      if (userOption.type.toLowerCase().includes(engKey.toLowerCase())) {
        for (const koreanName of patternInfo.koreanNames) {
          alternativeNames.push(koreanName.toLowerCase());
        }
      }
    }

    // Find matching attribute in metadata using all alternative names
    const matchingAttr = attributeTypeMetas.find((meta: any) => {
      const metaName = (meta.attributeTypeName || '').toLowerCase();
      return alternativeNames.some(altName =>
        metaName === altName ||
        metaName.includes(altName) ||
        altName.includes(metaName)
      );
    });

    if (matchingAttr) {
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
      console.log(`[Attributes] Used user-provided: ${matchingAttr.attributeTypeName}=${finalValue} (matched from "${userOption.type}")`);
    } else {
      // No category meta match — DO NOT add unmatched attributes to the payload
      // Coupang will reject any attribute that is not defined in the category metadata
      console.log(`[Attributes] SKIPPED "${userOption.type}" — not a valid attribute for this category (value: ${userOption.value})`);
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

  // IMPORTANT: Only add attributes that EXIST in the category metadata
  // Do NOT blindly add 수량, 개당 용량, etc. as they may not be valid for this category

  // Helper to find attribute in category metadata
  const findAttrMeta = (name: string): any => {
    return attributeTypeMetas.find((m: any) =>
      m.attributeTypeName?.toLowerCase().includes(name.toLowerCase())
    );
  };

  // Helper to get valid value for an attribute
  const getValidValue = (attrMeta: any, extractedValue: string | null, defaultNum: string = '1'): string | null => {
    if (!attrMeta) return null;

    const predefinedValues = (attrMeta.attributeValueMetas || []).map((v: any) => v.attributeValueName);
    const usableUnits = attrMeta.usableUnits || [];

    // Priority 1: Match predefined values
    if (predefinedValues.length > 0) {
      if (extractedValue) {
        const matched = predefinedValues.find((pv: string) =>
          pv.toLowerCase().includes(extractedValue.toLowerCase()) ||
          extractedValue.toLowerCase().includes(pv.toLowerCase())
        );
        if (matched) return matched;
      }
      return predefinedValues[0]; // First predefined value
    }

    // Priority 2: Use usable units
    if (usableUnits.length > 0) {
      const num = extractedValue?.match(/(\d+)/)?.[1] || defaultNum;
      return `${num}${usableUnits[0]}`;
    }

    // Priority 3: Return extracted value or fallback
    return extractedValue || '상세페이지 참조';
  };

  // Helper to check if a concept is already fulfilled by user options or explicitly provided in CSV
  const hasConcept = (koreanTerms: string[], englishTerm: string, csvField: any) => {
    return attributes.some(a => {
      const typeName = (a.attributeTypeName || '').toLowerCase();
      return koreanTerms.some(term => typeName.includes(term)) || typeName.includes(englishTerm);
    }) || !!(csvField && String(csvField).trim());
  };

  // 1. Add 수량 ONLY if it exists in category metadata
  const hasQuantity = hasConcept(['수량', '개수'], 'quantity', product.quantity);
  if (!hasQuantity) {
    const qtyMeta = findAttrMeta('수량');
    if (qtyMeta) {
      const extractedQty = extractQuantityFromText(combined);
      const qtyValue = getValidValue(qtyMeta, extractedQty);
      if (qtyValue) {
        attributes.push({
          attributeTypeName: qtyMeta.attributeTypeName.substring(0, 25),
          attributeValueName: qtyValue.substring(0, 30)
        });
        console.log(`[Attributes] Added ${qtyMeta.attributeTypeName}=${qtyValue} (validated against category meta)`);
      }
    } else {
      console.log(`[Attributes] Skipping 수량 - not in category metadata`);
    }
  }

  // 2. Add 개당 용량/중량 ONLY if it exists in category metadata
  const hasVolume = hasConcept(['용량', '부피'], 'volume', product.volume);
  const hasWeight = hasConcept(['중량', '무게'], 'weight', product.weight);

  if (!hasVolume && !hasWeight) {
    const volumeMeta = findAttrMeta('용량');
    const weightMeta = findAttrMeta('중량');

    const explicitVolume = product.volume;
    const explicitWeight = product.weight;

    // Search ALL combined text for volume/weight, not just productName
    const extractedVolume = extractVolumeFromText(combined);
    const extractedWeight = extractWeightFromText(combined);

    if (volumeMeta && (explicitVolume || extractedVolume)) {
      const volValue = getValidValue(volumeMeta, explicitVolume || extractedVolume);
      if (volValue) {
        attributes.push({
          attributeTypeName: volumeMeta.attributeTypeName.substring(0, 25),
          attributeValueName: volValue.substring(0, 30)
        });
        console.log(`[Attributes] Added ${volumeMeta.attributeTypeName}=${volValue} (validated)`);
      }
    } else if (weightMeta && (explicitWeight || extractedWeight)) {
      const wtValue = getValidValue(weightMeta, explicitWeight || extractedWeight);
      if (wtValue) {
        attributes.push({
          attributeTypeName: weightMeta.attributeTypeName.substring(0, 25),
          attributeValueName: wtValue.substring(0, 30)
        });
        console.log(`[Attributes] Added ${weightMeta.attributeTypeName}=${wtValue} (validated)`);
      }
    } else if (!volumeMeta && !weightMeta) {
      console.log(`[Attributes] Skipping volume/weight - not in category metadata`);
    } else {
      console.log(`[Attributes] WARNING: Category supports volume/weight but no data found. Consider adding 'volume' or 'weight' column.`);
    }
  }

  // SAFETY NET: ALWAYS include user-provided quantity/volume/weight from CSV
  // These are required by Coupang for the purchase option display line
  // Validate against category metadata when available, but still add with defaults when not
  const finalAttrNames = new Set(attributes.map(a => (a.attributeTypeName || '').toLowerCase()));

  if (product.quantity && !finalAttrNames.has('수량') && !attributes.some(a => a.attributeTypeName?.includes('수량'))) {
    const qtyMeta = findAttrMeta('수량');
    const val = ensureUnit(product.quantity, '개');
    if (qtyMeta) {
      const validatedVal = getValidValue(qtyMeta, val) || val;
      attributes.push({
        attributeTypeName: qtyMeta.attributeTypeName.substring(0, 25),
        attributeValueName: validatedVal.substring(0, 30)
      });
      console.log(`[Attributes] SAFETY NET: Added ${qtyMeta.attributeTypeName}=${validatedVal} (validated against category meta)`);
    } else {
      attributes.push({
        attributeTypeName: "수량",
        attributeValueName: val.substring(0, 30)
      });
      console.log(`[Attributes] SAFETY NET: Added 수량=${val} (no meta, using default)`);
    }
  }

  if (product.volume && !finalAttrNames.has('개당 용량') && !finalAttrNames.has('용량') && !attributes.some(a => a.attributeTypeName?.includes('용량'))) {
    const volMeta = findAttrMeta('용량');
    const val = ensureUnit(product.volume, 'ml');
    if (volMeta) {
      const validatedVal = getValidValue(volMeta, val) || val;
      attributes.push({
        attributeTypeName: volMeta.attributeTypeName.substring(0, 25),
        attributeValueName: validatedVal.substring(0, 30)
      });
      console.log(`[Attributes] SAFETY NET: Added ${volMeta.attributeTypeName}=${validatedVal} (validated against category meta)`);
    } else {
      attributes.push({
        attributeTypeName: "개당 용량",
        attributeValueName: val.substring(0, 30)
      });
      console.log(`[Attributes] SAFETY NET: Added 개당 용량=${val} (no meta, using default)`);
    }
  }

  if (product.weight && !finalAttrNames.has('개당 중량') && !finalAttrNames.has('중량') && !attributes.some(a => a.attributeTypeName?.includes('중량'))) {
    const wtMeta = findAttrMeta('중량');
    const val = ensureUnit(product.weight, 'g');
    if (wtMeta) {
      const validatedVal = getValidValue(wtMeta, val) || val;
      attributes.push({
        attributeTypeName: wtMeta.attributeTypeName.substring(0, 25),
        attributeValueName: validatedVal.substring(0, 30)
      });
      console.log(`[Attributes] SAFETY NET: Added ${wtMeta.attributeTypeName}=${validatedVal} (validated against category meta)`);
    } else {
      attributes.push({
        attributeTypeName: "개당 중량",
        attributeValueName: val.substring(0, 30)
      });
      console.log(`[Attributes] SAFETY NET: Added 개당 중량=${val} (no meta, using default)`);
    }
  }

  console.log(`[Attributes] Final attributes count: ${attributes.length}`);
  return attributes;
}

// Helper: Escape HTML special characters
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper: Convert plain text description into clean, formatted HTML for Coupang product page
function formatDescriptionAsHtml(rawDesc: string, product: any): string {
  const productName = escapeHtml(product.productName || 'Product');
  const brand = product.brand ? escapeHtml(product.brand) : '';
  const manufacturer = product.manufacturer ? escapeHtml(product.manufacturer) : '';

  // Split description into meaningful paragraphs
  // Split on: double newlines, single newlines, or periods followed by space
  let paragraphs: string[];
  if (rawDesc.includes('\n')) {
    // If the description has explicit newlines, split on those
    paragraphs = rawDesc.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);
  } else {
    // Otherwise split long text into chunks by sentence boundaries (period + space)
    paragraphs = rawDesc
      .split(/(?<=\.)\s+/)
      .reduce((acc: string[], sentence) => {
        const lastGroup = acc[acc.length - 1];
        // Group 2-3 sentences into each paragraph
        if (lastGroup && lastGroup.split('.').length < 3 && lastGroup.length < 200) {
          acc[acc.length - 1] = lastGroup + ' ' + sentence;
        } else {
          acc.push(sentence);
        }
        return acc;
      }, [])
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  // Build HTML with proper styling
  const htmlParts: string[] = [];
  htmlParts.push(`<div style="max-width:900px; margin:0 auto; padding:30px 20px; font-family:'Malgun Gothic','맑은 고딕',sans-serif; color:#333; line-height:1.8; font-size:15px;">`);

  // Product title
  htmlParts.push(`<h2 style="font-size:22px; font-weight:bold; color:#111; margin-bottom:20px; padding-bottom:15px; border-bottom:2px solid #e0e0e0;">${productName}</h2>`);

  // Brand/Manufacturer info bar
  if (brand || manufacturer) {
    htmlParts.push(`<div style="background:#f8f9fa; padding:12px 16px; border-radius:6px; margin-bottom:25px; font-size:14px; color:#555;">`);
    if (brand) htmlParts.push(`<span><strong>브랜드:</strong> ${brand}</span>`);
    if (brand && manufacturer) htmlParts.push(`<span style="margin:0 12px; color:#ddd;">|</span>`);
    if (manufacturer) htmlParts.push(`<span><strong>제조사:</strong> ${manufacturer}</span>`);
    htmlParts.push(`</div>`);
  }

  // Description paragraphs
  htmlParts.push(`<div style="margin-bottom:20px;">`);
  for (const para of paragraphs) {
    htmlParts.push(`<p style="margin-bottom:12px; text-align:justify;">${escapeHtml(para)}</p>`);
  }
  htmlParts.push(`</div>`);

  htmlParts.push(`</div>`);

  return htmlParts.join('\n');
}


function collectVariantOptionPairs(product: any): Array<{ type: string; value: string }> {
  const pairs = [
    { type: product.optionType1, value: product.optionValue1 },
    { type: product.optionType2, value: product.optionValue2 },
    { type: product.optionType3, value: product.optionValue3 },
    { type: product.optionType4, value: product.optionValue4 },
  ];

  return pairs
    .filter(pair => !isInvalidAttributeValue(pair.type) && !isInvalidAttributeValue(pair.value))
    .map(pair => ({
      type: translateOptionTypeName(pair.type),
      value: normalizeOptionValue(pair.value, pair.type)
    }));
}

function trimVariantName(name: string): string {
  return name
    .replace(/[-,:/|()\[\]]+\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function deriveCommonProductName(variantProducts: any[]): string {
  const names = variantProducts
    .map(product => String(product?.productName || '').trim())
    .filter(Boolean);

  if (names.length === 0) return 'Product';
  if (names.length === 1) return names[0];

  let prefix = names[0];
  for (let i = 1; i < names.length && prefix; i++) {
    const current = names[i];
    let cursor = 0;
    while (
      cursor < prefix.length &&
      cursor < current.length &&
      prefix[cursor].toLowerCase() === current[cursor].toLowerCase()
    ) {
      cursor++;
    }
    prefix = prefix.slice(0, cursor);
  }

  const trimmed = trimVariantName(prefix);
  if (!trimmed) {
    return names[0];
  }

  return (trimmed.split(/\s+/).length >= 3 ? trimmed : names[0]).substring(0, 100);
}

function buildVariantItemName(product: any, baseProductName?: string): string {
  const optionPairs = collectVariantOptionPairs(product);
  if (optionPairs.length > 0) {
    return optionPairs.map(pair => pair.value.trim()).join(' / ').substring(0, 150);
  }

  const fallbackParts = [product.quantity, product.volume, product.weight]
    .map(value => String(value || '').trim())
    .filter(Boolean);

  if (fallbackParts.length > 0) {
    return fallbackParts.join(' / ').substring(0, 150);
  }

  const productName = String(product?.productName || '').trim();
  if (baseProductName && productName.toLowerCase().startsWith(baseProductName.toLowerCase())) {
    const suffix = trimVariantName(productName.slice(baseProductName.length));
    if (suffix) {
      return suffix.substring(0, 150);
    }
  }

  return productName.substring(0, 150) || 'Default';
}
// Helper: Build a single Coupang item object from product data
function buildSingleItem(product: any, wingSettings: any, notices?: any[], categoryMeta?: any, baseProductName?: string): any {
  let attributes: any[];
  if (categoryMeta) {
    attributes = buildAttributesFromCategoryMeta(product, categoryMeta);
    console.log(`[Transform] Built ${attributes.length} attributes from category metadata`);
  } else {
    attributes = [];

    // Mandatory attribute names that should NOT be populated from user option columns
    // These are handled by dedicated quantity/volume/weight columns instead
    const MANDATORY_ATTR_NAMES = new Set(['수량', '개당 용량', '개당 중량', '용량', '중량', 'quantity', 'volume', 'weight', 'capacity']);
    
    // Only add user option types that DON'T overlap with mandatory attributes
    // Option types like "Quantity"/"수량" are already handled by the quantity column
    const optionPairs = [
      { type: product.optionType1, value: product.optionValue1 },
      { type: product.optionType2, value: product.optionValue2 },
      { type: product.optionType3, value: product.optionValue3 },
      { type: product.optionType4, value: product.optionValue4 },
    ];

    for (const pair of optionPairs) {
      if (!pair.type || !pair.value) continue;
      const translatedType = translateOptionTypeName(pair.type);
      if (MANDATORY_ATTR_NAMES.has(translatedType.toLowerCase()) || MANDATORY_ATTR_NAMES.has(pair.type.toLowerCase())) {
        console.log(`[Attributes] Fallback: Skipping option "${pair.type}" → "${translatedType}" (handled by dedicated column)`);
        continue;
      }
      attributes.push({
        attributeTypeName: translatedType.substring(0, 25),
        attributeValueName: normalizeOptionValue(pair.value, pair.type).substring(0, 30)
      });
      console.log(`[Attributes] Fallback: Added option "${pair.type}" → ${translatedType}=${normalizeOptionValue(pair.value, pair.type)}`);
    }

    // Add quantity, volume, weight from dedicated CSV columns
    const usedTypeNames = new Set(attributes.map(a => a.attributeTypeName.toLowerCase()));
    const hasQuantity = usedTypeNames.has('수량');
    const hasVolume = usedTypeNames.has('개당 용량') || usedTypeNames.has('용량');
    const hasWeight = usedTypeNames.has('개당 중량') || usedTypeNames.has('중량');

    if (product.quantity && !hasQuantity) {
      const val = ensureUnit(product.quantity, '개');
      attributes.push({
        attributeTypeName: "수량",
        attributeValueName: val.substring(0, 30)
      });
      console.log(`[Attributes] Added 수량=${val} from CSV`);
    }

    if (product.volume && !hasVolume) {
      const val = ensureUnit(product.volume, 'ml');
      attributes.push({
        attributeTypeName: "개당 용량",
        attributeValueName: val.substring(0, 30)
      });
      console.log(`[Attributes] Added 개당 용량=${val} from CSV`);
    }

    if (product.weight && !hasWeight) {
      const val = ensureUnit(product.weight, 'g');
      attributes.push({
        attributeTypeName: "개당 중량",
        attributeValueName: val.substring(0, 30)
      });
      console.log(`[Attributes] Added 개당 중량=${val} from CSV`);
    }

    console.log(`[Attributes] Fallback path: ${attributes.length} attribute(s) total`);
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
    const rawDesc = product.detailedDescription.trim();
    const htmlContent = formatDescriptionAsHtml(rawDesc, product);
    contents.push({
      contentsType: "HTML",
      contentDetails: [{
        content: htmlContent,
        detailType: "TEXT"
      }]
    });
  } else {
    // Fallback: generate basic HTML from product info
    const fallbackHtml = [
      `<div style="padding:20px; font-family:sans-serif; line-height:1.8;">`,
      `<h2 style="margin-bottom:15px;">${escapeHtml(product.productName || 'Product')}</h2>`,
      product.brand ? `<p><strong>브랜드:</strong> ${escapeHtml(product.brand)}</p>` : '',
      product.manufacturer ? `<p><strong>제조사:</strong> ${escapeHtml(product.manufacturer)}</p>` : '',
      `</div>`
    ].filter(Boolean).join('\n');
    contents.push({
      contentsType: "HTML",
      contentDetails: [{
        content: fallbackHtml,
        detailType: "TEXT"
      }]
    });
  }

  // Add detail images as content entries
  if (product.additionalImages && Array.isArray(product.additionalImages)) {
    product.additionalImages.forEach((img: string) => {
      if (img && img.trim() && img.trim().startsWith('http')) {
        contents.push({
          contentsType: "IMAGE",
          contentDetails: [{
            content: img.trim(),
            detailType: "IMAGE"
          }]
        });
      }
    });
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

  const validBarcode = cleanBarcode(product.barcode);
  const skuSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const item: any = {
    itemName: buildVariantItemName(product, baseProductName),
    // Coupang requires prices in multiples of 10 KRW (1원단위 입력 불가)
    originalPrice: Math.ceil((product.discountBasePrice || product.salePrice || 0) / 10) * 10,
    salePrice: Math.ceil((product.salePrice || 0) / 10) * 10,
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
    externalVendorSku: product.vendorProductCode || `SKU-${skuSuffix}`,
    barcode: validBarcode,
    emptyBarcode: !validBarcode,
    emptyBarcodeReason: !validBarcode ? "상품확인불가_바코드없음사유" : "",
    modelNo: product.modelNumber || "",
    certifications: certifications,
    searchTags: searchTags,
    images: images,
    attributes: attributes,
    contents: contents,
    offerCondition: "NEW",
    offerDescription: ""
  };

  if (Array.isArray(notices) && notices.length > 0) {
    item.notices = notices;
  }

  return item;
}

// Helper: Build the product-level payload wrapper (shipping, delivery, etc.)
function buildProductPayload(product: any, vendorId: string, wingSettings: any, items: any[], sellerProductNameOverride?: string): any {
  let categoryCode = 0;
  if (product.category) {
    const parts = product.category.toString().split('>');
    const lastPart = parts[parts.length - 1].trim();
    categoryCode = parseInt(lastPart) || 0;
  }

  const formatDate = (dateStr: string, isEnd: boolean = false): string => {
    if (!dateStr) {
      const now = new Date();
      if (isEnd) return "2099-12-31T23:59:59";
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

  const isShippingFromOverseas = wingSettings.countryCode && wingSettings.countryCode !== 'KR';
  const isOverseasProduct = product.overseasPurchase || isShippingFromOverseas;
  const deliveryMethod = isOverseasProduct ? "AGENT_BUY" : "SEQUENCIAL";

  let cleanBrand = (product.brand || "").trim();
  if (cleanBrand.includes("입력하세요") || cleanBrand.includes("예)") || cleanBrand.length > 100) {
    cleanBrand = cleanBrand.substring(0, 100);
  }

  const sellerProductName = (sellerProductNameOverride || product.productName || "").substring(0, 100);

  return {
    displayCategoryCode: categoryCode,
    sellerProductName: sellerProductName,
    vendorId: vendorId,
    saleStartedAt: formatDate(product.saleStartDate, false),
    saleEndedAt: formatDate(product.saleEndDate, true),
    displayProductName: cleanBrand ? `${cleanBrand} ${sellerProductName}`.substring(0, 100) : sellerProductName,
    brand: cleanBrand.substring(0, 100),
    generalProductName: sellerProductName,
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
    items: items,
    requiredDocuments: [],
    extraInfoMessage: "",
    manufacture: product.manufacturer || product.brand || "",
    bundleInfo: {
      bundleType: "SINGLE"
    }
  };
}

// Transform a single product (backwards compatible - wraps helpers)
export function transformProductToCoupangFormat(product: any, vendorId: string, wingSettings: any, notices?: any[], categoryMeta?: any): any {
  const item = buildSingleItem(product, wingSettings, notices, categoryMeta);
  console.log(`[Transform] Created single-item product (SKU: ${item.externalVendorSku})`);
  return buildProductPayload(product, vendorId, wingSettings, [item]);
}

// Transform a variant group into a single Coupang product with multiple items
export function transformVariantGroupToCoupangFormat(
  variantProducts: any[],
  vendorId: string,
  wingSettings: any,
  notices?: any[],
  categoryMeta?: any
): any {
  if (variantProducts.length === 0) throw new Error('No variant products provided');

  // First product in group is the "parent" — provides product-level info
  const parentProduct = variantProducts[0];
  const commonProductName = deriveCommonProductName(variantProducts);

  // Build one item per variant
  const items: any[] = [];
  for (let i = 0; i < variantProducts.length; i++) {
    const variant = variantProducts[i];
    const item = buildSingleItem(variant, wingSettings, notices, categoryMeta, commonProductName);
    items.push(item);
    console.log(`[Variants] Built item ${i + 1}/${variantProducts.length}: "${item.itemName}" @ ₩${item.salePrice}`);
  }

  // === DEDUPLICATION: Coupang requires unique itemNames and unique attribute combos ===
  const nameCount = new Map<string, number>();
  for (const item of items) {
    nameCount.set(item.itemName, (nameCount.get(item.itemName) || 0) + 1);
  }

  const hasDuplicateNames = [...nameCount.values()].some(c => c > 1);
  if (hasDuplicateNames) {
    console.log('[Variants] Duplicate itemNames detected — differentiating using product names');

    // Derive unique suffix for each variant from its product name
    for (let i = 0; i < items.length; i++) {
      const variantName = String(variantProducts[i].productName || '').trim();
      let suffix = '';

      // Try to extract the unique part after the common prefix
      if (commonProductName && variantName.toLowerCase().startsWith(commonProductName.toLowerCase())) {
        suffix = trimVariantName(variantName.slice(commonProductName.length));
      }

      // If no useful suffix, use the full variant name or index
      if (!suffix) {
        suffix = variantName || `Variant ${i + 1}`;
      }

      items[i].itemName = suffix.substring(0, 150);
    }

    // If STILL duplicates after suffix extraction, append index to make unique
    const seen = new Map<string, number>();
    for (let i = 0; i < items.length; i++) {
      const name = items[i].itemName;
      const count = seen.get(name) || 0;
      if (count > 0) {
        items[i].itemName = `${name} (${count + 1})`.substring(0, 150);
      }
      seen.set(name, count + 1);
    }

    console.log('[Variants] Deduplicated itemNames:', items.map((it: any) => it.itemName));
  }

  console.log(`[Variants] Created multi-item product with ${items.length} variant(s) under "${commonProductName}"`);
  return buildProductPayload(parentProduct, vendorId, wingSettings, items, commonProductName);
}

function validateVariantGroupForUpload(variantProducts: any[], wingSettings: any): string[] {
  const errors: string[] = [];

  if (!Array.isArray(variantProducts) || variantProducts.length === 0) {
    return ['Variant group is empty'];
  }

  const categories = new Set(
    variantProducts
      .map(product => String(product?.category || '').trim())
      .filter(Boolean)
  );

  if (categories.size > 1) {
    errors.push('All rows in a variant group must use the same category');
  }

  variantProducts.forEach((product, index) => {
    const validation = validateProductForUpload(product, wingSettings);
    if (!validation.valid) {
      validation.errors.forEach(error => {
        errors.push(`Variant ${index + 1}: ${error}`);
      });
    }
  });

  // Check for duplicate variant options (Coupang requires unique option combos within a group)
  const optionKeys = new Set<string>();
  let hasDuplicates = false;
  
  for (let i = 0; i < variantProducts.length; i++) {
    const p = variantProducts[i];
    const options = [
      p.optionValue1, p.optionValue2, p.optionValue3, p.optionValue4
    ].map(v => String(v || '').trim()).filter(Boolean).join(' | ');
    
    const key = options === '' ? '__empty__' : options;
    if (optionKeys.has(key)) {
      hasDuplicates = true;
    }
    optionKeys.add(key);
  }

  if (hasDuplicates) {
    errors.push('Duplicate Option Values. Each variant row in the group must have a UNIQUE combination of Option Type/Value (e.g. Size: Small, Size: Large). Please check your CSV.');
  }

  return errors;
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

  // Required product attributes — Coupang shows these on the product page
  // "Capacity per unit × Quantity : 30ml × 1"
  if (!product.quantity || !product.quantity.trim()) {
    errors.push('Quantity (수량) is required. Example: "1개", "2개", "30 tablets". Add a "Quantity" column in your CSV.');
  }

  if (!product.volume && !product.weight) {
    // Check if volume/weight can be found in product name or option values
    const productName = product.productName?.toLowerCase() || '';
    const hasVolumeInName = /\d+\s*(ml|l|밀리|리터)/i.test(productName);
    const hasWeightInName = /\d+\s*(g|kg|그램|킬로)/i.test(productName);
    const optionValuesCombined = [
      product.optionValue1 || '',
      product.optionValue2 || '',
      product.optionValue3 || '',
      product.optionValue4 || ''
    ].join(' ');
    const hasUnitInOptions = /\d+\s*(ml|l|g|kg|mg|oz|개|정|캡슐|팩|봉)/i.test(optionValuesCombined);

    if (!hasVolumeInName && !hasWeightInName && !hasUnitInOptions) {
      errors.push('Volume or Weight is required. Add a "Volume" column (e.g., "30ml", "500ml") or "Weight" column (e.g., "200g") in your CSV. This shows as "Capacity per unit" on the Coupang product page.');
    }
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
export async function uploadVariantGroup(
  variantProducts: any[],
  accessKey: string,
  secretKey: string,
  vendorId: string,
  wingSettings: any,
  notices?: any[],
  categoryMeta?: any
): Promise<{ success: boolean; productId?: string; error?: string; details?: any; payload?: any; variantCount?: number }> {
  const method = "POST";
  const path = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`;
  const query = "";

  try {
    const parentProduct = variantProducts[0];
  const commonProductName = deriveCommonProductName(variantProducts);
    const groupErrors = validateVariantGroupForUpload(variantProducts, wingSettings);
    if (groupErrors.length > 0) {
      return {
        success: false,
        error: `Validation failed: ${groupErrors.join(', ')}`,
        details: { validationErrors: groupErrors }
      };
    }

    const rawPayload = transformVariantGroupToCoupangFormat(variantProducts, vendorId, wingSettings, notices, categoryMeta);
    const payload = sanitizeProductPayload(rawPayload);

    console.log(`[Upload] Uploading variant group: ${parentProduct.productName} (${variantProducts.length} variants)`);
    console.log(`[Upload] Category: "${parentProduct.category}" → displayCategoryCode: ${payload.displayCategoryCode}`);
    console.log(`[Upload] Category metadata available: ${!!categoryMeta}, mandatory attrs: ${categoryMeta?.attributeTypeMetas?.filter((a: any) => a.required === 'MANDATORY').length || 0}`);
    // Debug: Log the exact attributes being sent for each item
    if (payload.items) {
      payload.items.forEach((item: any, idx: number) => {
        console.log(`[Upload] Item ${idx + 1} "${item.itemName}" attributes:`, JSON.stringify(item.attributes));
      });
    }
    console.log('[Upload] Payload items:', JSON.stringify(payload.items?.map((i: any) => ({ name: i.itemName, attrs: i.attributes, price: i.salePrice })), null, 2));

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
        payload: payload,
        variantCount: variantProducts.length
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

      console.log('[Upload] Variant group rejected by Coupang:', errorMsg);
      return {
        success: false,
        error: errorMsg,
        details: responseData,
        payload: payload,
        variantCount: variantProducts.length
      };
    }
  } catch (error: unknown) {
    console.error('[Upload] Variant group error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      error: errorMessage,
      variantCount: variantProducts.length
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

  // Step 1: Group products by productGroup field
  const groupMap = new Map<string, any[]>();
  const standaloneProducts: { index: number; product: any }[] = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const groupId = product.productGroup?.trim();
    if (groupId) {
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, []);
      }
      groupMap.get(groupId)!.push(product);
    } else {
      standaloneProducts.push({ index: i, product });
    }
  }

  const totalGroups = groupMap.size + standaloneProducts.length;
  console.log(`[Batch] ${products.length} rows → ${totalGroups} upload(s) (${groupMap.size} variant group(s), ${standaloneProducts.length} standalone)`);

  let uploadIndex = 0;

  // Step 2: Upload variant groups (each group = 1 Coupang product with multiple items)
  for (const [groupId, groupProducts] of groupMap) {
    uploadIndex++;
    console.log(`[Batch] Processing variant group ${uploadIndex}/${totalGroups}: "${groupId}" (${groupProducts.length} variants)`);

    let notices: any[] = [];
    let categoryMeta: any = null;
    try {
      const categoryCode = extractDisplayCategoryCode(groupProducts[0].category);
      if (categoryCode > 0) {
        categoryMeta = await fetchCategoryRelatedMeta(categoryCode, accessKey, secretKey, categoryMetaCache);
        notices = buildNoticesFromCategoryMeta(groupProducts[0], wingSettings, categoryMeta);
      }
    } catch (err) {
      console.error(`[Batch] Failed to fetch category meta for group "${groupId}":`, err);
    }

    const result = await uploadVariantGroup(groupProducts, accessKey, secretKey, vendorId, wingSettings, notices, categoryMeta);

    results.push({
      productIndex: uploadIndex - 1,
      productName: `${groupProducts[0].productName} (${groupProducts.length} variants)`,
      groupId: groupId,
      variantCount: groupProducts.length,
      ...result
    });

    if (result.success) {
      successCount++;
    } else {
      failedCount++;
    }

    await new Promise(resolve => setTimeout(resolve, 150));
  }

  // Step 3: Upload standalone products (single item each)
  for (const { product } of standaloneProducts) {
    uploadIndex++;
    console.log(`[Batch] Processing standalone ${uploadIndex}/${totalGroups}: ${product.productName}`);

    let notices: any[] = [];
    let categoryMeta: any = null;
    try {
      const categoryCode = extractDisplayCategoryCode(product.category);
      if (categoryCode > 0) {
        categoryMeta = await fetchCategoryRelatedMeta(categoryCode, accessKey, secretKey, categoryMetaCache);
        notices = buildNoticesFromCategoryMeta(product, wingSettings, categoryMeta);
      }
    } catch (err) {
      console.error(`[Batch] Failed to fetch category meta for standalone:`, err);
    }

    const result = await uploadProduct(product, accessKey, secretKey, vendorId, wingSettings, notices, categoryMeta);

    results.push({
      productIndex: uploadIndex - 1,
      productName: product.productName,
      ...result
    });

    if (result.success) {
      successCount++;
    } else {
      failedCount++;
    }

    if (uploadIndex < totalGroups) {
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
