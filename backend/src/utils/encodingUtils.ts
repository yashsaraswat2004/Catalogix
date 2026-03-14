/**
 * Encoding utilities for Coupang API integration
 * Fixes UTF-8 corruption and normalizes Korean text/units
 */

// Common UTF-8 corruption patterns (EUC-KR misread as UTF-8)
// Order matters - longer patterns should come first to avoid partial replacements
const CORRUPTION_MAP: Record<string, string> = {
  // Full corrupted sequences (order from longest to shortest)
  'ê°œ': '개',    // "개" fully corrupted
  '1ê°œ': '1개',  // Common pattern from CSV
  'ìº¡ì¿¨': '캡슐',
  'ìº¡ì': '캡슐',
  'ê°': '개',
  'ì ': '정',
  'ë´': '봉',
  'í©': '팩',
  'í': '팩',     // Partial "팩" corruption

  // Single character leftovers (clean up after pattern replacement)
  'œ': '',       // Leftover from corrupted sequences
  '°': '',       // Stray degree symbol from encoding issues
  'ê': '',       // Partial corruption leftover (after pattern match)
  'ì': '',       // Partial corruption leftover
  'ë': '',       // Partial corruption leftover
  '¨': '',       // Leftover
  '¿': '',       // Leftover
  '©': '',       // Leftover
};

/**
 * Fix corrupted Korean text from encoding issues
 */
export function sanitizeKoreanText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let result = text;
  for (const [corrupted, correct] of Object.entries(CORRUPTION_MAP)) {
    result = result.replace(new RegExp(corrupted, 'g'), correct);
  }

  return result.trim();
}

/**
 * Unit mapping: English → Korean (for Coupang attributes)
 */
const UNIT_MAPPING: Record<string, string> = {
  // Tablets/Pills
  'tablet': '정',
  'tablets': '정',
  'tab': '정',
  'tabs': '정',
  'pill': '정',
  'pills': '정',
  'ct': '정',
  'count': '정',

  // Capsules
  'capsule': '캡슐',
  'capsules': '캡슐',
  'cap': '캡슐',
  'caps': '캡슐',
  'vcaps': '캡슐',
  'vcap': '캡슐',
  'softgel': '캡슐',
  'softgels': '캡슐',

  // Pieces/Units
  'piece': '개',
  'pieces': '개',
  'pcs': '개',
  'pc': '개',
  'ea': '개',
  'unit': '개',
  'units': '개',

  // Packs
  'pack': '팩',
  'packs': '팩',
  'packet': '팩',
  'packets': '팩',

  // Bags
  'bag': '봉',
  'bags': '봉',
  'pouch': '봉',
  'pouches': '봉',

  // Weight units (keep as-is, commonly accepted)
  'g': 'g',
  'gram': 'g',
  'grams': 'g',
  'gm': 'g',
  'kg': 'kg',
  'kilogram': 'kg',
  'mg': 'mg',
  'milligram': 'mg',
  'oz': 'oz',
  'ounce': 'oz',
  'lb': 'lb',
  'lbs': 'lb',

  // Volume units
  'ml': 'ml',
  'milliliter': 'ml',
  'l': 'L',
  'liter': 'L',
  'litre': 'L',
  'fl oz': 'oz',
  'fl': 'ml',
};

/**
 * Normalize attribute value with proper Korean units
 * @param value - Raw value like "60 tablet" or "1ê°"
 * @param usableUnits - Valid units from category metadata
 * @returns Normalized value like "60정"
 */
export function normalizeAttributeValue(
  value: string,
  usableUnits: string[] = []
): string {
  if (!value) return '';

  // First, fix any encoding corruption
  let normalized = sanitizeKoreanText(value);

  // Extract number and unit
  const match = normalized.match(/^([\d.,]+)\s*(.*)$/);
  if (!match) return normalized;

  const [, number, rawUnit] = match;
  const unitLower = rawUnit.toLowerCase().trim();

  // Map to Korean unit if English
  let mappedUnit = UNIT_MAPPING[unitLower] || rawUnit;

  // If unit is empty after mapping, use '개' as default
  if (!mappedUnit || mappedUnit === '') {
    mappedUnit = '개';
  }

  // Validate against usableUnits if provided
  if (usableUnits.length > 0) {
    // Check if mapped unit is in usableUnits
    if (usableUnits.includes(mappedUnit)) {
      return `${number}${mappedUnit}`;
    }

    // Try case-insensitive match
    for (const usable of usableUnits) {
      if (usable.toLowerCase() === mappedUnit.toLowerCase()) {
        return `${number}${usable}`;
      }
    }

    // Try to find a compatible unit type
    const isCountType = ['정', '캡슐', '개'].includes(mappedUnit);
    const isWeightType = ['g', 'kg', 'mg', 'lb', 'oz'].includes(mappedUnit);
    const isVolumeType = ['ml', 'L', 'oz'].includes(mappedUnit);

    for (const usable of usableUnits) {
      if (isCountType && ['정', '캡슐', '개'].includes(usable)) {
        console.log(`[Encoding] Remapping unit "${mappedUnit}" to "${usable}" (compatible count type)`);
        return `${number}${usable}`;
      }
      if (isWeightType && ['g', 'kg', 'mg'].includes(usable)) {
        console.log(`[Encoding] Remapping unit "${mappedUnit}" to "${usable}" (compatible weight type)`);
        return `${number}${usable}`;
      }
      if (isVolumeType && ['ml', 'L', 'oz'].includes(usable)) {
        console.log(`[Encoding] Remapping unit "${mappedUnit}" to "${usable}" (compatible volume type)`);
        return `${number}${usable}`;
      }
    }

    // Fallback to first usable unit
    console.warn(`[Encoding] Unit "${rawUnit}" → "${mappedUnit}" not in usableUnits [${usableUnits.join(', ')}], using "${usableUnits[0]}"`);
    return `${number}${usableUnits[0]}`;
  }

  return `${number}${mappedUnit}`;
}

