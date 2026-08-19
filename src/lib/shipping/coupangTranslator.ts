import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { CoupangRow, IndiaPostRow, ProcessedCoupangData } from './types';
import { parseAsitAddress } from './addressParser';
import { parseAddressWithGemini, translateWithGemini, getTranslationModel } from './geminiParser';
import { COUPANG_BATCH_SIZE, GEMINI_RATE_LIMIT_MS } from './constants';

let hasLoggedHeaders = false;

function findValue(row: Record<string, unknown>, possibleKeys: string[]): string {
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null) {
      return String(row[key]).trim();
    }
  }
  const rowKeys = Object.keys(row);
  for (const possibleKey of possibleKeys) {
    const found = rowKeys.find((k) => k.toLowerCase() === possibleKey.toLowerCase());
    if (found && row[found] !== undefined && row[found] !== null) {
      return String(row[found]).trim();
    }
  }
  return '';
}

function mapCoupangRow(row: Record<string, unknown>): CoupangRow {
  if (!hasLoggedHeaders) {
    hasLoggedHeaders = true;
  }

  return {
    optionPBuyer: findValue(row, ['Option p Buyer', 'Option pBuyer', 'optionPBuyer', 'Product']),
    buyerPf: findValue(row, ['Buyer pf', 'Buyer pf Recipien', 'buyerPf', 'Option']),
    recipienZipcode: findValue(row, ['Recipien Zipcode', 'RecipienZipcode', 'Recipient Zipcode']),
    zipcode: findValue(row, ['Zipcode', 'Zip Code', 'Zip']),
    recipienDelivery: findValue(row, ['Recipien Delivery', 'RecipienDelivery', 'Delivery Address', 'Address']),
    recipientName: findValue(row, ['Recipient', 'Recipien', 'Receiver', 'Name', 'Recipient Name']),
    asItAddress: findValue(row, ['AS-IT Address', 'ASIT Address', 'AS IT Address', 'AsItAddress']),
    personalContact: findValue(row, ['Personal Contact', 'PersonalContact', 'Contact', 'Phone', 'Mobile']),
    shipmen: findValue(row, ['Shipmen', 'Shipment']),
    ...row,
  };
}

export function readCoupangExcel(file: File): Promise<CoupangRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, unknown>[];
        resolve(jsonData.map(mapCoupangRow));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function generateOrderNumber(): string {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${timestamp}${random}`;
}

function generateBarcode(): string {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${timestamp}${random}`;
}

function mapToIndiaPost(data: ProcessedCoupangData): IndiaPostRow {
  const { rawData, translatedProduct, translatedOption, parsedAddress } = data;

  let addr = parsedAddress;
  if (!addr || (!addr.name && !addr.addressLine1 && !addr.city)) {
    const rawAddr = rawData.asItAddress || rawData.recipienDelivery || '';
    const rawZip = rawData.zipcode || rawData.recipienZipcode || '';
    if (rawAddr) {
      const fallback = parseAsitAddress(rawAddr, rawZip);
      if (fallback && (fallback.name || fallback.addressLine1 || fallback.city)) {
        addr = fallback;
      }
    }
  }

  const addressParts = [
    addr?.addressLine1,
    addr?.addressLine2,
    addr?.city,
    addr?.state,
    addr?.pincode,
  ].filter((part) => part && part.trim()).join(', ');

  const fullAddress = addressParts || rawData.asItAddress || rawData.recipienDelivery || '';
  const recipientName = addr?.name || rawData.recipientName || '';
  const city = addr?.city || '';
  const state = addr?.state || '';
  const addressLine1 = addr?.addressLine1 || '';
  const addressLine2 = addr?.addressLine2 || '';
  const pincode = addr?.pincode || rawData.zipcode || rawData.recipienZipcode || '';
  const phone = addr?.phone || rawData.personalContact || '';

  return {
    orderNumber: generateOrderNumber(),
    barcode: generateBarcode(),
    weight: '',
    zipcode: pincode,
    buyerPhoneNum: phone,
    registeredProduct: `${translatedProduct || rawData.optionPBuyer}${translatedOption ? ' - ' + translatedOption : ''}`,
    registered: '',
    recipientAddress: fullAddress,
    country: 'South Korea',
    state,
    receiverCity: city,
    receiverPincode: pincode,
    receiverName: recipientName,
    receiverAddLine1: addressLine1,
    receiverAddLine2: addressLine2,
    receiverMobileNo: phone,
  };
}

