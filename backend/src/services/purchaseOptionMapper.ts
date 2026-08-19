/**
 * Auto-repair Excel/CSV rows into Coupang 구매옵션 (purchase options).
 * Operators send Amazon-style Size / 200 gm / blank options; Coupang needs
 * a category option name (용량, 수량, 색상, …) and compact units (200g).
 */

export type ProductLike = {
  optionType1?: string;
  optionValue1?: string;
  optionType2?: string;
  optionValue2?: string;
  optionType3?: string;
  optionValue3?: string;
  optionValue4?: string;
  optionType4?: string;
  quantity?: string;
  volume?: string;
  weight?: string;
  productName?: string;
  detailedDescription?: string;
  searchKeywords?: string;
  productGroup?: string;
  [key: string]: any;
};

type CategoryAttrMeta = {
  attributeTypeName?: string;
  required?: string;
  groupNumber?: number;
  usableUnits?: string[];
  attributeValueMetas?: Array<{ attributeValueName?: string }>;
};

type CategoryMeta = {
  attributeTypeMetas?: CategoryAttrMeta[];
  data?: { attributeTypeMetas?: CategoryAttrMeta[] };
};

export const COUPANG_ERROR_DICTIONARY: Array<{ match: RegExp; english: string }> = [
  {
    match: /필수\s*구매\s*옵션/,
    english:
      'Coupang needs a purchase option (pack size, color, or quantity) in this category’s allowed format. We tried to set it from Weight/Size. If this still fails, check Option Type 1 is a Korean name such as 용량 and the value is like 200g (not 200 gm).',
  },
  {
    match: /등록\/노출\s*제한/,
    english: 'Listing is blocked until required purchase options are filled in Coupang’s format.',
  },
  {
    match: /1원단위/,
    english: 'Price must be a multiple of 10 KRW.',
  },
  {
    match: /바코드/,
    english: 'Barcode was rejected. Leave it blank unless you have a real EAN/UPC number (not an Amazon ASIN).',
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

const ENGLISH_TYPE_ALIASES: Record<string, string[]> = {
  size: ['사이즈', '크기', '용량', '개당 용량', '중량', '개당 중량'],
  weight: ['중량', '개당 중량', '용량', '개당 용량'],
  volume: ['용량', '개당 용량'],
  capacity: ['용량', '개당 용량'],
  pack: ['용량', '수량', '개당 수량'],
  'pack size': ['용량', '수량'],
  quantity: ['수량', '개당 수량'],
  qty: ['수량'],
  count: ['수량'],
  color: ['색상'],
  colour: ['색상'],
  flavor: ['맛'],
  flavour: ['맛'],
  scent: ['향'],
  type: ['종류'],
};

const UNIT_WORD_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bpieces?\b/gi, '개'],
  [/\bpcs?\b/gi, '개'],
  [/\bea\b/gi, '개'],
  [/\bunits?\b/gi, '개'],
  [/\bpacks?\b/gi, '팩'],
  [/\bsets?\b/gi, '세트'],
  [/\bboxe?s?\b/gi, '박스'],
  [/\bbags?\b/gi, '봉'],
  [/\btablets?\b/gi, '정'],
  [/\btabs?\b/gi, '정'],
  [/\bcapsules?\b/gi, '캡슐'],
  [/\bgrams?\b/gi, 'g'],
  [/\bgm\b/gi, 'g'],
  [/\bkilograms?\b/gi, 'kg'],
  [/\bmilligrams?\b/gi, 'mg'],
  [/\bmilliliters?\b/gi, 'ml'],
  [/\blitres?\b/gi, 'L'],
  [/\bliters?\b/gi, 'L'],
];

export function isBlankOptionToken(value: string | undefined | null): boolean {
  if (value == null) return true;
  const trimmed = String(value).trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  return lower === 'n/a' || lower === 'none' || lower === '-' || trimmed === '0';
}

