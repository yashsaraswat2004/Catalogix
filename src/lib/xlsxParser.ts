import * as XLSX from 'xlsx';
import { ParsedProduct, ValidationError, REQUIRED_FIELDS, FIELD_LABELS_EN, CoupangProduct, getExcelColumnLetter } from '@/types/coupang';

// Column indices based on the Coupang template structure
// These map to exact Excel columns for error reference
export const COLUMN_INDICES: Record<string, number> = {
  category: 0,           // Column A
  productName: 1,        // Column B
  saleStartDate: 2,      // Column C
  saleEndDate: 3,        // Column D
  productStatus: 4,      // Column E
  statusDescription: 5,  // Column F
  brand: 6,              // Column G
  manufacturer: 7,       // Column H
  searchKeywords: 8,     // Column I

  // Purchase Options (9-16)
  optionType1: 9,        // Column J
  optionValue1: 10,      // Column K
  optionType2: 11,       // Column L
  optionValue2: 12,      // Column M
  optionType3: 13,       // Column N
  optionValue3: 14,      // Column O
  optionType4: 15,       // Column P
  optionValue4: 16,      // Column Q

  // Search Options (17-24)
  searchOptionType1: 17, // Column R
  searchOptionValue1: 18,// Column S
  searchOptionType2: 19, // Column T
  searchOptionValue2: 20,// Column U
  searchOptionType3: 21, // Column V
  searchOptionValue3: 22,// Column W
  searchOptionType4: 23, // Column X
  searchOptionValue4: 24,// Column Y

  // Configuration (25-37)
  salePrice: 25,         // Column Z
  discountBasePrice: 26, // Column AA
  stockQuantity: 27,     // Column AB
  leadTime: 28,          // Column AC
  maxPurchasePerPerson: 29, // Column AD
  maxPurchasePeriod: 30, // Column AE
  adultOnly: 31,         // Column AF
  taxable: 32,           // Column AG
  parallelImport: 33,    // Column AH
  overseasPurchase: 34,  // Column AI
  vendorProductCode: 35, // Column AJ
  modelNumber: 36,       // Column AK
  barcode: 37,           // Column AL

  // Certification Info (38-51)
  certInfoType1: 38,     // Column AM
  certInfoValue1: 39,    // Column AN

  // Notice Info (52-66)
  noticeCategory: 52,    // Column BA
  noticeValue1: 53,      // Column BB
  noticeValue2: 54,      // Column BC

  // Images (67-69)
  mainImage: 67,         // Column BP
  additionalImages: 68,  // Column BQ
  conditionImages: 69,   // Column BR

  // Detailed Description (70)
  detailedDescription: 70, // Column BS

  // Documents (71-77)
  document1: 71,
  document2: 72,
  document3: 73,
  document4: 74,
  document5: 75,
  document6: 76,
  document7: 77,
};

// Get cell reference string like "Z4", "AA10"
function getCellReference(columnIndex: number, rowIndex: number): string {
  return `${getExcelColumnLetter(columnIndex)}${rowIndex}`;
}

