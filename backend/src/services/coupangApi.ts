import { generateHmacSignature } from './hmacSignature';

const COUPANG_API_BASE = 'https://api-gateway.coupang.com';

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

  const { authorization } = generateHmacSignature(method, path, query, secretKey, accessKey);

  const response = await fetch(`${COUPANG_API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/json;charset=UTF-8'
    }
  });

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

  const { authorization } = generateHmacSignature(method, path, query, secretKey, accessKey);

  console.log('[CategoryMeta] Fetching metadata for displayCategoryCode:', displayCategoryCode);

  const response = await fetch(`${COUPANG_API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/json;charset=UTF-8'
    }
  });

  const responseText = await response.text();

  if (response.status !== 200) {
    console.log('[CategoryMeta] Non-200 response:', response.status, responseText.slice(0, 500));
    throw new Error(`Category metadata API returned ${response.status}`);
  }

  const json = JSON.parse(responseText);
  const meta = Array.isArray(json?.data) ? json.data[0] : json?.data;

  cache.set(displayCategoryCode, meta);
  return meta;
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

function extractCountFromText(text: string, patterns: string[]): string | null {
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
    { regex: /(\d+(?:\.\d+)?)\s*g(?!ram)/i, suffix: 'g' },
    { regex: /(\d+(?:\.\d+)?)\s*mg/i, suffix: 'mg' },
    { regex: /(\d+(?:\.\d+)?)\s*gram/i, suffix: 'g' }
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

function selectBestAttributeFromGroup(groupAttrs: any[], product: any): any | null {
  const productName = (product.productName || '').toLowerCase();
  const description = (product.detailedDescription || product.description || '').toLowerCase();
  
  // Include option values in the search text
  const optionValues = [
    product.optionValue1 || '',
    product.optionValue2 || '',
    product.optionValue3 || '',
    product.optionValue4 || ''
  ].join(' ').toLowerCase();
  
  const combined = `${productName} ${description} ${optionValues}`;
  
  const priorityMap: { [key: string]: { patterns: string[]; extractor: (p: any, c: string) => string | null } } = {
    '개당 캡슐/정': {
      patterns: ['tablet', 'capsule', 'cap', '정', '캡슐', 'tabs', 'vcaps', 'softgel', 'pills', 'ct'],
      extractor: (p, c) => extractCountFromText(c, ['tablet', 'capsule', '정', '캡슐', 'cap', 'tabs', 'ct']) || '60정'
    },
    '개당 중량': {
      patterns: ['g', 'gram', 'kg', 'mg', '그램', 'weight', '중량', 'oz', 'lb'],
      extractor: (p, c) => extractWeightFromText(c) || '100g'
    },
    '개당 용량': {
      patterns: ['ml', 'l', 'oz', 'liter', '리터', 'volume', '용량', 'fl oz'],
      extractor: (p, c) => extractVolumeFromText(c) || '100ml'
    },
    '최소 중량': {
      patterns: ['g', 'gram', 'kg', 'mg', '그램', 'weight', '중량'],
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
    const config = priorityMap[typeName];
    
    if (config) {
      const hasMatch = config.patterns.some(pattern => combined.includes(pattern));
      if (hasMatch) {
        const value = config.extractor(product, combined);
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
    const config = priorityMap[typeName];
    const value = config ? config.extractor(product, combined) : '상세페이지 참조';
    
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
  
  // Also include option values in the text to search
  const optionValues = [
    product.optionValue1 || '',
    product.optionValue2 || '',
    product.optionValue3 || '',
    product.optionValue4 || ''
  ].join(' ').toLowerCase();
  
  const combined = `${productName} ${description} ${optionValues}`;
  
  // 수량 (quantity) - extract numeric count
  if (typeName.includes('수량') || typeName.includes('quantity')) {
    return extractQuantityFromText(combined) || '1개';
  }
  
  // 개당 수량 (per unit count)
  if (typeName.includes('개당 수량')) {
    const match = combined.match(/(\d+)\s*(bags?|packs?|pieces?|개|팩|ea)/i);
    if (match) return `${match[1]}개`;
    return '1개';
  }
  
  // 용량/개당 용량/최소 용량 (volume)
  if (typeName.includes('용량') || typeName.includes('volume')) {
    return extractVolumeFromText(combined) || '상세페이지 참조';
  }
  
  // 중량/개당 중량/최소 중량 (weight)
  if (typeName.includes('중량') || typeName.includes('weight')) {
    return extractWeightFromText(combined) || '상세페이지 참조';
  }
  
  // 캡슐/정 (tablets/capsules)
  if (typeName.includes('캡슐') || typeName.includes('정') || typeName.includes('tablet')) {
    return extractCountFromText(combined, ['tablet', 'capsule', '정', '캡슐', 'ct', 'tabs']) || '상세페이지 참조';
  }
  
  // If the metadata has predefined values, use the first one
  const values = attrMeta.attributeValueMetas || [];
  if (values.length > 0) {
    return values[0].attributeValueName || '상세페이지 참조';
  }
  
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
  const combined = `${productName} ${description}`;
  
  // Collect user-provided option values (for value extraction, not for attribute names)
  const userOptionValues: string[] = [];
  if (product.optionValue1) userOptionValues.push(product.optionValue1);
  if (product.optionValue2) userOptionValues.push(product.optionValue2);
  if (product.optionValue3) userOptionValues.push(product.optionValue3);
  if (product.optionValue4) userOptionValues.push(product.optionValue4);
  const optionValuesText = userOptionValues.join(' ').toLowerCase();
  const allText = `${combined} ${optionValuesText}`;
  
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
  
  // Process bundle groups - MUST select exactly one from each group
  for (const [groupNum, groupAttrs] of bundleGroups) {
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
  
  // Always ensure 수량 (quantity) is present if it's a valid attribute for this category
  const hasQuantity = attributes.some(a => 
    a.attributeTypeName?.includes('수량')
  );
  
  if (!hasQuantity && validAttrNames.has('수량')) {
    const qtyValue = extractQuantityFromText(allText) || '1개';
    attributes.push({
      attributeTypeName: "수량",
      attributeValueName: qtyValue
    });
    console.log(`[Attributes] Added default 수량=${qtyValue}`);
  }
  
  // FALLBACK: For categories that require 수량, 개당 중량, 개당 용량 (like shampoo/cosmetics)
  // Add these mandatory attributes if not already present
  const requiredFallbackAttrs = [
    { name: '수량', value: '1개' },
    { name: '개당 중량', value: '상세페이지 참조' },
    { name: '개당 용량', value: extractVolumeFromText(productName) || '상세페이지 참조' }
  ];
  
  for (const fallback of requiredFallbackAttrs) {
    const hasAttr = attributes.some(a => 
      a.attributeTypeName === fallback.name
    );
    if (!hasAttr) {
      attributes.push({
        attributeTypeName: fallback.name,
        attributeValueName: fallback.value
      });
      console.log(`[Attributes] Fallback added: ${fallback.name}=${fallback.value}`);
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
  if (product.detailedDescription) {
    const isHtml = /<[^>]+>/.test(product.detailedDescription);
    contents.push({
      contentsType: isHtml ? "HTML" : "TEXT",
      contentDetails: [{
        content: product.detailedDescription,
        detailType: "TEXT"
      }]
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
  
  console.log(`[Overseas Check] Country: ${wingSettings.countryCode}, Product overseas flag: ${product.overseasPurchase}, Final overseas: ${isOverseasProduct}`);
  
  // Clean and validate barcode - extracts ASIN from Amazon URLs or validates format
  const validBarcode = cleanBarcode(product.barcode);
  
  const item: any = {
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
    externalVendorSku: product.vendorProductCode || "",
    barcode: validBarcode,
    emptyBarcode: !validBarcode,
    emptyBarcodeReason: !validBarcode ? "상품확인불가_바코드없음사유" : "",
    modelNo: product.modelNumber || "",
    certifications: certifications,
    searchTags: searchTags,
    images: images,
    attributes: attributes,
    contents: contents.length > 0 ? contents : [{
      contentsType: "TEXT",
      contentDetails: [{
        content: product.productName || "Product",
        detailType: "TEXT"
      }]
    }],
    offerCondition: "NEW",
    offerDescription: ""
  };

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

  if (!product.category) errors.push("Category is required");
  if (!product.productName) errors.push("Product name is required");
  if (!product.salePrice || product.salePrice <= 0) errors.push("Sale price must be greater than 0");
  if (!product.discountBasePrice || product.discountBasePrice <= 0) errors.push("Discount base price must be greater than 0");
  if (!product.stockQuantity || product.stockQuantity <= 0) errors.push("Stock quantity must be greater than 0");
  if (!product.leadTime || product.leadTime < 1) errors.push("Lead time must be at least 1 day");
  if (!product.mainImage) errors.push("Main image URL is required");
  if (!product.detailedDescription) errors.push("Detailed description is required");
  if (!product.brand) errors.push("Brand is required");
  if (!product.manufacturer) errors.push("Manufacturer is required");

  if (product.mainImage && !product.mainImage.startsWith('http')) {
    errors.push("Main image must be a valid URL starting with http:// or https://");
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
    const { authorization } = generateHmacSignature(method, path, query, secretKey, accessKey);
    
    console.log('[Validate] Making API request...');
    const response = await fetch(`${COUPANG_API_BASE}${path}?${query}`, {
      method,
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json;charset=UTF-8'
      }
    });

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
      } catch {}
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

    const payload = transformProductToCoupangFormat(product, vendorId, wingSettings, notices, categoryMeta);
    
    console.log('[Upload] Uploading product:', product.productName);
    console.log('[Upload] Payload:', JSON.stringify(payload, null, 2).slice(0, 2000));

    const { authorization } = generateHmacSignature(method, path, query, secretKey, accessKey);

    const response = await fetch(`${COUPANG_API_BASE}${path}`, {
      method,
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json;charset=UTF-8'
      },
      body: JSON.stringify(payload)
    });

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
    const { authorization: returnAuth } = generateHmacSignature('GET', returnPath, returnQuery, secretKey, accessKey);
    
    console.log('[API] Fetching return centers from:', returnPath);
    const returnResponse = await fetch(`${COUPANG_API_BASE}${returnPath}?${returnQuery}`, {
      method: 'GET',
      headers: {
        'Authorization': returnAuth,
        'Content-Type': 'application/json;charset=UTF-8'
      }
    });

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
    const { authorization: shippingAuth } = generateHmacSignature('GET', shippingPath, shippingQuery, secretKey, accessKey);
    
    console.log('[API] Fetching outbound shipping places from:', shippingPath);
    const shippingResponse = await fetch(`${COUPANG_API_BASE}${shippingPath}?${shippingQuery}`, {
      method: 'GET',
      headers: {
        'Authorization': shippingAuth,
        'Content-Type': 'application/json;charset=UTF-8'
      }
    });

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

  const { authorization } = generateHmacSignature(method, path, query, secretKey, accessKey);

  const response = await fetch(`${COUPANG_API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/json;charset=UTF-8'
    },
    body: JSON.stringify(requestBody)
  });

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