export function normalizeCoupangMeasure(value: string | undefined | null): string {
  if (!value) return '';
  let str = String(value).trim();
  if (!str) return '';

  for (const [pattern, replacement] of UNIT_WORD_REPLACEMENTS) {
    str = str.replace(pattern, replacement);
  }

  // 200 g / 200g / 500 gm already reduced → collapse space before unit
  str = str.replace(/(\d+(?:\.\d+)?)\s+([a-zA-Z가-힣]+)\s*$/g, '$1$2');

  // Bare number + implied gram from surrounding "gm" leftovers
  str = str.replace(/(\d+(?:\.\d+)?)gm\b/gi, '$1g');

  return str.trim();
}

export function classifyMeasure(value: string): 'weight' | 'volume' | 'count' | 'color' | 'unknown' {
  const str = String(value || '').trim().toLowerCase();
  if (!str) return 'unknown';
  if (/\d/.test(str) && /ml\b|리터|(^|[^a-z])l([^a-z]|$)|fl\s*oz|\boz\b/.test(str) && !/kg|mg|[0-9]g\b/.test(str.replace(/ml/g, ''))) {
    return 'volume';
  }
  if (/\d/.test(str) && /(kg|mg|gm|[0-9]g|그램)/.test(str)) return 'weight';
  if (/\d/.test(str) && /(개|정|캡슐|팩|봉|ea|pcs|piece|tablet|capsule)/.test(str)) return 'count';
  if (/shade|ivory|beige|nude|black|white|red|blue|green|pink|gold|silver|색/.test(str)) return 'color';
  return 'unknown';
}

function getAttributeMetas(meta?: CategoryMeta | null): CategoryAttrMeta[] {
  if (!meta) return [];
  if (Array.isArray(meta.attributeTypeMetas)) return meta.attributeTypeMetas;
  if (Array.isArray(meta.data?.attributeTypeMetas)) return meta.data!.attributeTypeMetas!;
  return [];
}

function isSpecAttributeName(name: string): boolean {
  const n = (name || '').trim();
  return /^(개당|최소|총|순)/.test(n);
}

function isPurchaseOptionName(name: string): boolean {
  const n = (name || '').trim();
  if (!n) return false;
  if (isSpecAttributeName(n)) return false;
  return /용량|중량|수량|색상|사이즈|크기|맛|향|종류|타입|선택/.test(n);
}

function findAttrByNames(metas: CategoryAttrMeta[], names: string[]): CategoryAttrMeta | undefined {
  const lowered = names.map(n => n.toLowerCase());
  return metas.find(m => {
    const name = (m.attributeTypeName || '').toLowerCase();
    return lowered.some(n => name === n || name.includes(n) || n.includes(name));
  });
}

function pickPurchaseOptionType(
  metas: CategoryAttrMeta[],
  kind: ReturnType<typeof classifyMeasure>,
  suggestedType?: string
): string {
  const purchaseMetas = metas.filter(m => isPurchaseOptionName(m.attributeTypeName || ''));
  const pool = purchaseMetas.length > 0 ? purchaseMetas : metas.filter(m => !isSpecAttributeName(m.attributeTypeName || ''));

  const prefer: string[] =
    kind === 'volume' ? ['용량', '개당 용량'] :
    kind === 'weight' ? ['용량', '중량', '개당 용량', '개당 중량'] :
    kind === 'count' ? ['수량', '개당 수량'] :
    kind === 'color' ? ['색상'] :
    ['용량', '수량', '색상', '사이즈'];

  if (suggestedType) {
    const lowerSuggested = suggestedType.trim().toLowerCase();
    let aliases = ENGLISH_TYPE_ALIASES[lowerSuggested] || [suggestedType];
    if (lowerSuggested === 'size' && (kind === 'weight' || kind === 'volume' || kind === 'unknown')) {
      aliases = kind === 'unknown' ? aliases : ['용량', '개당 용량', '중량', '개당 중량', '사이즈'];
    }
    const fromUser = findAttrByNames(pool.length ? pool : metas, aliases);
    if (fromUser?.attributeTypeName) {
      // Size + 200g must not stay as 사이즈 when 용량 exists
      const name = fromUser.attributeTypeName;
      if (suggestedType.toLowerCase() === 'size' && (kind === 'weight' || kind === 'volume')) {
        const capacity = findAttrByNames(pool.length ? pool : metas, prefer);
        if (capacity?.attributeTypeName) return capacity.attributeTypeName;
      }
      if (!isSpecAttributeName(name)) return name;
    }
  }

  const matched = findAttrByNames(pool.length ? pool : metas, prefer);
  if (matched?.attributeTypeName && !isSpecAttributeName(matched.attributeTypeName)) {
    return matched.attributeTypeName;
  }

  if (kind === 'weight' || kind === 'volume') return '용량';
  if (kind === 'count') return '수량';
  if (kind === 'color') return '색상';
  return pool[0]?.attributeTypeName || '용량';
}