export function parseXlsxFile(file: File): Promise<ParsedProduct[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        // Find best sheet to use
        let targetSheetName = workbook.SheetNames[0];
        const checkingSheet = workbook.SheetNames.find(n => n.toUpperCase().includes('CHECK'));
        const templateSheet = workbook.SheetNames.find(n => n.toUpperCase().includes('TEMPLATE'));
        if (checkingSheet) targetSheetName = checkingSheet;
        else if (templateSheet) targetSheetName = templateSheet;

        const worksheet = workbook.Sheets[targetSheetName];

        // Convert to array of arrays
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: ''
        });

        // Find header row in the target sheet
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
          const rowStr = JSON.stringify(jsonData[i]);
          // Detect Korean OR English headers
          if (rowStr.includes('등록상품명') || rowStr.includes('등록상품ID') || rowStr.includes('구매옵션유형1')
            || rowStr.includes('Product Name') || rowStr.includes('Category') || rowStr.includes('Sale Price')) {
            headerRowIndex = i;
            break;
          }
        }

        let headers: string[] = [];
        let dataRows: any[][] = [];
        let startIndex = 1; // Excel row number for the first data row

        if (headerRowIndex !== -1) {
          // Headers found in the target sheet
          headers = jsonData[headerRowIndex].map(h => h ? String(h).trim() : '');
          dataRows = jsonData.slice(headerRowIndex + 1);
          startIndex = headerRowIndex + 2;
        } else {
          // No headers in target sheet (e.g., FOR CHECKING sheet)
          // Try reading headers from the Template sheet instead
          if (templateSheet && templateSheet !== targetSheetName) {
            const templateWs = workbook.Sheets[templateSheet];
            const templateData: any[][] = XLSX.utils.sheet_to_json(templateWs, {
              header: 1,
              defval: ''
            });
            // Find header row in Template sheet (usually row 3)
            for (let i = 0; i < Math.min(10, templateData.length); i++) {
              const rowStr = JSON.stringify(templateData[i]);
              if (rowStr.includes('등록상품명') || rowStr.includes('등록상품ID') || rowStr.includes('구매옵션유형1')) {
                headers = templateData[i].map((h: any) => h ? String(h).trim() : '');
                console.log('[Parser] Found headers in Template sheet at row', i);
                break;
              }
            }
          }

          // Data starts at row 0 for headerless sheets
          dataRows = jsonData;
          startIndex = 1;
        }

        // Build a dynamic map of expected fields
        const fieldIndices = new Map<keyof CoupangProduct, number>();

        // Helper to find index by substring of header
        const findColumn = (patterns: string[]): number => {
          return headers.findIndex(h => {
            const lowerH = h.toLowerCase();
            return patterns.some(p => lowerH.includes(p.toLowerCase()));
          });
        };

        // Map columns if headers were found
        if (headers.length > 0) {
          const mapCol = (field: keyof CoupangProduct, patterns: string[]) => {
            const idx = findColumn(patterns);
            if (idx !== -1) fieldIndices.set(field, idx);
          };

          // Variant grouping
          mapCol('productGroup', ['product group', '상품그룹', 'variant group', 'group']);

          // Core fields (Korean + English patterns)
          mapCol('category', ['카테고리', 'category']);
          mapCol('productName', ['등록상품명', '노출상품명', 'product name']);
          mapCol('brand', ['브랜드', 'brand']);
          mapCol('manufacturer', ['제조사', 'manufacturer']);
          mapCol('searchKeywords', ['검색어', 'search keyword', 'search tag']);
          mapCol('salePrice', ['판매가', 'sale price']);
          mapCol('discountBasePrice', ['정상가', '할인가', '할인율기준가', 'discount base price', 'original price']);
          mapCol('stockQuantity', ['재고수량', 'stock', 'inventory']);
          mapCol('mainImage', ['대표이미지', '기본이미지', '메인이미지', '대표(옵션)이미지', 'main image', 'primary image']);
          mapCol('detailedDescription', ['상세설명', '상세페이지', '상세 설명', 'detailed description', 'description']);
          mapCol('modelNumber', ['모델번호', '모델명', 'model number', 'model no']);
          mapCol('barcode', ['바코드', 'barcode']);
          mapCol('vendorProductCode', ['업체상품코드', '판매자상품코드', 'sku', 'vendor product code']);
          mapCol('adultOnly', ['성인상품', 'adult only']);
          mapCol('taxable', ['과세여부', 'taxable']);
          mapCol('parallelImport', ['병행수입', 'parallel import']);
          mapCol('overseasPurchase', ['해외구매대행', 'overseas purchase']);
          mapCol('leadTime', ['출고소요일', 'lead time']);
          mapCol('quantity', ['수량', 'quantity']);
          mapCol('volume', ['용량', 'volume']);
          mapCol('weight', ['중량', 'weight']);

          // Option Types and Values
          mapCol('optionType1', ['구매옵션유형1']);
          mapCol('optionValue1', ['구매옵션값1']);
          mapCol('optionType2', ['구매옵션유형2']);
          mapCol('optionValue2', ['구매옵션값2']);
          mapCol('optionType3', ['구매옵션유형3']);
          mapCol('optionValue3', ['구매옵션값3']);
          mapCol('optionType4', ['구매옵션유형4']);
          mapCol('optionValue4', ['구매옵션값4']);

          // Find additional image columns (Additional Image 1, Additional Image 2, ...)
          // These are separate columns that need to be collected after row parsing
          const additionalImageIndices: number[] = [];
          headers.forEach((h, idx) => {
            const lh = h.toLowerCase();
            if ((lh.includes('additional image') || lh.includes('추가이미지') || lh.includes('상세이미지'))
              && !fieldIndices.has('mainImage' as any)) {
              additionalImageIndices.push(idx);
            } else if ((lh.includes('additional image') || lh.includes('추가이미지') || lh.includes('상세이미지'))) {
              additionalImageIndices.push(idx);
            }
          });
          // Store indices on the map for later use in parseRow
          (fieldIndices as any)._additionalImageIndices = additionalImageIndices;
          if (additionalImageIndices.length > 0) {
            console.log(`[Parser] Found ${additionalImageIndices.length} additional image column(s) at indices: ${additionalImageIndices.join(', ')}`);
          }

          console.log('[Parser] Mapped fields:', Array.from(fieldIndices.entries()).map(([k, v]) => `${k}=${v}`).join(', '));
        } else {
          console.log('[Parser] No headers found, using fallback column indices');
        }

        const products: ParsedProduct[] = dataRows
          .filter(row => row.some(cell => cell !== '' && cell !== null && cell !== undefined))
          .map((row, index) => parseRow(row, index + startIndex, fieldIndices, headers));

        resolve(products);
      } catch (error) {
        console.error('Parse error:', error);
        reject(new Error('Error reading file. Please ensure it is a valid Coupang template.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Unable to read the file.'));
    };

    reader.readAsArrayBuffer(file);
  });
}

