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
        
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to array of arrays
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: ''
        });
        
        // Skip header rows (first 3 rows are headers/metadata)
        const dataRows = jsonData.slice(3);
        
        const products: ParsedProduct[] = dataRows
          .filter(row => row.some(cell => cell !== '' && cell !== null && cell !== undefined))
          .map((row, index) => parseRow(row, index + 4)); // +4 for 1-based indexing + 3 header rows
        
        resolve(products);
      } catch (error) {
        reject(new Error('Error reading file. Please ensure it is a valid Coupang template.'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Unable to read the file.'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

function parseRow(row: any[], rowIndex: number): ParsedProduct {
  const getValue = (index: number): string => {
    const value = row[index];
    if (value === null || value === undefined) return '';
    return String(value).trim();
  };
  
  const getNumberValue = (index: number): number => {
    const value = row[index];
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };
  
  const getBooleanValue = (index: number): boolean => {
    const value = getValue(index).toLowerCase();
    return value === 'y' || value === 'yes' || value === '예' || value === 'true' || value === '1';
  };

  const data: Partial<CoupangProduct> = {
    category: getValue(COLUMN_INDICES.category),
    productName: getValue(COLUMN_INDICES.productName),
    saleStartDate: getValue(COLUMN_INDICES.saleStartDate),
    saleEndDate: getValue(COLUMN_INDICES.saleEndDate),
    productStatus: getValue(COLUMN_INDICES.productStatus),
    statusDescription: getValue(COLUMN_INDICES.statusDescription),
    brand: getValue(COLUMN_INDICES.brand),
    manufacturer: getValue(COLUMN_INDICES.manufacturer),
    searchKeywords: getValue(COLUMN_INDICES.searchKeywords),
    
    optionType1: getValue(COLUMN_INDICES.optionType1),
    optionValue1: getValue(COLUMN_INDICES.optionValue1),
    optionType2: getValue(COLUMN_INDICES.optionType2),
    optionValue2: getValue(COLUMN_INDICES.optionValue2),
    optionType3: getValue(COLUMN_INDICES.optionType3),
    optionValue3: getValue(COLUMN_INDICES.optionValue3),
    optionType4: getValue(COLUMN_INDICES.optionType4),
    optionValue4: getValue(COLUMN_INDICES.optionValue4),
    
    salePrice: getNumberValue(COLUMN_INDICES.salePrice),
    discountBasePrice: getNumberValue(COLUMN_INDICES.discountBasePrice),
    stockQuantity: getNumberValue(COLUMN_INDICES.stockQuantity),
    leadTime: getNumberValue(COLUMN_INDICES.leadTime),
    maxPurchasePerPerson: getNumberValue(COLUMN_INDICES.maxPurchasePerPerson),
    maxPurchasePeriod: getNumberValue(COLUMN_INDICES.maxPurchasePeriod),
    adultOnly: getBooleanValue(COLUMN_INDICES.adultOnly),
    taxable: getBooleanValue(COLUMN_INDICES.taxable),
    parallelImport: getBooleanValue(COLUMN_INDICES.parallelImport),
    overseasPurchase: getBooleanValue(COLUMN_INDICES.overseasPurchase),
    vendorProductCode: getValue(COLUMN_INDICES.vendorProductCode),
    modelNumber: getValue(COLUMN_INDICES.modelNumber),
    barcode: getValue(COLUMN_INDICES.barcode),
    
    mainImage: getValue(COLUMN_INDICES.mainImage),
    additionalImages: getValue(COLUMN_INDICES.additionalImages) ? 
      getValue(COLUMN_INDICES.additionalImages).split(',').map(s => s.trim()) : [],
    detailedDescription: getValue(COLUMN_INDICES.detailedDescription),
    
    noticeCategory: getValue(COLUMN_INDICES.noticeCategory),
    noticeValues: [],
  };
  
  // Collect notice values
  const noticeValues: string[] = [];
  for (let i = 53; i <= 66; i++) {
    const val = getValue(i);
    if (val) noticeValues.push(val);
  }
  data.noticeValues = noticeValues;
  
  // Collect documents
  const documents: string[] = [];
  for (let i = 71; i <= 77; i++) {
    const val = getValue(i);
    if (val) documents.push(val);
  }
  data.documents = documents;
  
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