function extractMeasureFromText(text: string): string {
  const combined = String(text || '');
  const weight = combined.match(/(\d+(?:\.\d+)?)\s*(kg|gm|grams?|g|mg)\b/i);
  if (weight) {
    const unit = weight[2].toLowerCase().startsWith('kg') ? 'kg'
      : weight[2].toLowerCase().startsWith('mg') ? 'mg'
      : 'g';
    return normalizeCoupangMeasure(`${weight[1]}${unit}`);
  }
  const volume = combined.match(/(\d+(?:\.\d+)?)\s*(ml|milliliters?|l|liters?|oz)\b/i);
  if (volume) {
    return normalizeCoupangMeasure(`${volume[1]}${volume[2]}`);
  }
  return '';
}

function collectOptionSlots(product: ProductLike): Array<{ type: string; value: string }> {
  return [
    { type: product.optionType1 || '', value: product.optionValue1 || '' },
    { type: product.optionType2 || '', value: product.optionValue2 || '' },
    { type: product.optionType3 || '', value: product.optionValue3 || '' },
    { type: product.optionType4 || '', value: product.optionValue4 || '' },
  ].map(slot => ({
    type: String(slot.type).trim(),
    value: normalizeCoupangMeasure(slot.value),
  }));
}

/**
 * Fill / rewrite optionType1 + optionValue1 so Coupang receives a real 구매옵션.
 */
export function repairProductPurchaseOptions(
  product: ProductLike,
  meta?: CategoryMeta | null
): { product: ProductLike; notes: string[] } {
  const notes: string[] = [];
  const next: ProductLike = { ...product };
  const metas = getAttributeMetas(meta);

  if (next.weight) next.weight = normalizeCoupangMeasure(next.weight);
  if (next.volume) next.volume = normalizeCoupangMeasure(next.volume);
  if (next.quantity) next.quantity = normalizeCoupangMeasure(next.quantity);

  const slots = collectOptionSlots(next);
  const firstFilled = slots.find(s => !isBlankOptionToken(s.type) && !isBlankOptionToken(s.value));

  let rawValue = firstFilled?.value
    || next.weight
    || next.volume
    || extractMeasureFromText([next.productName, next.detailedDescription, next.searchKeywords].join(' '));

  rawValue = normalizeCoupangMeasure(rawValue);

  let kind = classifyMeasure(rawValue);
  if (kind === 'unknown' && next.weight) {
    rawValue = next.weight;
    kind = classifyMeasure(rawValue) === 'unknown' ? 'weight' : classifyMeasure(rawValue);
  }
  if (kind === 'unknown' && next.volume) {
    rawValue = next.volume;
    kind = 'volume';
  }

  const suggestedType = firstFilled?.type;
  const optionType = pickPurchaseOptionType(metas, kind, suggestedType);
  let optionValue = rawValue;

  if (!optionValue) {
    optionValue = kind === 'color' ? optionValue : '1개';
    notes.push('No pack size found; set purchase option to 1개');
  }

  // Align spec columns with the option value
  if (kind === 'weight' || classifyMeasure(optionValue) === 'weight') {
    if (!next.weight) next.weight = optionValue;
    else next.weight = normalizeCoupangMeasure(next.weight);
  }
  if (kind === 'volume' || classifyMeasure(optionValue) === 'volume') {
    if (!next.volume) next.volume = optionValue;
    else next.volume = normalizeCoupangMeasure(next.volume);
  }
  if (!next.quantity) {
    next.quantity = '1개';
  } else {
    next.quantity = normalizeCoupangMeasure(next.quantity);
  }

  const previousType = String(next.optionType1 || '').trim();
  const previousValue = String(next.optionValue1 || '').trim();
  next.optionType1 = optionType;
  next.optionValue1 = optionValue;

  if (!previousType || !previousValue) {
    notes.push(`Set purchase option ${optionType}=${optionValue} from Weight/Volume/title`);
  } else if (previousType !== optionType || normalizeCoupangMeasure(previousValue) !== optionValue) {
    notes.push(`Mapped "${previousType}" / "${previousValue}" → ${optionType}=${optionValue}`);
  }

  return { product: next, notes };
}