function parseRow(
  row: any[],
  rowIndex: number,
  fieldIndices: Map<keyof CoupangProduct, number>,
  headers: string[]
): ParsedProduct {

  const getValueByField = (field: keyof CoupangProduct): string => {
    // If dynamic mapping exists, use it
    if (fieldIndices.has(field)) {
      const idx = fieldIndices.get(field)!;
      const val = row[idx];
      return val !== null && val !== undefined ? String(val).trim() : '';
    }
    // Only use COLUMN_INDICES fallback when NO header mapping was done at all
    // (i.e., the file is a standard product creation template with fixed columns)
    if (fieldIndices.size === 0) {
      const fallbackIdx = COLUMN_INDICES[field];
      if (fallbackIdx !== undefined && fallbackIdx < row.length) {
        const val = row[fallbackIdx];
        return val !== null && val !== undefined ? String(val).trim() : '';
      }
    }
    return '';
  };

  const getNumberValueByField = (field: keyof CoupangProduct, defaultVal: number = 0): number => {
    const valStr = getValueByField(field);
    const parsed = parseFloat(valStr.replace(/[^\d.-]/g, ''));
    return isNaN(parsed) ? defaultVal : parsed;
  };

  const getBooleanValueByField = (field: keyof CoupangProduct): boolean => {
    const value = getValueByField(field).toLowerCase();
    return value === 'y' || value === 'yes' || value === '예' || value === 'true' || value === '1';
  };

  // Extract variables
  const data: Partial<CoupangProduct> = {
    productGroup: getValueByField('productGroup') || undefined,
    category: getValueByField('category'),
    productName: getValueByField('productName'),
    saleStartDate: getValueByField('saleStartDate'),
    saleEndDate: getValueByField('saleEndDate'),
    productStatus: getValueByField('productStatus'),
    statusDescription: getValueByField('statusDescription'),
    brand: getValueByField('brand'),
    manufacturer: getValueByField('manufacturer'),
    searchKeywords: getValueByField('searchKeywords'),

    optionType1: getValueByField('optionType1'),
    optionValue1: getValueByField('optionValue1'),
    optionType2: getValueByField('optionType2'),
    optionValue2: getValueByField('optionValue2'),
    optionType3: getValueByField('optionType3'),
    optionValue3: getValueByField('optionValue3'),
    optionType4: getValueByField('optionType4'),
    optionValue4: getValueByField('optionValue4'),

    salePrice: getNumberValueByField('salePrice'),
    discountBasePrice: getNumberValueByField('discountBasePrice'),
    stockQuantity: getNumberValueByField('stockQuantity'),
    leadTime: getNumberValueByField('leadTime'),
    maxPurchasePerPerson: getNumberValueByField('maxPurchasePerPerson'),
    maxPurchasePeriod: getNumberValueByField('maxPurchasePeriod'),
    adultOnly: getBooleanValueByField('adultOnly'),
    taxable: getBooleanValueByField('taxable'),
    parallelImport: getBooleanValueByField('parallelImport'),
    overseasPurchase: getBooleanValueByField('overseasPurchase'),
    vendorProductCode: getValueByField('vendorProductCode'),
    modelNumber: getValueByField('modelNumber'),
    barcode: getValueByField('barcode'),

    mainImage: getValueByField('mainImage'),
    detailedDescription: getValueByField('detailedDescription'),
    noticeValues: [],
    documents: []
  };

  // Clean up category: extract numeric code from formats like "[56442] 뷰티>메이크업>..."
  if (data.category) {
    const catStr = String(data.category).trim();
    const bracketMatch = catStr.match(/\[(\d+)\]/);
    if (bracketMatch) {
      data.category = bracketMatch[1]; // Extract just "56442"
    } else {
      // If it's already a clean number, keep it
      const numMatch = catStr.match(/^(\d+)/);
      if (numMatch) {
        data.category = numMatch[1];
      }
    }
  }

  // If salePrice wasn't found dynamically but discountBasePrice was, set it
  if (!data.salePrice && data.discountBasePrice) {
    data.salePrice = data.discountBasePrice;
  }
  if (!data.discountBasePrice && data.salePrice) {
    data.discountBasePrice = data.salePrice;
  }

  // Set default prices if totally missing (the update template doesn't have prices)
  if (!data.salePrice) data.salePrice = 10000;
  if (!data.discountBasePrice) data.discountBasePrice = 10000;
  if (!data.stockQuantity) data.stockQuantity = 999;
  if (!data.leadTime) data.leadTime = 1;
  if (!data.mainImage) data.mainImage = 'http://example.com/dummy.jpg'; // Dummy for updates
  if (!data.detailedDescription) data.detailedDescription = data.productName || 'Product detailed description';

  // EXTRACT WEIGHT, VOLUME, QUANTITY from dynamic headers
  // The Update template has headers like "[7823]개당 용량(필수)(기본 단위 : ml)" mapped to columns
  // Track which column indices were used for unit extraction so we don't duplicate them as options
  const unitColumnIndices = new Set<number>();
  let optionIndex = 1;

  // PASS 1: Extract volume, weight, quantity from known unit headers first
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase();
    const cellValue = row[i] ? String(row[i]).trim() : '';

    if (!cellValue) continue;

    // Match volume: 용량, volume, 순 내용 양, 총 용량
    if (header.includes('용량') || header.includes('volume') || header.includes('순 내용 양')) {
      data.volume = cellValue;
      unitColumnIndices.add(i);
    }
    // Match weight: 중량, weight, 순 함량 중량, 총 중량
    else if (header.includes('중량') || header.includes('weight') || header.includes('함량 중량')) {
      data.weight = cellValue;
      unitColumnIndices.add(i);
    }
    // Match quantity: 수량(필수), 수량(기본, quantity, 총 수량
    else if ((header.includes('수량') && (header.includes('필수') || header.includes('기본'))) || header.includes('quantity') || header.includes('총 수량')) {
      data.quantity = cellValue;
      unitColumnIndices.add(i);
    }
  }

  // PASS 2: Map remaining bracket-style headers as options, SKIPPING unit columns
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase();
    const cellValue = row[i] ? String(row[i]).trim() : '';

    if (!cellValue) continue;
    if (optionIndex > 4) break;

    // Skip columns already used for unit extraction
    if (unitColumnIndices.has(i)) continue;

    // Match option-like headers with bracket patterns like "[2439]색상(필수)"
    if ((header.includes('옵션') || (header.includes('[') && header.includes(']'))) && optionIndex <= 4) {
      // Skip known standard fields and ANY unit-related headers
      if (header.includes('용량') || header.includes('중량') || header.includes('수량') ||
        header.includes('카테고리') || header.includes('상품명') || header.includes('브랜드') ||
        header.includes('제조사') || header.includes('검색어') || header.includes('바코드') ||
        header.includes('함량') || header.includes('volume') || header.includes('weight') ||
        header.includes('quantity') || header.includes('총 용량') || header.includes('총 중량')) {
        continue;
      }

      const cleanHeader = headers[i].replace(/\[\d+\]/, '').replace(/\([^)]*\)/g, '').trim();
      if (!cleanHeader) continue;

      // Only add if it doesn't already match existing optionTypes
      if (data.optionType1 !== cleanHeader && data.optionType2 !== cleanHeader &&
        data.optionType3 !== cleanHeader && data.optionType4 !== cleanHeader) {

        if (optionIndex === 1 && !data.optionType1) {
          data.optionType1 = cleanHeader;
          data.optionValue1 = cellValue;
          optionIndex++;
        } else if (optionIndex === 2 && !data.optionType2) {
          data.optionType2 = cleanHeader;
          data.optionValue2 = cellValue;
          optionIndex++;
        } else if (optionIndex === 3 && !data.optionType3) {
          data.optionType3 = cleanHeader;
          data.optionValue3 = cellValue;
          optionIndex++;
        } else if (optionIndex === 4 && !data.optionType4) {
          data.optionType4 = cleanHeader;
          data.optionValue4 = cellValue;
          optionIndex++;
        }
      }
    }
  }

  // Handle additional images
  const collectedImages: string[] = [];

  // Method 1: From individual "Additional Image N" columns
  const additionalImageIndices: number[] = (fieldIndices as any)._additionalImageIndices || [];
  for (const imgIdx of additionalImageIndices) {
    const val = row[imgIdx];
    if (val && String(val).trim() && String(val).trim().startsWith('http')) {
      collectedImages.push(String(val).trim());
    }
  }

  // Method 2: From a single comma-separated 'additionalImages' column (Korean template)
  const addImagesStr = getValueByField('additionalImages');
  if (addImagesStr) {
    addImagesStr.split(',').forEach(s => {
      const trimmed = s.trim();
      if (trimmed && trimmed.startsWith('http') && !collectedImages.includes(trimmed)) {
        collectedImages.push(trimmed);
      }
    });
  }

  if (collectedImages.length > 0) {
    data.additionalImages = collectedImages;
    console.log(`[Parser] Row ${rowIndex}: Found ${collectedImages.length} additional image(s)`);
  }

  const validationErrors = validateProduct(data, rowIndex);

  return {
    id: `product-${rowIndex}-${Date.now()}`,
    rowIndex,
    data,
    validationErrors,
    status: validationErrors.some(e => e.severity === 'error') ? 'pending' : 'validated',
  };
}

