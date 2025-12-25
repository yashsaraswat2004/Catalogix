// Coupang Product Types based on the official XLSM template

export interface CoupangProduct {
  // Basic Info
  category: string;              // Category (Required)
  productName: string;           // Product Name (Required)
  saleStartDate: string;         // Sale Start Date
  saleEndDate: string;           // Sale End Date
  productStatus: string;         // Product Status
  statusDescription: string;     // Status Description
  brand: string;                 // Brand (Required)
  manufacturer: string;          // Manufacturer (Required)
  searchKeywords: string;        // Search Keywords

  // Purchase Options
  optionType1: string;
  optionValue1: string;
  optionType2: string;
  optionValue2: string;
  optionType3: string;
  optionValue3: string;
  optionType4: string;
  optionValue4: string;

  // Search Options
  searchOptionType1: string;
  searchOptionValue1: string;
  searchOptionType2: string;
  searchOptionValue2: string;
  searchOptionType3: string;
  searchOptionValue3: string;
  searchOptionType4: string;
  searchOptionValue4: string;

  // Configuration
  salePrice: number;             // Sale Price (Required)
  discountBasePrice: number;     // Discount Base Price (Required)
  stockQuantity: number;         // Stock Quantity (Required)
  leadTime: number;              // Lead Time (Required)
  maxPurchasePerPerson: number;  // Max Purchase Per Person
  maxPurchasePeriod: number;     // Max Purchase Period (Days)
  adultOnly: boolean;            // Adult Only (19+)
  taxable: boolean;              // Taxable
  parallelImport: boolean;       // Parallel Import
  overseasPurchase: boolean;     // Overseas Purchase Agency
  vendorProductCode: string;     // Vendor Product Code
  modelNumber: string;           // Model Number
  barcode: string;               // Barcode

  // Certification Info
  certInfoType1: string;
  certInfoValue1: string;
  certInfoType2: string;
  certInfoValue2: string;
  certInfoType3: string;
  certInfoValue3: string;

  // Notice Info
  noticeCategory: string;
  noticeValues: string[];

  // Images
  mainImage: string;             // Main Image (Required)
  additionalImages: string[];    // Additional Images
  conditionImages: string[];     // Condition Images (Used)

  // Product Description
  detailedDescription: string;   // Detailed Description (Required)

  // Documents
  documents: string[];
}

export interface ParsedProduct {
  id: string;
  rowIndex: number;
  data: Partial<CoupangProduct>;
  validationErrors: ValidationError[];
  status: 'pending' | 'validated' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
  coupangProductId?: string;
}

export interface ValidationError {
  field: string;
  fieldLabel: string;
  message: string;
  severity: 'error' | 'warning';
  cellReference?: string;  // Excel cell reference like "A4", "Z10"
  columnIndex?: number;    // 0-based column index
}

// Excel column letter conversion helper
export function getExcelColumnLetter(index: number): string {
  let result = '';
  while (index >= 0) {
    result = String.fromCharCode((index % 26) + 65) + result;
    index = Math.floor(index / 26) - 1;
  }
  return result;
}

// Editable fields that users can modify in the platform
export const EDITABLE_FIELDS: (keyof CoupangProduct)[] = [
  'productName',
  'brand',
  'manufacturer',
  'salePrice',
  'discountBasePrice',
  'stockQuantity',
  'leadTime',
  'maxPurchasePerPerson',
  'maxPurchasePeriod',
  'vendorProductCode',
  'modelNumber',
  'barcode',
  'mainImage',
  'detailedDescription',
];

export interface UploadSession {
  id: string;
  fileName: string;
  uploadedAt: Date;
  totalProducts: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  status: 'processing' | 'completed' | 'failed';
  products: ParsedProduct[];
}

export interface CoupangApiCredentials {
  accessKey: string;
  secretKey: string;
  vendorId: string;
}

// Column mapping from Korean headers to our internal fields
export const COLUMN_MAPPING: Record<string, keyof CoupangProduct> = {
  '카테고리': 'category',
  '등록상품명': 'productName',
  '판매시작일': 'saleStartDate',
  '판매종료일': 'saleEndDate',
  '상품상태': 'productStatus',
  '상태설명': 'statusDescription',
  '브랜드': 'brand',
  '제조사': 'manufacturer',
  '검색어': 'searchKeywords',
  '판매가격': 'salePrice',
  '할인율기준가': 'discountBasePrice',
  '재고수량': 'stockQuantity',
  '출고리드타임': 'leadTime',
  '인당최대구매수량': 'maxPurchasePerPerson',
  '최대구매수량기간(일)': 'maxPurchasePeriod',
  '성인상품(19)': 'adultOnly',
  '과세여부': 'taxable',
  '병행수입여부': 'parallelImport',
  '해외구매대행': 'overseasPurchase',
  '업체상품코드': 'vendorProductCode',
  '모델번호': 'modelNumber',
  '바코드': 'barcode',
  '대표(옵션)이미지': 'mainImage',
  '상세 설명': 'detailedDescription',
};

