import * as XLSX from 'xlsx';
import { ParsedProduct, ValidationError, REQUIRED_FIELDS, FIELD_LABELS_EN, CoupangProduct, getExcelColumnLetter } from '@/types/coupang';

// English column headers mapping to CoupangProduct fields
export const ENGLISH_COLUMN_MAPPING: Record<string, keyof CoupangProduct> = {
  // Variant grouping
  'product group': 'productGroup',
  'product_group': 'productGroup',
  'variant group': 'productGroup',
  'group': 'productGroup',

  // Required fields
  'category': 'category',
  'category code': 'category',
  'product name': 'productName',
  'product_name': 'productName',
  'name': 'productName',
  'title': 'productName',
  'brand': 'brand',
  'brand name': 'brand',
  'manufacturer': 'manufacturer',
  'maker': 'manufacturer',

  // Pricing
  'sale price': 'salePrice',
  'sale_price': 'salePrice',
  'price': 'salePrice',
  'selling price': 'salePrice',
  'discount base price': 'discountBasePrice',
  'discount_base_price': 'discountBasePrice',
  'original price': 'discountBasePrice',
  'list price': 'discountBasePrice',
  'msrp': 'discountBasePrice',

  // Inventory
  'stock': 'stockQuantity',
  'stock quantity': 'stockQuantity',
  'stock_quantity': 'stockQuantity',
  'inventory': 'stockQuantity',

  // Shipping
  'lead time': 'leadTime',
  'lead_time': 'leadTime',
  'shipping days': 'leadTime',
  'processing time': 'leadTime',
  'delivery days': 'leadTime',

  // Limits
  'max purchase per person': 'maxPurchasePerPerson',
  'max_purchase_per_person': 'maxPurchasePerPerson',
  'purchase limit': 'maxPurchasePerPerson',
  'max purchase period': 'maxPurchasePeriod',
  'max_purchase_period': 'maxPurchasePeriod',

  // Dates
  'sale start date': 'saleStartDate',
  'sale_start_date': 'saleStartDate',
  'start date': 'saleStartDate',
  'sale end date': 'saleEndDate',
  'sale_end_date': 'saleEndDate',
  'end date': 'saleEndDate',

  // Product details
  'search keywords': 'searchKeywords',
  'search_keywords': 'searchKeywords',
  'keywords': 'searchKeywords',
  'tags': 'searchKeywords',

  // Options
  // Required Attributes
  'quantity': 'quantity',
  'qty': 'quantity',
  '수량': 'quantity',
  'volume': 'volume',
  'capacity': 'volume',
  '용량': 'volume',
  '개당 용량': 'volume',
  'weight': 'weight',
  'wt': 'weight',
  '중량': 'weight',
  '개당 중량': 'weight',

  'option type 1': 'optionType1',
  'option_type_1': 'optionType1',
  'option1 type': 'optionType1',
  'option value 1': 'optionValue1',
  'option_value_1': 'optionValue1',
  'option1 value': 'optionValue1',
  'option type 2': 'optionType2',
  'option_type_2': 'optionType2',
  'option value 2': 'optionValue2',
  'option_value_2': 'optionValue2',
  'option type 3': 'optionType3',
  'option_type_3': 'optionType3',
  'option value 3': 'optionValue3',
  'option_value_3': 'optionValue3',
  'option type 4': 'optionType4',
  'option_type_4': 'optionType4',
  'option value 4': 'optionValue4',
  'option_value_4': 'optionValue4',

  // Flags
  'adult only': 'adultOnly',
  'adult_only': 'adultOnly',
  'taxable': 'taxable',
  'tax': 'taxable',
  'parallel import': 'parallelImport',
  'parallel_import': 'parallelImport',
  'overseas purchase': 'overseasPurchase',
  'overseas_purchase': 'overseasPurchase',

  // Identifiers
  'vendor product code': 'vendorProductCode',
  'vendor_product_code': 'vendorProductCode',
  'sku': 'vendorProductCode',
  'product code': 'vendorProductCode',
  'model number': 'modelNumber',
  'model_number': 'modelNumber',
  'model': 'modelNumber',
  'barcode': 'barcode',
  'upc': 'barcode',
  'ean': 'barcode',

  // Images
  'main image': 'mainImage',
  'main_image': 'mainImage',
  'image': 'mainImage',
  'image url': 'mainImage',
  'primary image': 'mainImage',
  'additional images': 'additionalImages',
  'additional_images': 'additionalImages',
  'extra images': 'additionalImages',
  'additional image': 'additionalImages',
  'additional_image': 'additionalImages',

  // Description
  'description': 'detailedDescription',
  'detailed description': 'detailedDescription',
  'detailed_description': 'detailedDescription',
  'product description': 'detailedDescription',
  'long description': 'detailedDescription',
};