function validateProduct(data: Partial<CoupangProduct>, rowIndex: number): ValidationError[] {
  const errors: ValidationError[] = [];

  // Helper to create error with cell reference
  const createError = (
    field: keyof CoupangProduct,
    message: string,
    severity: 'error' | 'warning'
  ): ValidationError => {
    const columnIndex = COLUMN_INDICES[field];
    return {
      field,
      fieldLabel: FIELD_LABELS_EN[field],
      message,
      severity,
      columnIndex,
      cellReference: columnIndex !== undefined ? getCellReference(columnIndex, rowIndex) : undefined,
    };
  };

  // Check required fields
  REQUIRED_FIELDS.forEach(field => {
    const value = data[field];
    if (value === undefined || value === null || value === '' ||
      (typeof value === 'number' && value === 0 && field !== 'maxPurchasePerPerson' && field !== 'maxPurchasePeriod')) {
      errors.push(createError(field, `${FIELD_LABELS_EN[field]} is required`, 'error'));
    }
  });

  // Validate price - sale price should not exceed discount base price
  if (data.salePrice && data.discountBasePrice && data.salePrice > data.discountBasePrice) {
    errors.push(createError('salePrice', 'Sale price exceeds discount base price', 'warning'));
  }

  // Validate image URL format
  if (data.mainImage && !isValidUrl(data.mainImage)) {
    errors.push(createError('mainImage', 'Invalid image URL format', 'error'));
  }

  // Validate stock quantity
  if (data.stockQuantity !== undefined && data.stockQuantity < 0) {
    errors.push(createError('stockQuantity', 'Stock quantity must be 0 or greater', 'error'));
  }

  // Validate lead time (must be positive)
  if (data.leadTime !== undefined && data.leadTime < 1) {
    errors.push(createError('leadTime', 'Lead time must be at least 1 day', 'error'));
  }

  // Validate sale price (must be positive)
  if (data.salePrice !== undefined && data.salePrice <= 0) {
    errors.push(createError('salePrice', 'Sale price must be greater than 0', 'error'));
  }

  // Validate discount base price (must be positive)
  if (data.discountBasePrice !== undefined && data.discountBasePrice <= 0) {
    errors.push(createError('discountBasePrice', 'Discount base price must be greater than 0', 'error'));
  }

  // Validate product name length (Coupang has limits)
  if (data.productName && data.productName.length > 100) {
    errors.push(createError('productName', 'Product name exceeds 100 characters', 'warning'));
  }

  return errors;
}

