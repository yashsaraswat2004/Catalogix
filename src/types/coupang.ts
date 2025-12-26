// ============================================================
// Coupang Open API - Official Type Definitions
// Based on: https://developers.coupangcorp.com/hc/en-us/articles/360033877853-Product-Creation
// ============================================================

// ==================== API REQUEST TYPES ====================

// Main product creation request structure
export interface CoupangProductRequest {
  displayCategoryCode: number;           // Required: Display category code
  sellerProductName: string;             // Required: Product name (max 100 chars)
  vendorId: string;                      // Required: Vendor ID from Wing
  saleStartedAt: string;                 // Required: yyyy-MM-dd'T'HH:mm:ss
  saleEndedAt: string;                   // Required: yyyy-MM-dd'T'HH:mm:ss
  displayProductName?: string;           // Optional: Product name for display (max 100 chars)
  brand?: string;                        // Optional: Brand name
  generalProductName?: string;           // Optional: Product name without options
  productGroup?: string;                 // Optional: Product category
  deliveryMethod: DeliveryMethod;        // Required
  deliveryCompanyCode: string;           // Required: Courier code
  deliveryChargeType: DeliveryChargeType;// Required
  deliveryCharge: number;                // Required: Standard delivery fee
  freeShipOverAmount: number;            // Required: Conditional amount for free delivery
  deliveryChargeOnReturn: number;        // Required: Initial shipping fee on return
  remoteAreaDeliverable: 'Y' | 'N';      // Required
  unionDeliveryType: UnionDeliveryType;  // Required
  returnCenterCode: string;              // Required: Return location center code
  returnChargeName: string;              // Required: Return location name
  companyContactNumber: string;          // Required: Return location contact number
  returnZipCode: string;                 // Required: Return location postal code
  returnAddress: string;                 // Required: Return location address
  returnAddressDetail: string;           // Required: Return location detail address
  returnCharge: number;                  // Required: Return shipping fee
  outboundShippingPlaceCode: number;     // Required for bundled delivery
  vendorUserId: string;                  // Required: Wing login ID
  requested: boolean;                    // Required: Auto approval request
  items: CoupangItem[];                  // Required: Product items/variants
  requiredDocuments?: RequiredDocument[];
  extraInfoMessage?: string;
  manufacture?: string;                  // Manufacturer
  bundleInfo?: { bundleType: 'SINGLE' | 'AB' };
}

// Item (variant/option) structure
export interface CoupangItem {
  itemName: string;                      // Required: Option name (max 150 chars)
  originalPrice: number;                 // Required: Original base price
  salePrice: number;                     // Required: Sale price
  maximumBuyCount: number;               // Required: Inventory quantity (max 99999)
  maximumBuyForPerson: number;           // Required: Max order per person (0 = no limit)
  maximumBuyForPersonPeriod: number;     // Required: Period for max order (1 = no period)
  outboundShippingTimeDay: number;       // Required: Outbound shipping days
  unitCount: number;                     // Required: Unit count
  adultOnly: 'ADULT_ONLY' | 'EVERYONE';  // Required
  taxType: 'TAX' | 'FREE';               // Required
  parallelImported: 'PARALLEL_IMPORTED' | 'NOT_PARALLEL_IMPORTED';  // Required
  overseasPurchased: 'OVERSEAS_PURCHASED' | 'NOT_OVERSEAS_PURCHASED'; // Required
  pccNeeded: boolean;                    // Required: Personal customs clearance code needed
  externalVendorSku?: string;            // Optional: Vendor product code
  barcode?: string;
  emptyBarcode?: boolean;
  emptyBarcodeReason?: string;
  modelNo?: string;
  extraProperties?: Record<string, any>;
  certifications?: Certification[];
  searchTags?: string[];
  images: CoupangImage[];                // Required: At least REPRESENTATION image
  notices?: Notice[];
  attributes: CoupangAttribute[];        // Required: At least one attribute
  contents: CoupangContent[];            // Required
  offerCondition?: OfferCondition;
  offerDescription?: string;
}

export interface CoupangImage {
  imageOrder: number;                    // Required: 0,1,2...
  imageType: 'REPRESENTATION' | 'DETAIL' | 'USED_PRODUCT'; // Required
  cdnPath?: string;                      // At least one of cdnPath or vendorPath required
  vendorPath?: string;                   // At least one of cdnPath or vendorPath required
}

export interface CoupangAttribute {
  attributeTypeName: string;             // Required: Option type name (max 25 chars)
  attributeValueName: string;            // Required: Option value (max 30 chars)
}

export interface CoupangContent {
  contentsType: 'IMAGE' | 'IMAGE_NO_SPACE' | 'TEXT' | 'IMAGE_TEXT' | 'TEXT_IMAGE' | 'IMAGE_IMAGE' | 'TEXT_TEXT' | 'TITLE' | 'HTML';
  contentDetails: ContentDetail[];
}

export interface ContentDetail {
  content: string;
  detailType: 'IMAGE' | 'TEXT';
}

export interface Notice {
  noticeCategoryName: string;
  noticeCategoryDetailName: string;
  content: string;
}

