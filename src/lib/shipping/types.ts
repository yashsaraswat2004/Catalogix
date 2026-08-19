export interface RawAddress {
  asitAddress?: string;
  zipcode?: string;
  productName?: string;
  productPrice?: string;
  companyName?: string;
}

export interface FormattedAddress {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  phone: string;
}

export interface OrderData {
  rawAddress: RawAddress;
  formattedAddress: FormattedAddress | null;
}

export interface CN22LabelData {
  productName?: string;
  productPrice?: string;
}

export interface CoupangRow {
  optionPBuyer: string;
  buyerPf: string;
  recipienZipcode: string;
  zipcode: string;
  recipienDelivery: string;
  recipientName: string;
  asItAddress: string;
  personalContact: string;
  shipmen: string;
  [key: string]: unknown;
}

export interface IndiaPostRow {
  orderNumber: string;
  barcode: string;
  weight: string;
  zipcode: string;
  buyerPhoneNum: string;
  registeredProduct: string;
  registered: string;
  recipientAddress: string;
  country: string;
  state: string;
  receiverCity: string;
  receiverPincode: string;
  receiverName: string;
  receiverAddLine1: string;
  receiverAddLine2: string;
  receiverMobileNo: string;
}

export interface ProcessedCoupangData {
  rawData: CoupangRow;
  translatedProduct?: string;
  translatedOption?: string;
  parsedAddress?: {
    name: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
  };
  indiaPostRow?: IndiaPostRow;
}