export const REQUIRED_FIELDS: (keyof CoupangProduct)[] = [
  'category',
  'productName',
  'brand',
  'manufacturer',
  'salePrice',
  'discountBasePrice',
  'stockQuantity',
  'leadTime',
  'mainImage',
  'detailedDescription',
];

// Korean field labels (for reference with XLSM files)
export const FIELD_LABELS: Record<keyof CoupangProduct, string> = {
  category: '카테고리',
  productName: '등록상품명',
  saleStartDate: '판매시작일',
  saleEndDate: '판매종료일',
  productStatus: '상품상태',
  statusDescription: '상태설명',
  brand: '브랜드',
  manufacturer: '제조사',
  searchKeywords: '검색어',
  optionType1: '옵션유형1',
  optionValue1: '옵션값1',
  optionType2: '옵션유형2',
  optionValue2: '옵션값2',
  optionType3: '옵션유형3',
  optionValue3: '옵션값3',
  optionType4: '옵션유형4',
  optionValue4: '옵션값4',
  searchOptionType1: '검색옵션유형1',
  searchOptionValue1: '검색옵션값1',
  searchOptionType2: '검색옵션유형2',
  searchOptionValue2: '검색옵션값2',
  searchOptionType3: '검색옵션유형3',
  searchOptionValue3: '검색옵션값3',
  searchOptionType4: '검색옵션유형4',
  searchOptionValue4: '검색옵션값4',
  salePrice: '판매가격',
  discountBasePrice: '할인율기준가',
  stockQuantity: '재고수량',
  leadTime: '출고리드타임',
  maxPurchasePerPerson: '인당최대구매수량',
  maxPurchasePeriod: '최대구매수량기간',
  adultOnly: '성인상품',
  taxable: '과세여부',
  parallelImport: '병행수입여부',
  overseasPurchase: '해외구매대행',
  vendorProductCode: '업체상품코드',
  modelNumber: '모델번호',
  barcode: '바코드',
  certInfoType1: '인증유형1',
  certInfoValue1: '인증값1',
  certInfoType2: '인증유형2',
  certInfoValue2: '인증값2',
  certInfoType3: '인증유형3',
  certInfoValue3: '인증값3',
  noticeCategory: '고시정보 카테고리',
  noticeValues: '고시정보값',
  mainImage: '대표이미지',
  additionalImages: '추가이미지',
  conditionImages: '상태이미지',
  detailedDescription: '상세설명',
  documents: '구비서류',
};

// English field labels (for UI display)
export const FIELD_LABELS_EN: Record<keyof CoupangProduct, string> = {
  category: 'Category',
  productName: 'Product Name',
  saleStartDate: 'Sale Start Date',
  saleEndDate: 'Sale End Date',
  productStatus: 'Product Status',
  statusDescription: 'Status Description',
  brand: 'Brand',
  manufacturer: 'Manufacturer',
  searchKeywords: 'Search Keywords',
  optionType1: 'Option Type 1',
  optionValue1: 'Option Value 1',
  optionType2: 'Option Type 2',
  optionValue2: 'Option Value 2',
  optionType3: 'Option Type 3',
  optionValue3: 'Option Value 3',
  optionType4: 'Option Type 4',
  optionValue4: 'Option Value 4',
  searchOptionType1: 'Search Option Type 1',
  searchOptionValue1: 'Search Option Value 1',
  searchOptionType2: 'Search Option Type 2',
  searchOptionValue2: 'Search Option Value 2',
  searchOptionType3: 'Search Option Type 3',
  searchOptionValue3: 'Search Option Value 3',
  searchOptionType4: 'Search Option Type 4',
  searchOptionValue4: 'Search Option Value 4',
  salePrice: 'Sale Price',
  discountBasePrice: 'Discount Base Price',
  stockQuantity: 'Stock Quantity',
  leadTime: 'Lead Time',
  maxPurchasePerPerson: 'Max Purchase Per Person',
  maxPurchasePeriod: 'Max Purchase Period',
  adultOnly: 'Adult Only',
  taxable: 'Taxable',
  parallelImport: 'Parallel Import',
  overseasPurchase: 'Overseas Purchase',
  vendorProductCode: 'Vendor Product Code',
  modelNumber: 'Model Number',
  barcode: 'Barcode',
  certInfoType1: 'Cert Type 1',
  certInfoValue1: 'Cert Value 1',
  certInfoType2: 'Cert Type 2',
  certInfoValue2: 'Cert Value 2',
  certInfoType3: 'Cert Type 3',
  certInfoValue3: 'Cert Value 3',
  noticeCategory: 'Notice Category',
  noticeValues: 'Notice Values',
  mainImage: 'Main Image',
  additionalImages: 'Additional Images',
  conditionImages: 'Condition Images',
  detailedDescription: 'Detailed Description',
  documents: 'Documents',
};