export interface Certification {
  certificationType: string;
  certificationCode: string;
  certificationAttachments?: { vendorPath?: string; cdnPath?: string }[];
}

export interface RequiredDocument {
  templateName?: string;
  documentPath?: string;
  vendorDocumentPath?: string;
}

// Enums
export type DeliveryMethod = 'SEQUENCIAL' | 'COLD_FRESH' | 'MAKE_ORDER' | 'AGENT_BUY' | 'VENDOR_DIRECT';
export type DeliveryChargeType = 'FREE' | 'NOT_FREE' | 'CHARGE_RECEIVED' | 'CONDITIONAL_FREE';
export type UnionDeliveryType = 'UNION_DELIVERY' | 'NOT_UNION_DELIVERY';
export type OfferCondition = 'NEW' | 'REFURBISHED' | 'USED_BEST' | 'USED_GOOD' | 'USED_NORMAL';

// ==================== INTERNAL APP TYPES ====================

// Our internal product representation (parsed from XLSM)
export interface CoupangProduct {
  // Basic Info
  category: string;              // Category code or path
  productName: string;           // sellerProductName
  saleStartDate: string;
  saleEndDate: string;
  productStatus: string;
  statusDescription: string;
  brand: string;
  manufacturer: string;
  searchKeywords: string;

  // Purchase Options (attributes)
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
  discountBasePrice: number;     // Original Price (Required)
  stockQuantity: number;         // maximumBuyCount (Required)
  leadTime: number;              // outboundShippingTimeDay (Required)
  maxPurchasePerPerson: number;  // maximumBuyForPerson
  maxPurchasePeriod: number;     // maximumBuyForPersonPeriod
  adultOnly: boolean;
  taxable: boolean;
  parallelImport: boolean;
  overseasPurchase: boolean;
  vendorProductCode: string;     // externalVendorSku
  modelNumber: string;
  barcode: string;

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
  mainImage: string;             // Required: REPRESENTATION image
  additionalImages: string[];    // Optional: DETAIL images
  conditionImages: string[];     // Optional: USED_PRODUCT images

  // Product Description
  detailedDescription: string;   // Required

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
  cellReference?: string;
  columnIndex?: number;
}

// Excel column letter conversion helper
export function getExcelColumnLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

// Editable fields in the platform
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
  'optionType1',
  'optionValue1',
  'optionType2',
  'optionValue2',
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

// Wing Account Settings (required for API calls)
// Note: returnCharge and deliveryChargeOnReturn are product-level fields, not here
export interface WingSettings {
  // Return Location Info
  returnCenterCode: string;
  returnChargeName: string;
  companyContactNumber: string;
  returnZipCode: string;
  returnAddress: string;
  returnAddressDetail: string;
  
  // Shipping Info
  outboundShippingPlaceCode: string;
  deliveryCompanyCode: string;
  
  // Vendor Info
  vendorUserId: string;
}

export interface CoupangApiCredentials {
  accessKey: string;
  secretKey: string;
  vendorId: string;
}

// Required fields from XLSM (for validation)
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

// Required Wing settings (must be configured before upload)
export const REQUIRED_WING_SETTINGS: (keyof WingSettings)[] = [
  'returnCenterCode',
  'returnChargeName',
  'companyContactNumber',
  'returnZipCode',
  'returnAddress',
  'returnAddressDetail',
  'outboundShippingPlaceCode',
  'deliveryCompanyCode',
  'vendorUserId',
];

// Courier codes supported by Coupang
export const COURIER_CODES: Record<string, string> = {
  'CJGLS': 'CJ Logistics (CJ대한통운)',
  'KDEXP': 'Hanjin (한진택배)',
  'EPOST': 'Korea Post (우체국택배)',
  'LOGEN': 'Logen (로젠택배)',
  'KGB': 'KGB (KGB택배)',
  'HYUNDAI': 'Hyundai (현대택배)',
  'ILYANG': 'Ilyang (일양택배)',
  'CHUNIL': 'Chunil (천일택배)',
  'DONGBU': 'Dongbu (동부익스프레스)',
  'CVS': 'CVS Convenience (편의점택배)',
  'DIRECT': 'Direct Delivery (직접배송)',
};

// Column mapping from Korean headers to internal fields
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

// Korean field labels
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

// English field labels
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
  leadTime: 'Lead Time (Days)',
  maxPurchasePerPerson: 'Max Per Person',
  maxPurchasePeriod: 'Max Purchase Period',
  adultOnly: 'Adult Only',
  taxable: 'Taxable',
  parallelImport: 'Parallel Import',
  overseasPurchase: 'Overseas Purchase',
  vendorProductCode: 'Vendor SKU',
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

// Wing settings labels
export const WING_SETTINGS_LABELS: Record<keyof WingSettings, string> = {
  returnCenterCode: 'Return Center Code',
  returnChargeName: 'Return Location Name',
  companyContactNumber: 'Contact Number',
  returnZipCode: 'Return Postal Code',
  returnAddress: 'Return Address',
  returnAddressDetail: 'Return Address Detail',
  outboundShippingPlaceCode: 'Shipping Place Code',
  deliveryCompanyCode: 'Courier Code',
  vendorUserId: 'Wing Login ID',
};
