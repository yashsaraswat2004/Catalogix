import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { config } from '@/lib/config';
import { FormattedAddress } from './types';
import { GEMINI_RATE_LIMIT_MS } from './constants';

let model: GenerativeModel | null = null;

function getModel(): GenerativeModel | null {
  if (model) return model;
  const key = config.geminiApiKey;
  if (!key || key === 'YOUR_GEMINI_API_KEY_HERE') return null;
  try {
    const genAI = new GoogleGenerativeAI(key);
    model = genAI.getGenerativeModel({ model: 'gemma-3-4b-it' });
    return model;
  } catch {
    return null;
  }
}

export function isGeminiAvailable(): boolean {
  return getModel() !== null;
}

function buildPrompt(asitAddress: string, zipcode?: string): string {
  return `You are a professional address parser. Your task is to translate the following Korean address to English and split it into the EXACT format below. 

STRICT RULES:
1. TRANSLATION: Translate all Korean text to clear, professional English.
2. LINE 1: ONLY apartment name, building number, room, or unit number. (e.g. "101-dong, 502-ho, Sunrise Apt")
3. LINE 2: ONLY street address, road name, and neighborhood/dong. (e.g. "45, Mapo-daero, Mapo-gu")
4. CITY: ONLY the city and district (gu) name. (e.g. "Seoul" or "Yongin-si, Gyeonggi-do")
5. STATE: ONLY the province or special city name. (e.g. "Gyeonggi-do" or "Seoul")
6. PHONE: Format as +82-10-XXXX-XXXX.
7. CONSISTENCY: Every address MUST be split into at least 6-7 lines total (Name, Line 1, Line 2, City, State, Pincode). NEVER merge these fields.

ADDRESS TO PARSE:
${asitAddress}
${zipcode ? `Pincode: ${zipcode}` : ''}`;
}

function parseGeminiResponse(text: string): FormattedAddress | null {
  try {
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```[a-z]*\n?/g, '');
    }

    const lines = cleanedText.split('\n').map((l) => l.trim()).filter(Boolean);
    const data: Record<string, string> = {};

    for (const line of lines) {
      if (line.includes('AS-IT FORMAT') || line.includes('NOW PARSE') ||
          line.includes('TEMPLATE') || line.startsWith('•')) continue;

      const colonIndex = line.indexOf(':');
      if (colonIndex > -1) {
        const key = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();

        if (key.includes('receiver name') || key === 'name') data.name = value;
        else if (key.includes('receiver add line 1') || key.includes('addline1') || key === 'add line 1') data.addressLine1 = value;
        else if (key.includes('receiver add line 2') || key.includes('addline2') || key === 'add line 2') data.addressLine2 = value;
        else if (key.includes('receiver city') || key === 'city') data.city = value;
        else if (key === 'state' || key.includes('province')) data.state = value;
        else if (key.includes('receiver pincode') || key.includes('pincode') || key.includes('postal') || key.includes('zip')) data.pincode = value;
        else if (key.includes('receiver mobile') || key.includes('mobile') || key.includes('phone')) data.phone = value;
      }
    }

    const cleanValue = (val: string | undefined): string => {
      if (!val || val.toLowerCase().includes('not provided') || val.toLowerCase() === 'n/a') return '';
      return val;
    };

    const formatPhoneNumber = (phone: string | undefined): string => {
      if (!phone) return '';
      let digits = phone.replace(/\D/g, '');
      if (digits.startsWith('82')) digits = digits.substring(2);
      else if (digits.startsWith('0')) digits = digits.substring(1);

      if (digits.length >= 10) {
        return `+82-${digits.substring(0, 3)}-${digits.substring(3, 7)}-${digits.substring(7, 11)}`;
      }
      if (digits.length >= 9) {
        return `+82-${digits.substring(0, 2)}-${digits.substring(2, 6)}-${digits.substring(6, 10)}`;
      }
      return phone;
    };

    const result: FormattedAddress = {
      name: cleanValue(data.name) || '',
      addressLine1: cleanValue(data.addressLine1) || '',
      addressLine2: cleanValue(data.addressLine2) || '',
      city: cleanValue(data.city) || '',
      state: cleanValue(data.state) || '',
      pincode: cleanValue(data.pincode) || '',
      country: 'South Korea',
      phone: formatPhoneNumber(data.phone) || '',
    };

    if (!result.name) return null;
    return result;
  } catch {
    return null;
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function parseAddressWithGemini(asitAddress: string, zipcode?: string): Promise<FormattedAddress | null> {
  const geminiModel = getModel();
  if (!geminiModel) return null;

  try {
    const result = await geminiModel.generateContent(buildPrompt(asitAddress, zipcode));
    const response = await result.response;
    return parseGeminiResponse(response.text());
  } catch {
    return null;
  }
}

export async function parseBulkAddressesWithGemini(
  addresses: Array<{ asitAddress: string; zipcode?: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<FormattedAddress[]> {
  const results: FormattedAddress[] = [];

  for (let i = 0; i < addresses.length; i++) {
    onProgress?.(i + 1, addresses.length);
    const result = await parseAddressWithGemini(addresses[i].asitAddress, addresses[i].zipcode);
    if (result) results.push(result);
    if (i < addresses.length - 1) await delay(GEMINI_RATE_LIMIT_MS);
  }

  return results;
}

export function getTranslationModel(): GenerativeModel | null {
  const key = config.geminiApiKey;
  if (!key || key === 'YOUR_GEMINI_API_KEY_HERE') return null;
  try {
    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  } catch {
    return null;
  }
}

export async function translateWithGemini(koreanText: string): Promise<string> {
  const translationModel = getTranslationModel();
  if (!translationModel || !koreanText?.trim()) return koreanText || '';

  try {
    const prompt = `Translate the following Korean text to English. Provide only the translation, no explanations:

Korean: ${koreanText}

English:`;
    const result = await translationModel.generateContent(prompt);
    return result.response.text().trim();
  } catch {
    return koreanText;
  }
}