// Fields that need translation from English to Korean
export const TRANSLATABLE_FIELDS: (keyof CoupangProduct)[] = [
  'productName',
  'brand',
  'manufacturer',
  'searchKeywords',
  'optionType1',
  'optionValue1',
  'optionType2',
  'optionValue2',
  'optionType3',
  'optionValue3',
  'optionType4',
  'optionValue4',
  'detailedDescription',
];

function getCellReference(columnIndex: number, rowIndex: number): string {
  return `${getExcelColumnLetter(columnIndex)}${rowIndex}`;
}

export function parseCsvFile(file: File): Promise<ParsedProduct[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to array of arrays
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: ''
        });

        if (jsonData.length < 2) {
          reject(new Error('CSV file must have at least a header row and one data row'));
          return;
        }

        // First row is headers
        const headers = jsonData[0].map((h: any) => String(h).toLowerCase().trim());
        const dataRows = jsonData.slice(1);

        // Map headers to field indices
        const fieldIndices: Map<keyof CoupangProduct, number> = new Map();
        headers.forEach((header: string, index: number) => {
          const field = ENGLISH_COLUMN_MAPPING[header];
          if (field) {
            fieldIndices.set(field, index);
          }
        });

        // Scan for individual "Additional Image N" columns (e.g. "additional image 1", "additional image 2")
        const additionalImageIndices: number[] = [];
        headers.forEach((header: string, index: number) => {
          // Match patterns like "additional image 1", "additional_image_2", "extra image 3"
          if (/^(additional[_ ]image|extra[_ ]image)[_ ]?\d*$/.test(header)) {
            additionalImageIndices.push(index);
          }
        });
        // Store on the map for use in parseRowWithMapping
        (fieldIndices as any)._additionalImageIndices = additionalImageIndices;
        if (additionalImageIndices.length > 0) {
          console.log(`[CSV Parser] Found ${additionalImageIndices.length} additional image column(s) at indices: ${additionalImageIndices.join(', ')}`);
        }

        const products: ParsedProduct[] = dataRows
          .filter(row => row.some((cell: any) => cell !== '' && cell !== null && cell !== undefined))
          .map((row, index) => parseRowWithMapping(row, index + 2, fieldIndices, headers)); // +2 for 1-based indexing + header row

        resolve(products);
      } catch (error) {
        reject(new Error('Error reading CSV file. Please ensure it is a valid CSV format.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Unable to read the file.'));
    };

    reader.readAsArrayBuffer(file);
  });
}