async function processBatch(
  batch: CoupangRow[],
  startIndex: number,
  total: number,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<ProcessedCoupangData[]> {
  const results: ProcessedCoupangData[] = [];

  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    const currentIndex = startIndex + i + 1;
    onProgress?.(currentIndex, total, `Processing row ${currentIndex}/${total}...`);

    const processed: ProcessedCoupangData = { rawData: row };

    if (row.optionPBuyer) {
      processed.translatedProduct = await translateWithGemini(row.optionPBuyer);
      await delay(2000);
    }

    if (row.buyerPf) {
      processed.translatedOption = await translateWithGemini(row.buyerPf);
      await delay(2000);
    }

    const addressToParse = row.asItAddress || row.recipienDelivery;
    const zipcodeForParsing = row.zipcode || row.recipienZipcode;

    if (addressToParse) {
      let parsed = await parseAddressWithGemini(addressToParse, zipcodeForParsing);
      if (!parsed) {
        parsed = parseAsitAddress(addressToParse, zipcodeForParsing);
      }

      if (parsed) {
        processed.parsedAddress = {
          name: parsed.name,
          addressLine1: parsed.addressLine1,
          addressLine2: parsed.addressLine2,
          city: parsed.city,
          state: parsed.state,
          pincode: parsed.pincode,
          phone: parsed.phone,
        };
      }
      await delay(2000);
    }

    processed.indiaPostRow = mapToIndiaPost(processed);
    results.push(processed);
  }

  return results;
}

export async function processCoupangData(
  rows: CoupangRow[],
  onProgress?: (current: number, total: number, message: string) => void
): Promise<ProcessedCoupangData[]> {
  if (!getTranslationModel()) {
    throw new Error('Gemini API not configured. Add VITE_GEMINI_API_KEY to your environment.');
  }

  const results: ProcessedCoupangData[] = [];

  for (let i = 0; i < rows.length; i += COUPANG_BATCH_SIZE) {
    const batch = rows.slice(i, Math.min(i + COUPANG_BATCH_SIZE, rows.length));
    const batchResults = await processBatch(batch, i, rows.length, onProgress);
    results.push(...batchResults);

    if (i + COUPANG_BATCH_SIZE < rows.length) {
      await delay(GEMINI_RATE_LIMIT_MS);
    }
  }

  return results;
}

export function generateIndiaPostExcel(processedData: ProcessedCoupangData[]): void {
  const indiaPostRows = processedData
    .map((d) => d.indiaPostRow)
    .filter((row): row is IndiaPostRow => row !== undefined);

  if (indiaPostRows.length === 0) {
    throw new Error('No data to export');
  }

  const headers = [
    'Order num', 'barcode', 'wheight', 'Zipcode', 'Buyer phor', 'Registered', 'Registered',
    'Recipient address', 'Country', 'State', 'RECEIVER CITY', 'RECEIVER PINCODE',
    'RECEIVER NAME', 'RECEIVER ADD LINE 1', 'RECEIVER ADD LINE 2', 'RECEIVER MOBILE NO',
  ];

  const data = indiaPostRows.map((row) => [
    row.orderNumber, row.barcode, row.weight, row.zipcode, row.buyerPhoneNum,
    row.registeredProduct, row.registered, row.recipientAddress, row.country,
    row.state, row.receiverCity, row.receiverPincode, row.receiverName,
    row.receiverAddLine1, row.receiverAddLine2, row.receiverMobileNo,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'India Post');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  saveAs(blob, `INDIA_POST_FILE_${timestamp}.xlsx`);
}

export function resetCoupangHeaderLogging(): void {
  hasLoggedHeaders = false;
}
