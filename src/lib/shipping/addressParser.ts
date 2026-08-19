import { FormattedAddress } from './types';

const METRO_CITIES = [
  'Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju', 'Ulsan', 'Sejong',
];

function formatKoreanPhone(phone: string): string {
  let digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('82')) digits = digits.substring(2);
  else if (digits.startsWith('0')) digits = digits.substring(1);

  if (digits.length >= 9) {
    const part1 = digits.substring(0, 2);
    const part2 = digits.substring(2, 6);
    const part3 = digits.substring(6);
    return `+82-${part1}-${part2}-${part3}`;
  }
  return `+82-${digits}`;
}

function emptyAddress(): FormattedAddress {
  return {
    name: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'South Korea',
    phone: '',
  };
}

function normaliseRawCell(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/-\s*\n\s*/g, '-')
    .replace(/\n+/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/,?\s*South Korea\s*/gi, '')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();
}

export function parseAsitAddress(rawCell: string, zipcode?: string): FormattedAddress {
  if (!rawCell?.trim()) {
    return emptyAddress();
  }

  let working = normaliseRawCell(rawCell);

  let phone = '';
  const phoneRe = /(?:ph:\s*)?(\+?82[-\s]?\d[\d\s-]{8,}|0\d{2}[-\s]?\d{3,4}[-\s]?\d{4})/i;
  const phoneMatch = working.match(phoneRe);
  if (phoneMatch) {
    phone = formatKoreanPhone(phoneMatch[0].replace(/^ph:\s*/i, ''));
    working = working.replace(phoneMatch[0], '').replace(/,\s*,/g, ',').trim();
  }

  let pincode = zipcode?.trim() || '';
  const pincodeRe = /\b(\d{5})\b/g;
  let pincodeMatch: RegExpExecArray | null;
  while ((pincodeMatch = pincodeRe.exec(working)) !== null) {
    if (!pincode) pincode = pincodeMatch[1];
    working = working.replace(pincodeMatch[0], '').replace(/,\s*,/g, ',').trim();
    pincodeRe.lastIndex = 0;
    break;
  }

  let line2 = '';
  const allParens = [...working.matchAll(/\(([^)]*)\)/g)];
  if (allParens.length > 0) {
    const last = allParens[allParens.length - 1];
    line2 = last[1].trim();
    working = (working.slice(0, last.index!) + working.slice(last.index! + last[0].length))
      .replace(/,\s*,/g, ',').trim();
  }

  working = working.replace(/^,\s*|,\s*$/g, '').trim();

  const addressKeywordRe = /-(?:do|si|gu|gun|ro|gil|daero|dong|eup|myeon|ri)\b/i;
  const segments = working.split(',').map((s) => s.trim()).filter(Boolean);

  let name = '';
  let nameIdx = -1;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (!addressKeywordRe.test(s) && !/^\d/.test(s) && !/^room|^building|^unit|^floor/i.test(s)) {
      name = s;
      nameIdx = i;
      break;
    }
  }
  if (nameIdx !== -1) {
    segments.splice(nameIdx, 1);
    working = segments.join(', ');
  }

  let state = '';
  for (const metro of METRO_CITIES) {
    if (new RegExp(`\\b${metro}\\b`, 'i').test(working)) {
      state = metro;
      break;
    }
  }
  if (!state) {
    const doMatch = working.match(/\b(\w+-do)\b/i);
    if (doMatch) state = doMatch[1];
  }

  let city = '';
  const siTokens = [...working.matchAll(/\b(\S+-si)\b/gi)].map((m) => m[1]);
  const guTokens = [...working.matchAll(/\b(\S+-gu)\b/gi)].map((m) => m[1]);
  const gunTokens = [...working.matchAll(/\b(\S+-gun)\b/gi)].map((m) => m[1]);

  if (siTokens.length > 0) city = siTokens[0];
  else if (guTokens.length > 0) city = guTokens[0];
  else if (gunTokens.length > 0) city = gunTokens[0];

  let line1 = working
    .replace(/\b\d{5}\b/g, '')
    .replace(/south\s+korea/gi, '')
    .replace(/\bSeoul|Busan|Incheon|Daegu|Daejeon|Gwangju|Ulsan|Sejong\b/gi, '')
    .replace(/\b\w+-do\b/gi, '')
    .replace(new RegExp(`\\b${city.replace(/-/g, '\\-')}\\b`, 'gi'), '')
    .replace(/\b\w+-(?:si|gu|gun)\b/gi, '')
    .replace(/,\s*,/g, ',')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();

  return {
    name,
    addressLine1: line1,
    addressLine2: line2,
    city,
    state,
    pincode,
    country: 'South Korea',
    phone,
  };
}