// Re-validate a single product (for after inline edits)
export function revalidateProduct(product: ParsedProduct): ParsedProduct {
  const validationErrors = validateProduct(product.data, product.rowIndex);
  return {
    ...product,
    validationErrors,
    status: validationErrors.some(e => e.severity === 'error') ? 'pending' : 'validated',
  };
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return string.startsWith('http://') || string.startsWith('https://');
  }
}

export function exportToXlsx(products: ParsedProduct[], filename: string): void {
  const headers = [
    'Category', 'Product Name', 'Brand', 'Manufacturer', 'Sale Price',
    'Discount Base Price', 'Stock Quantity', 'Status', 'Errors/Warnings'
  ];

  const data = products.map(p => [
    p.data.category || '',
    p.data.productName || '',
    p.data.brand || '',
    p.data.manufacturer || '',
    p.data.salePrice || 0,
    p.data.discountBasePrice || 0,
    p.data.stockQuantity || 0,
    p.status,
    p.validationErrors.map(e => e.message).join('; ') || p.errorMessage || ''
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

  XLSX.writeFile(workbook, filename);
}

// --- Variant Grouping ---

export interface VariantGroup {
  groupId: string;                   // Product Group identifier
  parentProduct: ParsedProduct;      // First row = parent (product-level info)
  variants: ParsedProduct[];         // All rows in the group (including parent)
  isMultiVariant: boolean;           // True if 2+ rows share same group
}

/**
 * Group parsed products by their productGroup field.
 * - Products with the same non-empty productGroup → combined into one VariantGroup
 * - Products with empty/missing productGroup → each becomes its own standalone group
 */
export function groupVariants(products: ParsedProduct[]): VariantGroup[] {
  const groupMap = new Map<string, ParsedProduct[]>();
  const standaloneProducts: ParsedProduct[] = [];

  for (const product of products) {
    const groupId = product.data.productGroup?.trim();
    if (groupId) {
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, []);
      }
      groupMap.get(groupId)!.push(product);
    } else {
      standaloneProducts.push(product);
    }
  }

  const result: VariantGroup[] = [];

  // Process grouped products
  for (const [groupId, groupProducts] of groupMap) {
    // Validate: all products in a group must have the same category
    const categories = new Set(groupProducts.map(p => p.data.category).filter(Boolean));
    if (categories.size > 1) {
      console.warn(`[Variants] Group "${groupId}" has mixed categories: ${[...categories].join(', ')}. Using first row's category.`);
    }

    result.push({
      groupId,
      parentProduct: groupProducts[0],
      variants: groupProducts,
      isMultiVariant: groupProducts.length > 1
    });

    console.log(`[Variants] Group "${groupId}": ${groupProducts.length} variant(s)`);
  }

  // Process standalone products (each is its own group)
  for (const product of standaloneProducts) {
    const standaloneId = product.data.vendorProductCode || product.data.productName || `standalone-${product.rowIndex}`;
    result.push({
      groupId: standaloneId,
      parentProduct: product,
      variants: [product],
      isMultiVariant: false
    });
  }

  console.log(`[Variants] Total: ${result.length} product group(s) from ${products.length} row(s). Multi-variant: ${result.filter(g => g.isMultiVariant).length}`);

  return result;
}