/**
 * Validate a single attribute against category metadata
 */
export function validateAttribute(
  attr: { attributeTypeName: string; attributeValueName: string },
  attrMeta?: { usableUnits?: string[]; attributeValueMetas?: { attributeValueName: string }[] }
): { attributeTypeName: string; attributeValueName: string } {
  let valueName = sanitizeKoreanText(attr.attributeValueName);

  if (attrMeta) {
    const predefinedValues = (attrMeta.attributeValueMetas || []).map(v => v.attributeValueName);
    const usableUnits = attrMeta.usableUnits || [];

    // Check predefined values first
    if (predefinedValues.length > 0) {
      const matched = predefinedValues.find(
        pv => pv.toLowerCase() === valueName.toLowerCase()
      );
      if (matched) {
        valueName = matched;
      } else {
        // Use the most appropriate predefined value
        console.warn(`[Encoding] Value "${valueName}" not in predefined values, using "${predefinedValues[0]}"`);
        valueName = predefinedValues[0];
      }
    } else if (usableUnits.length > 0) {
      // Normalize with usable units
      valueName = normalizeAttributeValue(valueName, usableUnits);
    }
  } else {
    // No metadata, just normalize common units
    valueName = normalizeAttributeValue(valueName);
  }

  return {
    attributeTypeName: sanitizeKoreanText(attr.attributeTypeName).substring(0, 25),
    attributeValueName: valueName.substring(0, 30),
  };
}

/**
 * Validate and sanitize entire product payload before API call
 */
export function sanitizeProductPayload(payload: any): any {
  if (!payload) return payload;

  // Deep clone to avoid mutating original
  const sanitized = JSON.parse(JSON.stringify(payload));

  // Sanitize top-level strings
  if (sanitized.sellerProductName) {
    sanitized.sellerProductName = sanitizeKoreanText(sanitized.sellerProductName);
  }
  if (sanitized.displayProductName) {
    sanitized.displayProductName = sanitizeKoreanText(sanitized.displayProductName);
  }
  if (sanitized.brand) {
    sanitized.brand = sanitizeKoreanText(sanitized.brand);
  }
  if (sanitized.generalProductName) {
    sanitized.generalProductName = sanitizeKoreanText(sanitized.generalProductName);
  }

  // Sanitize items
  if (sanitized.items && Array.isArray(sanitized.items)) {
    sanitized.items = sanitized.items.map((item: any) => {
      if (item.itemName) {
        item.itemName = sanitizeKoreanText(item.itemName);
      }

      // Sanitize attributes - ONLY fix encoding corruption
      // DO NOT re-map units here - they are already validated by buildAttributesFromCategoryMeta
      if (item.attributes && Array.isArray(item.attributes)) {
        item.attributes = item.attributes.map((attr: any) => {
          // Fix encoding corruption ONLY
          const typeName = sanitizeKoreanText(attr.attributeTypeName || '');
          const valueName = sanitizeKoreanText(attr.attributeValueName || '');

          return {
            attributeTypeName: typeName.substring(0, 25),
            attributeValueName: valueName.substring(0, 30),
          };
        });
      }

      // Sanitize notices
      if (item.notices && Array.isArray(item.notices)) {
        item.notices = item.notices.map((notice: any) => ({
          noticeCategoryName: sanitizeKoreanText(notice.noticeCategoryName || ''),
          noticeCategoryDetailName: sanitizeKoreanText(notice.noticeCategoryDetailName || ''),
          content: sanitizeKoreanText(notice.content || ''),
        }));
      }

      // Sanitize search tags
      if (item.searchTags && Array.isArray(item.searchTags)) {
        item.searchTags = item.searchTags.map((tag: string) => sanitizeKoreanText(tag));
      }

      // Sanitize contents (inside each item, per Coupang API spec)
      if (item.contents && Array.isArray(item.contents)) {
        item.contents = item.contents.map((content: any) => {
          if (content.contentDetails && Array.isArray(content.contentDetails)) {
            content.contentDetails = content.contentDetails.map((detail: any) => ({
              ...detail,
              content: detail.detailType === 'TEXT' ? sanitizeKoreanText(detail.content || '') : detail.content,
            }));
          }
          return content;
        });
      }

      return item;
    });
  }

  return sanitized;
}

/**
 * Log attribute validation for debugging
 */
export function logAttributeValidation(
  attributes: any[],
  categoryMeta?: any
): void {
  console.log('[Encoding] === Attribute Validation ===');

  const attrMetas = categoryMeta?.attributeTypeMetas || [];

  for (const attr of attributes) {
    const meta = attrMetas.find((m: any) =>
      m.attributeTypeName === attr.attributeTypeName
    );

    if (meta) {
      const usableUnits = meta.usableUnits || [];
      const isValid = usableUnits.length === 0 ||
        usableUnits.some((u: string) => attr.attributeValueName.includes(u));

      console.log(`[Encoding] ${attr.attributeTypeName}: "${attr.attributeValueName}" ` +
        `[units: ${usableUnits.join(', ') || 'any'}] → ${isValid ? '✓' : '✗'}`);
    } else {
      console.log(`[Encoding] ${attr.attributeTypeName}: "${attr.attributeValueName}" [no meta]`);
    }
  }
}
