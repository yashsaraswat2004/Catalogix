import { CoupangProduct, ParsedProduct } from '@/types/coupang';

export const COUPANG_ERROR_DICTIONARY: Array<{ match: RegExp; english: string }> = [
  {
    match: /필수\s*구매\s*옵션/,
    english:
      'Coupang needs a purchase option such as pack size (e.g. 용량 200g). Size / 200 gm is not accepted.',
  },
  {
    match: /등록\/노출\s*제한/,
    english: 'Listing is blocked until required purchase options are in Coupang’s format.',
  },
];

export function translateCoupangError(message: string | undefined | null): string {
  if (!message) return 'Upload failed.';
  const trimmed = String(message).trim();
  for (const entry of COUPANG_ERROR_DICTIONARY) {
    if (entry.match.test(trimmed)) {
      return `${entry.english} (Coupang: ${trimmed})`;
    }
  }
  return trimmed;
}

const UNIT_WORD_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bpieces?\b/gi, '개'],
  [/\bpcs?\b/gi, '개'],
  [/\bea\b/gi, '개'],
  [/\bunits?\b/gi, '개'],
  [/\bpacks?\b/gi, '팩'],
  [/\bgrams?\b/gi, 'g'],
  [/\bgm\b/gi, 'g'],
  [/\bkilograms?\b/gi, 'kg'],
  [/\bmilliliters?\b/gi, 'ml'],
  [/\blitres?\b/gi, 'L'],
  [/\bliters?\b/gi, 'L'],
];

export function normalizeCoupangMeasure(value: string | undefined | null): string {
  if (!value) return '';
  let str = String(value).trim();
  if (!str) return '';
  for (const [pattern, replacement] of UNIT_WORD_REPLACEMENTS) {
    str = str.replace(pattern, replacement);
  }
  str = str.replace(/(\d+(?:\.\d+)?)\s+([a-zA-Z가-힣]+)\s*$/g, '$1$2');
  str = str.replace(/(\d+(?:\.\d+)?)gm\b/gi, '$1g');
  return str.trim();
}

function classify(value: string): 'weight' | 'volume' | 'count' | 'color' | 'unknown' {
  const str = String(value || '').trim().toLowerCase();
  if (!str) return 'unknown';
  if (/\d/.test(str) && /ml\b|(^|[^a-z])l([^a-z]|$)|\boz\b/.test(str) && !/[0-9]g\b/.test(str.replace(/ml/g, ''))) return 'volume';
  if (/\d/.test(str) && /(kg|mg|gm|[0-9]g)/.test(str)) return 'weight';
  if (/\d/.test(str) && /(개|정|캡슐|팩|봉|ea|pcs)/.test(str)) return 'count';
  if (/shade|ivory|beige|nude|black|white|red|blue|색/.test(str)) return 'color';
  return 'unknown';
}

function extractFromText(text: string): string {
  const weight = String(text || '').match(/(\d+(?:\.\d+)?)\s*(kg|gm|grams?|g|mg)\b/i);
  if (weight) {
    const unit = weight[2].toLowerCase().startsWith('kg') ? 'kg'
      : weight[2].toLowerCase().startsWith('mg') ? 'mg'
      : 'g';
    return normalizeCoupangMeasure(`${weight[1]}${unit}`);
  }
  const volume = String(text || '').match(/(\d+(?:\.\d+)?)\s*(ml|l|oz)\b/i);
  if (volume) {
    return normalizeCoupangMeasure(`${volume[1]}${volume[2]}`);
  }
  return '';
}

function mapType(englishOrKorean: string, kind: ReturnType<typeof classify>): string {
  const lower = englishOrKorean.trim().toLowerCase();
  if (['용량', '중량', '수량', '색상', '사이즈', '종류', '맛', '향'].includes(englishOrKorean.trim())) {
    if ((lower === '사이즈' || lower === 'size') && (kind === 'weight' || kind === 'volume')) return '용량';
    return englishOrKorean.trim();
  }
  if (lower === 'size' || lower === 'weight' || lower === 'volume' || lower === 'capacity' || lower === 'pack' || lower === 'pack size') {
    if (kind === 'count') return '수량';
    if (kind === 'color') return '색상';
    return '용량';
  }
  if (lower === 'quantity' || lower === 'qty' || lower === 'count') return '수량';
  if (lower === 'color' || lower === 'colour') return '색상';
  if (kind === 'count') return '수량';
  if (kind === 'color') return '색상';
  return '용량';
}

export function repairProductData(data: Partial<CoupangProduct>): Partial<CoupangProduct> {
  const next = { ...data };
  if (next.weight) next.weight = normalizeCoupangMeasure(next.weight);
  if (next.volume) next.volume = normalizeCoupangMeasure(next.volume);
  if (next.quantity) next.quantity = normalizeCoupangMeasure(next.quantity);

  const rawType = String(next.optionType1 || '').trim();
  const rawValue = normalizeCoupangMeasure(next.optionValue1);
  let value = rawValue || next.weight || next.volume
    || extractFromText([next.productName, next.detailedDescription, next.searchKeywords].join(' '));
  value = normalizeCoupangMeasure(value);

  let kind = classify(value);
  if (kind === 'unknown' && next.weight) {
    value = next.weight;
    kind = 'weight';
  }
  if (kind === 'unknown' && next.volume) {
    value = next.volume;
    kind = 'volume';
  }
  if (!value) value = '1개';

  next.optionType1 = mapType(rawType, kind);
  next.optionValue1 = value;
  if (!next.quantity) next.quantity = '1개';
  if ((kind === 'weight' || classify(value) === 'weight') && !next.weight) next.weight = value;
  if ((kind === 'volume' || classify(value) === 'volume') && !next.volume) next.volume = value;

  return next;
}

export function repairParsedProducts(products: ParsedProduct[]): ParsedProduct[] {
  const repaired = products.map(p => ({
    ...p,
    data: repairProductData(p.data),
  }));

  const groups = new Map<string, ParsedProduct[]>();
  for (const p of repaired) {
    const gid = p.data.productGroup?.trim();
    if (!gid) continue;
    if (!groups.has(gid)) groups.set(gid, []);
    groups.get(gid)!.push(p);
  }

  for (const siblings of groups.values()) {
    if (siblings.length < 2) continue;
    const typeCounts = new Map<string, number>();
    for (const s of siblings) {
      const t = String(s.data.optionType1 || '').trim();
      if (t) typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    }
    let shared = '용량';
    let best = 0;
    for (const [t, c] of typeCounts) {
      if (c > best) {
        best = c;
        shared = t;
      }
    }
    const seen = new Set<string>();
    siblings.forEach((s, index) => {
      s.data.optionType1 = shared;
      let value = normalizeCoupangMeasure(s.data.optionValue1);
      if (!value || seen.has(value.toLowerCase())) {
        const fallback = normalizeCoupangMeasure(s.data.weight || s.data.volume || '');
        value = fallback && !seen.has(fallback.toLowerCase()) ? fallback : `${value || '옵션'}-${index + 1}`;
      }
      seen.add(value.toLowerCase());
      s.data.optionValue1 = value;
    });
  }

  return repaired;
}