export function repairVariantGroupPurchaseOptions(
  products: ProductLike[],
  meta?: CategoryMeta | null
): ProductLike[] {
  if (!products.length) return products;

  const repaired = products.map(p => repairProductPurchaseOptions(p, meta).product);

  const typeCounts = new Map<string, number>();
  for (const p of repaired) {
    const t = String(p.optionType1 || '').trim();
    if (t) typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
  }
  let sharedType = '';
  let best = 0;
  for (const [type, count] of typeCounts) {
    if (count > best) {
      best = count;
      sharedType = type;
    }
  }
  if (!sharedType) sharedType = '용량';

  const seenValues = new Set<string>();
  return repaired.map((p, index) => {
    const next = { ...p, optionType1: sharedType };
    let value = normalizeCoupangMeasure(next.optionValue1);
    if (!value || seenValues.has(value.toLowerCase())) {
      const fallback = normalizeCoupangMeasure(next.weight || next.volume || '');
      if (fallback && !seenValues.has(fallback.toLowerCase())) {
        value = fallback;
      } else {
        value = value ? `${value}-${index + 1}` : `옵션${index + 1}`;
      }
    }
    seenValues.add(value.toLowerCase());
    next.optionValue1 = value;
    return next;
  });
}

type ItemAttribute = {
  attributeTypeName: string;
  attributeValueName: string;
  exposed?: string;
};

export function markPurchaseOptionExposure(attributes: ItemAttribute[]): ItemAttribute[] {
  if (!Array.isArray(attributes) || attributes.length === 0) return attributes;

  const next = attributes.map(attr => ({ ...attr }));
  let exposedCount = 0;

  for (const attr of next) {
    const name = attr.attributeTypeName || '';
    if (isPurchaseOptionName(name)) {
      attr.exposed = 'EXPOSED';
      exposedCount++;
    } else if (isSpecAttributeName(name)) {
      attr.exposed = 'NONE';
    }
  }

  if (exposedCount === 0) {
    const prefer = next.find(a => /용량|중량|수량|색상/.test(a.attributeTypeName || '')) || next[0];
    if (prefer) prefer.exposed = 'EXPOSED';
  }

  return next;
}

export function ensurePurchaseOptionAttribute(
  attributes: ItemAttribute[],
  product: ProductLike,
  meta?: CategoryMeta | null
): ItemAttribute[] {
  const list: ItemAttribute[] = Array.isArray(attributes)
    ? attributes.map(a => ({
        attributeTypeName: a.attributeTypeName,
        attributeValueName: a.attributeValueName,
        exposed: a.exposed,
      }))
    : [];
  const hasPurchase = list.some(a => isPurchaseOptionName(a.attributeTypeName));
  if (hasPurchase) {
    return markPurchaseOptionExposure(list);
  }

  const repaired = repairProductPurchaseOptions(product, meta).product;
  const type = String(repaired.optionType1 || '용량');
  const value = String(repaired.optionValue1 || '1개');

  const existing = list.find(a => (a.attributeTypeName || '').toLowerCase() === type.toLowerCase());
  if (existing) {
    existing.attributeValueName = value.substring(0, 30);
    existing.exposed = 'EXPOSED';
  } else {
    list.push({
      attributeTypeName: type.substring(0, 25),
      attributeValueName: value.substring(0, 30),
      exposed: 'EXPOSED',
    });
  }

  return markPurchaseOptionExposure(list);
}