function parseRowWithMapping(
  row: any[],
  rowIndex: number,
  fieldIndices: Map<keyof CoupangProduct, number>,
  headers: string[]
): ParsedProduct {
  const getValue = (field: keyof CoupangProduct): string => {
    const index = fieldIndices.get(field);
    if (index === undefined) return '';
    const value = row[index];
    if (value === null || value === undefined) return '';
    return String(value).trim();
  };

  const getNumberValue = (field: keyof CoupangProduct): number => {
    const value = getValue(field);
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  const getBooleanValue = (field: keyof CoupangProduct): boolean => {
    const value = getValue(field).toLowerCase();
    return value === 'y' || value === 'yes' || value === 'true' || value === '1';
  };

  const data: Partial<CoupangProduct> = {
    productGroup: getValue('productGroup') || undefined,
    category: getValue('category'),
    productName: getValue('productName'),
    saleStartDate: getValue('saleStartDate'),
    saleEndDate: getValue('saleEndDate'),
    brand: getValue('brand'),
    manufacturer: getValue('manufacturer'),
    searchKeywords: getValue('searchKeywords'),

    // Required Attributes
    quantity: getValue('quantity'),
    volume: getValue('volume'),
    weight: getValue('weight'),

    optionType1: getValue('optionType1'),
    optionValue1: getValue('optionValue1'),
    optionType2: getValue('optionType2'),
    optionValue2: getValue('optionValue2'),
    optionType3: getValue('optionType3'),
    optionValue3: getValue('optionValue3'),
    optionType4: getValue('optionType4'),
    optionValue4: getValue('optionValue4'),

    salePrice: getNumberValue('salePrice'),
    discountBasePrice: getNumberValue('discountBasePrice'),
    stockQuantity: getNumberValue('stockQuantity'),
    leadTime: getNumberValue('leadTime') || 1,
    maxPurchasePerPerson: getNumberValue('maxPurchasePerPerson'),
    maxPurchasePeriod: getNumberValue('maxPurchasePeriod') || 1,
    adultOnly: getBooleanValue('adultOnly'),
    taxable: getBooleanValue('taxable'),
    parallelImport: getBooleanValue('parallelImport'),
    overseasPurchase: getBooleanValue('overseasPurchase'),
    vendorProductCode: getValue('vendorProductCode'),
    modelNumber: getValue('modelNumber'),
    barcode: getValue('barcode'),

    mainImage: getValue('mainImage'),
    detailedDescription: getValue('detailedDescription'),

    // Mark that this product needs translation (from English CSV)
    needsTranslation: true,
  };

  // Collect additional images from individual columns (Additional Image 1, Additional Image 2, ...)
  const collectedImages: string[] = [];
  const additionalImageIndices: number[] = (fieldIndices as any)._additionalImageIndices || [];
  for (const imgIdx of additionalImageIndices) {
    const val = row[imgIdx];
    if (val && String(val).trim() && String(val).trim().startsWith('http')) {
      collectedImages.push(String(val).trim());
    }
  }

  // Also collect from a single comma-separated 'additionalImages' column (fallback)
  const addImagesStr = getValue('additionalImages' as keyof CoupangProduct);
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
    console.log(`[CSV Parser] Row ${rowIndex}: Found ${collectedImages.length} additional image(s)`);
  } else {
    data.additionalImages = [];
  }

  const validationErrors = validateProduct(data, rowIndex, fieldIndices);

  return {
    id: `product-${rowIndex}-${Date.now()}`,
    rowIndex,
    data,
    validationErrors,
    status: validationErrors.some(e => e.severity === 'error') ? 'pending' : 'validated',
  };
}

function validateProduct(
  data: Partial<CoupangProduct>,
  rowIndex: number,
  fieldIndices: Map<keyof CoupangProduct, number>
): ValidationError[] {
  const errors: ValidationError[] = [];

  const createError = (
    field: keyof CoupangProduct,
    message: string,
    severity: 'error' | 'warning'
  ): ValidationError => {
    const columnIndex = fieldIndices.get(field);
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

  // Validate price
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

  // Validate lead time
  if (data.leadTime !== undefined && data.leadTime < 1) {
    errors.push(createError('leadTime', 'Lead time must be at least 1 day', 'error'));
  }

  // Validate sale price
  if (data.salePrice !== undefined && data.salePrice <= 0) {
    errors.push(createError('salePrice', 'Sale price must be greater than 0', 'error'));
  }

  // Validate brand length (max 100 chars for Coupang)
  if (data.brand && data.brand.length > 100) {
    errors.push(createError('brand', 'Brand name exceeds 100 characters', 'error'));
  }

  // Validate product name length
  if (data.productName && data.productName.length > 100) {
    errors.push(createError('productName', 'Product name exceeds 100 characters', 'warning'));
  }

  // Validate required product attributes (quantity, volume/weight)
  if (!data.quantity || !data.quantity.trim()) {
    errors.push(createError('quantity', 'Quantity (수량) is required. Example: "1개", "2개"', 'error'));
  }

  if (!data.volume && !data.weight) {
    errors.push(createError('volume', 'Volume or Weight is required. Example: "30ml", "200g". Shows as "Capacity per unit" on Coupang.', 'warning'));
  }

  return errors;
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return string.startsWith('http://') || string.startsWith('https://');
  }
}

// Check if file is a CSV
export function isCsvFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
}
