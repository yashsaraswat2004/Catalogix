import * as XLSX from 'xlsx';
import { ParsedProduct, ValidationError, REQUIRED_FIELDS, FIELD_LABELS_EN, CoupangProduct } from '@/types/coupang';

// Column indices based on the Coupang template structure
const COLUMN_INDICES = {
  category: 0,           // Category
  productName: 1,        // Product Name
  saleStartDate: 2,      // Sale Start Date
  saleEndDate: 3,        // Sale End Date
  productStatus: 4,      // Product Status
  statusDescription: 5,  // Status Description
  brand: 6,              // Brand
  manufacturer: 7,       // Manufacturer
  searchKeywords: 8,     // Search Keywords
  
  // Purchase Options (9-16)
  optionType1: 9,
  optionValue1: 10,
  optionType2: 11,
  optionValue2: 12,
  optionType3: 13,
  optionValue3: 14,
  optionType4: 15,
  optionValue4: 16,
  
  // Search Options (17-24)
  searchOptionType1: 17,
  searchOptionValue1: 18,
  searchOptionType2: 19,
  searchOptionValue2: 20,
  searchOptionType3: 21,
  searchOptionValue3: 22,
  searchOptionType4: 23,
  searchOptionValue4: 24,
  
  // Configuration (25-37)
  salePrice: 25,
  discountBasePrice: 26,
  stockQuantity: 27,
  leadTime: 28,
  maxPurchasePerPerson: 29,
  maxPurchasePeriod: 30,
  adultOnly: 31,
  taxable: 32,
  parallelImport: 33,
  overseasPurchase: 34,
  vendorProductCode: 35,
  modelNumber: 36,
  barcode: 37,
  
  // Certification Info (38-51)
  certInfoType1: 38,
  certInfoValue1: 39,
  // ... more cert fields
  
  // Notice Info (52-66)
  noticeCategory: 52,
  noticeValue1: 53,
  noticeValue2: 54,
  // ... more notice values
  
  // Images (67-69)
  mainImage: 67,
  additionalImages: 68,
  conditionImages: 69,
  
  // Detailed Description (70)
  detailedDescription: 70,
  
  // Documents (71-77)
  document1: 71,
  document2: 72,
  document3: 73,
  document4: 74,
  document5: 75,
  document6: 76,
  document7: 77,
};

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
  
  const validationErrors = validateProduct(data);
  
  return {
    id: `product-${rowIndex}-${Date.now()}`,
    rowIndex,
    data,
    validationErrors,
    status: validationErrors.some(e => e.severity === 'error') ? 'pending' : 'validated',
  };
}

function validateProduct(data: Partial<CoupangProduct>): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Check required fields
  REQUIRED_FIELDS.forEach(field => {
    const value = data[field];
    if (value === undefined || value === null || value === '' || 
        (typeof value === 'number' && value === 0 && field !== 'maxPurchasePerPerson' && field !== 'maxPurchasePeriod')) {
      errors.push({
        field,
        fieldLabel: FIELD_LABELS_EN[field],
        message: `${FIELD_LABELS_EN[field]} is required`,
        severity: 'error',
      });
    }
  });
  
  // Validate price - sale price should not exceed discount base price
  if (data.salePrice && data.discountBasePrice && data.salePrice > data.discountBasePrice) {
    errors.push({
      field: 'salePrice',
      fieldLabel: FIELD_LABELS_EN.salePrice,
      message: 'Sale price exceeds discount base price',
      severity: 'warning',
    });
  }
  
  // Validate image URL format
  if (data.mainImage && !isValidUrl(data.mainImage)) {
    errors.push({
      field: 'mainImage',
      fieldLabel: FIELD_LABELS_EN.mainImage,
      message: 'Invalid image URL format',
      severity: 'error',
    });
  }
  
  // Validate stock quantity
  if (data.stockQuantity !== undefined && data.stockQuantity < 0) {
    errors.push({
      field: 'stockQuantity',
      fieldLabel: FIELD_LABELS_EN.stockQuantity,
      message: 'Stock quantity must be 0 or greater',
      severity: 'error',
    });
  }
  
  // Validate lead time (must be positive)
  if (data.leadTime !== undefined && data.leadTime < 1) {
    errors.push({
      field: 'leadTime',
      fieldLabel: FIELD_LABELS_EN.leadTime,
      message: 'Lead time must be at least 1 day',
      severity: 'error',
    });
  }
  
  // Validate sale price (must be positive)
  if (data.salePrice !== undefined && data.salePrice <= 0) {
    errors.push({
      field: 'salePrice',
      fieldLabel: FIELD_LABELS_EN.salePrice,
      message: 'Sale price must be greater than 0',
      severity: 'error',
    });
  }
  
  // Validate discount base price (must be positive)
  if (data.discountBasePrice !== undefined && data.discountBasePrice <= 0) {
    errors.push({
      field: 'discountBasePrice',
      fieldLabel: FIELD_LABELS_EN.discountBasePrice,
      message: 'Discount base price must be greater than 0',
      severity: 'error',
    });
  }
  
  // Validate product name length (Coupang has limits)
  if (data.productName && data.productName.length > 100) {
    errors.push({
      field: 'productName',
      fieldLabel: FIELD_LABELS_EN.productName,
      message: 'Product name exceeds 100 characters',
      severity: 'warning',
    });
  }
  
  // Validate category is not empty and looks valid
  if (data.category && !/^\d+$/.test(data.category.replace(/\s/g, '').split('>').pop() || '')) {
    // Category should end with a numeric code in Coupang format
    // This is a soft warning as category format varies
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