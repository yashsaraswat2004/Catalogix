// Coupang Product Types based on the official XLSM template

export interface CoupangProduct {
  // 기본정보 (Basic Info)
  category: string;              // 카테고리 (필수)
  productName: string;           // 등록상품명 (필수)
  saleStartDate: string;         // 판매시작일
  saleEndDate: string;           // 판매종료일
  productStatus: string;         // 상품상태
  statusDescription: string;     // 상태설명
  brand: string;                 // 브랜드 (필수)
  manufacturer: string;          // 제조사 (필수)
  searchKeywords: string;        // 검색어

  // 구매옵션 (Purchase Options)
  optionType1: string;
  optionValue1: string;
  optionType2: string;
  optionValue2: string;
  optionType3: string;
  optionValue3: string;
  optionType4: string;
  optionValue4: string;

  // 검색옵션 (Search Options)
  searchOptionType1: string;
  searchOptionValue1: string;
  searchOptionType2: string;
  searchOptionValue2: string;
  searchOptionType3: string;
  searchOptionValue3: string;
  searchOptionType4: string;
  searchOptionValue4: string;

  // 구성 정보 (Configuration)
  salePrice: number;             // 판매가격 (필수)
  discountBasePrice: number;     // 할인율기준가 (필수)
  stockQuantity: number;         // 재고수량 (필수)
  leadTime: number;              // 출고리드타임 (필수)
  maxPurchasePerPerson: number;  // 인당최대구매수량
  maxPurchasePeriod: number;     // 최대구매수량기간(일)
  adultOnly: boolean;            // 성인상품(19)
  taxable: boolean;              // 과세여부
  parallelImport: boolean;       // 병행수입여부
  overseasPurchase: boolean;     // 해외구매대행
  vendorProductCode: string;     // 업체상품코드
  modelNumber: string;           // 모델번호
  barcode: string;               // 바코드

  // 인증 정보 (Certification)
  certInfoType1: string;
  certInfoValue1: string;
  certInfoType2: string;
  certInfoValue2: string;
  certInfoType3: string;
  certInfoValue3: string;

  // 고시정보 (Notice Info)
  noticeCategory: string;
  noticeValues: string[];

  // 이미지 (Images)
  mainImage: string;             // 대표(옵션)이미지 (필수)
  additionalImages: string[];    // 추가이미지
  conditionImages: string[];     // 상태이미지(중고상품)

  // 상품 상세 설명 (Product Description)
  detailedDescription: string;   // 상세 설명 (필수)

  // 구비서류 (Documents)
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
}

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
