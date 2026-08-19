import * as XLSX from 'xlsx';
import { OrderData, RawAddress } from './types';

function findDeliverySheet(workbook: XLSX.WorkBook): string | null {
  const deliverySheet = workbook.SheetNames.find((name) =>
    name.toLowerCase().includes('delivery')
  );
  if (deliverySheet) return deliverySheet;
  return workbook.SheetNames.length > 0 ? workbook.SheetNames[0] : null;
}

function findByKeywords(row: Record<string, unknown>, keywords: string[]): string {
  for (const key of Object.keys(row)) {
    const norm = key.toLowerCase().trim();
    if (keywords.some((kw) => norm.includes(kw))) {
      const value = row[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return typeof value === 'string' ? value.trim() : String(value);
      }
    }
  }
  return '';
}

function findZipcode(row: Record<string, unknown>): string {
  for (const key of Object.keys(row)) {
    const norm = key.toLowerCase().trim();
    if (norm === 'zipcode' || norm === 'zip code' || norm === 'zip') {
      const value = row[key];
      return typeof value === 'string' ? value.trim() : String(value || '');
    }
  }
  return '';
}

function findAsitAddress(row: Record<string, unknown>): string {
  const keys = Object.keys(row);
  for (const key of keys) {
    const norm = key.toLowerCase().trim().replace(/[\s\-_]/g, '');
    if (norm.includes('asitaddress') || norm.includes('asit')) {
      const value = row[key];
      return typeof value === 'string' ? value.trim() : String(value || '');
    }
  }
  for (const key of keys) {
    if (key.toLowerCase().includes('address')) {
      const value = row[key];
      return typeof value === 'string' ? value.trim() : String(value || '');
    }
  }
  return '';
}

function findProductName(row: Record<string, unknown>): string {
  return findByKeywords(row, [
    'registered product', 'product name', 'product', 'item description',
    'item', 'option p buyer', 'optionpbuyer', 'description', 'goods', 'registered',
  ]);
}

function findProductPrice(row: Record<string, unknown>): string {
  for (const key of Object.keys(row)) {
    if (key.toLowerCase().trim() === 'price') {
      const value = row[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return typeof value === 'string' ? value.trim() : String(value);
      }
    }
  }
  return findByKeywords(row, ['value and currency', 'unit price', 'sale price', 'currency']);
}

function extractOrders(jsonData: unknown[]): OrderData[] {
  const orders: OrderData[] = [];

  for (const row of jsonData) {
    const rowObj = row as Record<string, unknown>;
    const asitAddress = findAsitAddress(rowObj);
    if (!asitAddress) continue;

    const rawAddress: RawAddress = {
      asitAddress,
      zipcode: findZipcode(rowObj),
      productName: findProductName(rowObj),
      productPrice: findProductPrice(rowObj),
      companyName: findByKeywords(rowObj, ['number', 'company']),
    };

    orders.push({ rawAddress, formattedAddress: null });
  }

  return orders;
}

export function readOrderExcelFile(file: File): Promise<OrderData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = findDeliverySheet(workbook);
        if (!sheetName) {
          reject(new Error('Sheet "Delivery" not found'));
          return;
        }

        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (jsonData.length === 0) {
          reject(new Error('No data found in worksheet'));
          return;
        }

        resolve(extractOrders(jsonData));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
