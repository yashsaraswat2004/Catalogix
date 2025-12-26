import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// HMAC-SHA256 signature generation following Coupang's exact specification
// Reference: https://developers.coupangcorp.com/hc/en-us/articles/360033461914-Creating-HMAC-Signature
async function generateHmacSignature(
  method: string,
  path: string,
  query: string,
  secretKey: string,
  accessKey: string
): Promise<{ authorization: string; datetime: string }> {
  // Generate datetime in exact format: yyMMdd'T'HHmmss'Z' (UTC)
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const datetime = `${now.getUTCFullYear().toString().slice(2)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  // Create the message to sign: datetime + method + path + query
  const message = datetime + method + path + query;
  
  console.log('[HMAC] Generating signature:', { datetime, method, path, queryLength: query.length });

  // Generate HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Create authorization header in exact format
  // Format: "CEA algorithm=HmacSHA256, access-key={accessKey}, signed-date={datetime}, signature={signature}"
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
  
  return { authorization, datetime };
}

// Helpers ------------------------------------------------------------

function extractDisplayCategoryCode(category: any): number {
  if (!category) return 0;
  const parts = String(category).split('>');
  const lastPart = parts[parts.length - 1].trim();
  const parsed = parseInt(lastPart, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchDisplayCategoryStatus(
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

  const { authorization } = await generateHmacSignature(method, path, query, secretKey, accessKey);

  const response = await fetch(`https://api-gateway.coupang.com${path}`, {
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

async function fetchCategoryRelatedMeta(
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

  const { authorization } = await generateHmacSignature(method, path, query, secretKey, accessKey);

  console.log('[CategoryMeta] Fetching metadata for displayCategoryCode:', displayCategoryCode);

  const response = await fetch(`https://api-gateway.coupang.com${path}`, {
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
    // YYYYMM
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

function buildNoticesFromCategoryMeta(product: any, wingSettings: any, meta: any): any[] {
  const noticeCategories = meta?.noticeCategories;
  if (!Array.isArray(noticeCategories) || noticeCategories.length === 0) return [];

  const preferredName = String(product?.noticeCategory || '').trim();

  let chosen = preferredName
    ? noticeCategories.find((c: any) => String(c?.noticeCategoryName || '').trim() === preferredName)
    : undefined;

  if (!chosen) {
    // Pick the notice category with the smallest number of mandatory fields (easiest to satisfy)
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

// ============ RULE 2 & 3: Category-Specific Required Attributes ============
// Parse required attributes from category metadata and auto-fill based on product info
function buildAttributesFromCategoryMeta(product: any, meta: any): any[] {
  const attributes: any[] = [];
  
  // First, add any explicitly provided attributes from product
  const providedAttributes = new Set<string>();
  
  if (product.optionType1 && product.optionValue1) {
    attributes.push({
      attributeTypeName: product.optionType1.substring(0, 25),
      attributeValueName: product.optionValue1.substring(0, 30)
    });
    providedAttributes.add(product.optionType1.toLowerCase());
  }
  if (product.optionType2 && product.optionValue2) {
    attributes.push({
      attributeTypeName: product.optionType2.substring(0, 25),
      attributeValueName: product.optionValue2.substring(0, 30)
    });
    providedAttributes.add(product.optionType2.toLowerCase());
  }
  if (product.optionType3 && product.optionValue3) {
    attributes.push({
      attributeTypeName: product.optionType3.substring(0, 25),
      attributeValueName: product.optionValue3.substring(0, 30)
    });
    providedAttributes.add(product.optionType3.toLowerCase());
  }
  if (product.optionType4 && product.optionValue4) {
    attributes.push({
      attributeTypeName: product.optionType4.substring(0, 25),
      attributeValueName: product.optionValue4.substring(0, 30)
    });
    providedAttributes.add(product.optionType4.toLowerCase());
  }
  
  // Parse category metadata for required attributes
  const attributeTypeMetas = meta?.attributeTypeMetas || [];
  
  // Find required attribute groups (groupNumber > 0 means they're in a bundle group)
  // RULE 3: For bundle groups, we must provide EXACTLY ONE from the group
  const bundleGroups = new Map<number, any[]>();
  const mandatoryAttributes: any[] = [];
  
  for (const attrMeta of attributeTypeMetas) {
    const required = attrMeta.required === 'MANDATORY';
    const groupNumber = attrMeta.groupNumber || 0;
    
    if (required) {
      if (groupNumber > 0) {
        // Part of a bundle group - need to pick exactly one
        if (!bundleGroups.has(groupNumber)) {
          bundleGroups.set(groupNumber, []);
        }
        bundleGroups.get(groupNumber)!.push(attrMeta);
      } else {
        // Standalone mandatory attribute
        mandatoryAttributes.push(attrMeta);
      }
    }
  }
  
  console.log(`[Attributes] Found ${mandatoryAttributes.length} mandatory attrs, ${bundleGroups.size} bundle groups`);
  
  // Process bundle groups - pick the best one based on product info
  for (const [groupNum, groupAttrs] of bundleGroups) {
    // Check if any are already provided
    const alreadyProvided = groupAttrs.some(attr => 
      providedAttributes.has(attr.attributeTypeName?.toLowerCase())
    );
    
    if (alreadyProvided) {
      console.log(`[Attributes] Bundle group ${groupNum}: already provided`);
      continue;
    }
    
    // Pick the best attribute from the group based on product info
    const selectedAttr = selectBestAttributeFromGroup(groupAttrs, product);
    if (selectedAttr) {
      attributes.push(selectedAttr);
      console.log(`[Attributes] Bundle group ${groupNum}: selected ${selectedAttr.attributeTypeName}=${selectedAttr.attributeValueName}`);
    }
  }
  
  // Process standalone mandatory attributes
  for (const attrMeta of mandatoryAttributes) {
    const attrName = attrMeta.attributeTypeName;
    
    // Skip if already provided
    if (providedAttributes.has(attrName?.toLowerCase())) {
      continue;
    }
    
    const value = inferAttributeValue(attrMeta, product);
    if (value) {
      attributes.push({
        attributeTypeName: attrName.substring(0, 25),
        attributeValueName: value.substring(0, 30)
      });
      console.log(`[Attributes] Mandatory: ${attrName}=${value}`);
    }
  }
  
  // Ensure we always have at least "수량" (quantity) attribute
  const hasQuantity = attributes.some(a => 
    a.attributeTypeName?.includes('수량') || a.attributeTypeName?.toLowerCase().includes('quantity')
  );
  
  if (!hasQuantity && attributes.length === 0) {
    attributes.push({
      attributeTypeName: "수량",
      attributeValueName: "1개"
    });
  }
  
  return attributes;
}

// Select the best attribute from a bundle group based on product information
function selectBestAttributeFromGroup(groupAttrs: any[], product: any): any | null {
  const productName = (product.productName || '').toLowerCase();
  const description = (product.description || '').toLowerCase();
  const combined = `${productName} ${description}`;
  
  // Priority order for common supplement/food categories
  const priorityMap: { [key: string]: { patterns: string[]; extractor: (p: any, c: string) => string | null } } = {
    '개당 캡슐/정': {
      patterns: ['tablet', 'capsule', 'cap', '정', '캡슐', 'tabs', 'vcaps', 'softgel'],
      extractor: (p, c) => extractCountFromText(c, ['tablet', 'capsule', '정', '캡슐', 'cap', 'tabs']) || '60정'
    },
    '개당 중량': {
      patterns: ['g', 'gram', 'kg', 'mg', '그램', 'weight', '중량'],
      extractor: (p, c) => extractWeightFromText(c) || '100g'
    },
    '개당 용량': {
      patterns: ['ml', 'l', 'oz', 'liter', '리터', 'volume', '용량'],
      extractor: (p, c) => extractVolumeFromText(c) || '100ml'
    },
    '수량': {
      patterns: ['pack', 'bag', 'piece', 'ea', '개', '팩', 'set', 'box'],
      extractor: (p, c) => extractQuantityFromText(c) || '1개'
    }
  };
  
  // First, try to match based on product content
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
  
  // If no match, pick the first one with a default value
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

// Extract count (tablets, capsules) from text
function extractCountFromText(text: string, patterns: string[]): string | null {
  for (const pattern of patterns) {
    // Match patterns like "60 tablets", "100정", "30 capsules"
    const regex = new RegExp(`(\\d+)\\s*${pattern}s?`, 'i');
    const match = text.match(regex);
    if (match) {
      return `${match[1]}정`;
    }
  }
  return null;
}

// Extract weight from text
function extractWeightFromText(text: string): string | null {
  // Match patterns like "500g", "1kg", "100mg"
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

// Extract volume from text
function extractVolumeFromText(text: string): string | null {
  // Match patterns like "500ml", "1L", "16oz"
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

// Extract quantity from text
function extractQuantityFromText(text: string): string | null {
  // Match patterns like "100 bags", "50 packs", "6팩"
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

// Infer value for standalone mandatory attributes
function inferAttributeValue(attrMeta: any, product: any): string | null {
  const typeName = (attrMeta.attributeTypeName || '').toLowerCase();
  const combined = `${product.productName || ''} ${product.description || ''}`.toLowerCase();
  
  if (typeName.includes('수량') || typeName.includes('quantity')) {
    return extractQuantityFromText(combined) || '1개';
  }
  
  if (typeName.includes('용량') || typeName.includes('volume')) {
    return extractVolumeFromText(combined) || '상세페이지 참조';
  }
  
  if (typeName.includes('중량') || typeName.includes('weight')) {
    return extractWeightFromText(combined) || '상세페이지 참조';
  }
  
  if (typeName.includes('캡슐') || typeName.includes('정') || typeName.includes('tablet')) {
    return extractCountFromText(combined, ['tablet', 'capsule', '정', '캡슐']) || '상세페이지 참조';
  }
  
  // If there are predefined values, use the first one
  const values = attrMeta.attributeValueMetas || [];
  if (values.length > 0) {
    return values[0].attributeValueName || '상세페이지 참조';
  }
  
  return '상세페이지 참조';
}

// Transform internal product format to exact Coupang API format
// Reference: https://developers.coupangcorp.com/hc/en-us/articles/360033877853-Product-Creation
function transformProductToCoupangFormat(product: any, vendorId: string, wingSettings: any, notices?: any[], categoryMeta?: any): any {
  // Extract category code - if it's a path like "123>456>789", take the last one
  let categoryCode = 0;
  if (product.category) {
    const parts = product.category.toString().split('>');
    const lastPart = parts[parts.length - 1].trim();
    categoryCode = parseInt(lastPart) || 0;
  }

  // Format dates to Coupang format: yyyy-MM-dd'T'HH:mm:ss
  const formatDate = (dateStr: string, isEnd: boolean = false): string => {
    if (!dateStr) {
      const now = new Date();
      if (isEnd) {
        return "2099-12-31T23:59:59";
      }
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`;
    }
    // Try to parse the date
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

  // RULE 2 & 3: Build attributes from category metadata (if available) or product options
  let attributes: any[];
  if (categoryMeta) {
    attributes = buildAttributesFromCategoryMeta(product, categoryMeta);
    console.log(`[Transform] Built ${attributes.length} attributes from category metadata`);
  } else {
    // Fallback to old behavior if no category metadata
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
    
    // Default attribute if none provided
    if (attributes.length === 0) {
      attributes.push({
        attributeTypeName: "수량",
        attributeValueName: "1개"
      });
    }
  }

  // Build images array
  const images: any[] = [];
  if (product.mainImage) {
    images.push({
      imageOrder: 0,
      imageType: "REPRESENTATION",
      vendorPath: product.mainImage.trim()
    });
  }
  
  // Add additional images (up to 9 DETAIL images)
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

  // Build contents array for product description
  const contents: any[] = [];
  if (product.detailedDescription) {
    // Check if description is HTML
    const isHtml = /<[^>]+>/.test(product.detailedDescription);
    contents.push({
      contentsType: isHtml ? "HTML" : "TEXT",
      contentDetails: [{
        content: product.detailedDescription,
        detailType: "TEXT"
      }]
    });
  }

  // Build search tags from keywords
  const searchTags: string[] = [];
  if (product.searchKeywords) {
    const keywords = product.searchKeywords.split(',').map((k: string) => k.trim()).filter((k: string) => k);
    keywords.slice(0, 20).forEach((keyword: string) => {
      if (keyword.length <= 20) {
        searchTags.push(keyword);
      }
    });
  }

  // Build certification info
  const certifications: any[] = [];
  if (product.certInfoType1) {
    certifications.push({
      certificationType: product.certInfoType1,
      certificationCode: product.certInfoValue1 || ""
    });
  } else {
    // Default: certification not required
    certifications.push({
      certificationType: "NOT_REQUIRED",
      certificationCode: ""
    });
  }

  // RULE 1: Shipping location decides EVERYTHING
  // If the outbound shipping place is overseas (non-KR), ALL products MUST be:
  // - overseasPurchased: "OVERSEAS_PURCHASED"
  // - deliveryMethod: "AGENT_BUY" (set later in payload)
  // - pccNeeded: true
  const isShippingFromOverseas = wingSettings.countryCode && wingSettings.countryCode !== 'KR';
  const isOverseasProduct = product.overseasPurchase || isShippingFromOverseas;
  
  console.log(`[Overseas Check] Country: ${wingSettings.countryCode}, Product overseas flag: ${product.overseasPurchase}, Final overseas: ${isOverseasProduct}`);
  
  // Build the single item
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
    // Force overseas purchased if shipping from overseas
    overseasPurchased: isOverseasProduct ? "OVERSEAS_PURCHASED" : "NOT_OVERSEAS_PURCHASED",
    // PCC (Personal Customs Code) required for all overseas products
    pccNeeded: isOverseasProduct,
    externalVendorSku: product.vendorProductCode || "",
    barcode: product.barcode || "",
    emptyBarcode: !product.barcode,
    emptyBarcodeReason: !product.barcode ? "상품확인불가_바코드없음사유" : "",
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

  // Add notices if provided (auto-generated from category metadata)
  if (Array.isArray(notices) && notices.length > 0) {
    item.notices = notices;
  }

  // Delivery method based on overseas status (already calculated above)
  // AGENT_BUY = 구매대행 (Purchase Agency) - required for ALL overseas products
  const deliveryMethod = isOverseasProduct ? "AGENT_BUY" : "SEQUENCIAL";
  console.log(`[Delivery] Method: ${deliveryMethod}, Overseas: ${isOverseasProduct}`);

  // Clean and truncate brand name (max 100 chars)
  let cleanBrand = (product.brand || "").trim();
  // Remove instruction text patterns
  if (cleanBrand.includes("입력하세요") || cleanBrand.includes("예)") || cleanBrand.length > 100) {
    cleanBrand = cleanBrand.substring(0, 100);
  }

  // Build the full product payload matching Coupang API exactly
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
    requested: true, // Auto-submit for approval - products go live after Coupang approves
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

// Validate product data before transformation
function validateProductForUpload(product: any, wingSettings: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required product fields
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

  // Validate image URL format
  if (product.mainImage && !product.mainImage.startsWith('http')) {
    errors.push("Main image must be a valid URL starting with http:// or https://");
  }

  // Required Wing settings
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

// Validate credentials by making a lightweight API call
async function validateCredentials(accessKey: string, secretKey: string, vendorId: string): Promise<{ valid: boolean; message: string }> {
  const method = "GET";
  const path = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`;
  const query = `vendorId=${vendorId}&nextToken=&maxPerPage=1&status=APPROVED`;
  
  try {
    const { authorization } = await generateHmacSignature(method, path, query, secretKey, accessKey);
    
    console.log('[Validate] Making API request...');
    const response = await fetch(`https://api-gateway.coupang.com${path}?${query}`, {
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
      // Parse response to check for IP whitelist issue
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.message && errorData.message.includes('ip address')) {
          // Extract IP from message
          const ipMatch = errorData.message.match(/(\d+\.\d+\.\d+\.\d+)/);
          const ip = ipMatch ? ipMatch[1] : 'unknown';
          return { 
            valid: false, 
            message: `IP not whitelisted. Please add IP "${ip}" to your Wing API settings (Seller Info → Open API → IP Whitelist).` 
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

// Upload a single product with full error handling
async function uploadProduct(
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
    // Validate product data first
    const validation = validateProductForUpload(product, wingSettings);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
        details: { validationErrors: validation.errors }
      };
    }

    // Transform product to Coupang format with category metadata for proper attributes
    const payload = transformProductToCoupangFormat(product, vendorId, wingSettings, notices, categoryMeta);
    
    console.log('[Upload] Uploading product:', product.productName);
    console.log('[Upload] Payload:', JSON.stringify(payload, null, 2).slice(0, 2000));

    const { authorization } = await generateHmacSignature(method, path, query, secretKey, accessKey);

    const response = await fetch(`https://api-gateway.coupang.com${path}`, {
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

    // Coupang returns HTTP 200 even for errors - check the response code field
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
      // Extract detailed error message from Coupang response
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

// Batch upload with rate limiting (max 10 per second per Coupang docs)
async function batchUpload(
  products: any[],
  accessKey: string,
  secretKey: string,
  vendorId: string,
  wingSettings: any
): Promise<{ results: any[]; successCount: number; failedCount: number }> {
  const results: any[] = [];
  let successCount = 0;
  let failedCount = 0;

  // Cache for category metadata to avoid duplicate API calls
  const categoryMetaCache = new Map<number, any>();

  // Process one at a time with 150ms delay (ensuring under 10 per second)
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    console.log(`[Batch] Processing product ${i + 1}/${products.length}: ${product.productName}`);

    // Fetch category metadata for notices AND required attributes
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
    
    // Pass category metadata for proper attribute handling (RULE 2 & 3)
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

    // Rate limiting: 150ms delay between requests (allows ~6-7 per second, well under limit)
    if (i < products.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  return { results, successCount, failedCount };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, credentials, products, wingSettings, dryRun, productName, productDescription, brand, attributes: reqAttributes, categoryCode: reqCategoryCode } = body;

    console.log('[API] Action:', action, '| Products count:', products?.length || 0, '| Dry run:', dryRun);

    // Validate request has credentials
    if (!credentials || !credentials.accessKey || !credentials.secretKey || !credentials.vendorId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing API credentials. Please provide accessKey, secretKey, and vendorId.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { accessKey, secretKey, vendorId } = credentials;

    // Handle different actions
    switch (action) {
      case 'validate': {
        // Only validate credentials without uploading
        const validation = await validateCredentials(accessKey, secretKey, vendorId);
        return new Response(
          JSON.stringify({ success: validation.valid, message: validation.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'upload': {
        // Validate products array
        if (!products || !Array.isArray(products) || products.length === 0) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'No products provided for upload.' 
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Validate wing settings
        if (!wingSettings) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Wing settings are required. Please configure return location and shipping settings.' 
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // If dry run, validate and return transformed payloads without API calls
        if (dryRun) {
          console.log('[API] Dry run mode - validating without API calls');
          
          const transformedProducts = products.map((p: any, idx: number) => {
            const validation = validateProductForUpload(p, wingSettings);
            let transformed = null;
            
            if (validation.valid) {
              transformed = transformProductToCoupangFormat(p, vendorId, wingSettings);
            }
            
            return {
              index: idx,
              productName: p.productName,
              valid: validation.valid,
              errors: validation.errors,
              transformed: transformed
            };
          });
          
          const validCount = transformedProducts.filter((p: any) => p.valid).length;
          const invalidCount = transformedProducts.filter((p: any) => !p.valid).length;
          
          return new Response(
            JSON.stringify({
              success: invalidCount === 0,
              dryRun: true,
              message: invalidCount === 0 
                ? `All ${validCount} products are valid and ready for upload.`
                : `${invalidCount} product(s) have validation errors. Please fix them before uploading.`,
              validCount,
              invalidCount,
              products: transformedProducts
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // First validate credentials before attempting upload
        const credValidation = await validateCredentials(accessKey, secretKey, vendorId);
        if (!credValidation.valid) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: credValidation.message 
            }),
            { 
              status: 401, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Perform batch upload
        const uploadResult = await batchUpload(products, accessKey, secretKey, vendorId, wingSettings);
        
        return new Response(
          JSON.stringify({
            success: uploadResult.failedCount === 0,
            message: `Uploaded ${uploadResult.successCount}/${products.length} products successfully.`,
            successCount: uploadResult.successCount,
            failedCount: uploadResult.failedCount,
            results: uploadResult.results
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'validate-products': {
        // Validate products without uploading
        if (!products || !Array.isArray(products) || products.length === 0) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'No products provided for validation.' 
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        const validationResults = products.map((p: any, idx: number) => {
          const validation = validateProductForUpload(p, wingSettings || {});
          return {
            index: idx,
            productName: p.productName,
            valid: validation.valid,
            errors: validation.errors
          };
        });

        const validCount = validationResults.filter((r: any) => r.valid).length;

        return new Response(
          JSON.stringify({
            success: true,
            validCount,
            invalidCount: validationResults.length - validCount,
            results: validationResults
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'test-signature': {
        // Test endpoint to verify HMAC signature generation
        const testPath = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products';
        const testQuery = `vendorId=${vendorId}&nextToken=&maxPerPage=1`;
        const { authorization, datetime } = await generateHmacSignature('GET', testPath, testQuery, secretKey, accessKey);
        
        return new Response(
          JSON.stringify({
            success: true,
            datetime,
            authorization: authorization.slice(0, 80) + '...',
            message: 'HMAC signature generated successfully. Use validate action to test with actual API.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'fetch-shipping-centers': {
        // Fetch return shipping centers and outbound shipping places from Coupang API
        // Docs: 
        // - Shipping places: https://developers.coupangcorp.com/hc/en-us/articles/360033644754-Query-a-shipping-location
        // - Return centers: Created through WING or return location creation API
        console.log('[API] Fetching shipping centers for vendor:', vendorId);
        
        const results: { returnCenters: any[]; shippingPlaces: any[]; error?: string } = {
          returnCenters: [],
          shippingPlaces: []
        };

        // Fetch return shipping centers (v4 API)
        try {
          const returnPath = `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/returnShippingCenters`;
          const returnQuery = `pageSize=50&pageNum=1`;
          const { authorization: returnAuth } = await generateHmacSignature('GET', returnPath, returnQuery, secretKey, accessKey);
          
          console.log('[API] Fetching return centers from:', returnPath);
          const returnResponse = await fetch(`https://api-gateway.coupang.com${returnPath}?${returnQuery}`, {
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

            // Observed response shape (v4):
            // { code: 200, message: "SUCCESS", data: { content: [...] } }
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
          } else {
            console.log('[API] Return centers error response:', returnText);
          }
        } catch (err) {
          console.error('[API] Error fetching return centers:', err);
        }

        // Fetch outbound shipping places using marketplace_openapi (v2 API)
        // Endpoint: /v2/providers/marketplace_openapi/apis/api/v2/vendor/shipping-place/outbound
        // Docs: https://developers.coupangcorp.com/hc/en-us/articles/360033644754-Query-a-shipping-location
        // Required params: pageNum & pageSize (NOT vendorId)
        try {
          const shippingPath = `/v2/providers/marketplace_openapi/apis/api/v2/vendor/shipping-place/outbound`;
          const shippingQuery = `pageNum=1&pageSize=50`;
          const { authorization: shippingAuth } = await generateHmacSignature('GET', shippingPath, shippingQuery, secretKey, accessKey);
          
          console.log('[API] Fetching outbound shipping places from:', shippingPath, 'with query:', shippingQuery);
          const shippingResponse = await fetch(`https://api-gateway.coupang.com${shippingPath}?${shippingQuery}`, {
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
            // Response structure: { content: [...], pagination: {...} }
            const content = shippingData.content || shippingData.data?.content || [];
            console.log('[API] Shipping places content:', JSON.stringify(content).slice(0, 500));
            
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
            console.log('[API] Shipping places error response:', shippingText);
            results.error = `Shipping places API returned ${shippingResponse.status}: ${shippingText.slice(0, 200)}`;
          }
        } catch (err) {
          console.error('[API] Error fetching shipping places:', err);
          results.error = `Error fetching shipping places: ${err instanceof Error ? err.message : 'Unknown error'}`;
        }

        return new Response(
          JSON.stringify({
            success: true,
            ...results,
            message: `Found ${results.returnCenters.length} return center(s) and ${results.shippingPlaces.length} shipping place(s).`,
            note: results.returnCenters.length === 0 
              ? 'If no return centers found, create one in WING or use "NO_RETURN_CENTERCODE" to manually add return location info.'
              : undefined
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'recommend-category': {
        // Recommend a category based on product name/description using Coupang's API
        // Use productName, productDescription, brand, reqAttributes from the already-parsed body
        
        if (!productName) {
          return new Response(
            JSON.stringify({ success: false, error: 'Product name is required for category recommendation.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const method = 'POST';
        const path = '/v2/providers/openapi/apis/api/v1/categorization/predict';
        const query = '';

        const requestBody: any = { productName };
        if (productDescription) requestBody.productDescription = productDescription;
        if (brand) requestBody.brand = brand;
        if (reqAttributes) requestBody.attributes = reqAttributes;

        console.log('[RecommendCategory] Request:', JSON.stringify(requestBody));

        const { authorization } = await generateHmacSignature(method, path, query, secretKey, accessKey);

        const response = await fetch(`https://api-gateway.coupang.com${path}`, {
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
          return new Response(
            JSON.stringify({ success: false, error: `Category recommendation failed: ${responseText.slice(0, 200)}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = JSON.parse(responseText);
        const result = data?.data;

        if (result?.autoCategorizationPredictionResultType === 'SUCCESS') {
          return new Response(
            JSON.stringify({
              success: true,
              categoryCode: result.predictedCategoryId,
              categoryName: result.predictedCategoryName,
              message: `Recommended category: ${result.predictedCategoryName} (${result.predictedCategoryId})`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({
              success: false,
              error: result?.comment || 'Could not determine category. Please provide more detailed product information.',
              resultType: result?.autoCategorizationPredictionResultType
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'validate-category': {
        // Check if a category code is valid - use reqCategoryCode from already-parsed body
        
        if (!reqCategoryCode) {
          return new Response(
            JSON.stringify({ success: false, error: 'Category code is required.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const cache = new Map<number, boolean>();
        const isValid = await fetchDisplayCategoryStatus(parseInt(reqCategoryCode), accessKey, secretKey, cache);

        return new Response(
          JSON.stringify({ success: true, valid: isValid, categoryCode: reqCategoryCode }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Unknown action: ${action}. Supported actions: validate, upload, validate-products, test-signature, fetch-shipping-centers, recommend-category, validate-category` 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }
  } catch (error: unknown) {
    console.error('[API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
