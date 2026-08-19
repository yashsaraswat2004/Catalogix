const LOCALIZATION_PROMPT = `You are a professional product packaging localization expert for the Korean Coupang marketplace.

Edit this product image: translate ALL visible English text into natural, fluent Korean (한글), while keeping everything else exactly the same.

STRICT REQUIREMENTS:
1. Translate every visible label, description, ingredient list, and marketing claim into Korean suitable for e-commerce
2. Render Korean using proper Hangul (한글) — never romanized Korean, never mixed English/Korean in the same label
3. Remove ALL English text — zero English characters may remain visible (except well-known international brand names in Latin script)
4. Preserve the EXACT visual layout: same text positions, alignment, spacing, colors, and hierarchy
5. Do NOT alter the product, packaging, photos, logos, barcodes, seals, or background
6. Korean text must fit cleanly in each text region with no overlapping, double-layered, or ghosted text underneath
7. Match original typography style, weight, size, and color as closely as possible — legible Korean glyphs at packaging scale
8. Use natural Korean word spacing and line breaks appropriate for product labels
9. Output a photorealistic image identical to the input except for Korean localized text

Keep these brand names in original Latin script if present: {brandNames}`;

const REFINEMENT_PROMPT = `Review this localized product packaging image for the Korean market.

Fix any issues:
- If ANY English text remains, erase it completely and replace with natural Korean (한글)
- Fix overlapping, misaligned, truncated, or poorly kerned Korean text
- Remove ghosted or double-layered text where old English shows through
- Ensure Hangul is crisp, legible, and properly spaced in every text region

Do not change the product, packaging shape, photos, logos, barcodes, or background. Output the corrected image only.`;

/**
 * Nano Banana Pro (gemini-3-pro-image) is best for Korean/CJK text rendering.
 * Flash models are fallbacks when Pro is unavailable or quota-limited.
 * Override via GEMINI_IMAGE_MODEL / GEMINI_IMAGE_MODELS env.
 */
const DEFAULT_IMAGE_MODELS = [
  'gemini-3-pro-image',
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image',
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image',
];

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
  error?: { code?: number; message?: string; status?: string };
}

class GeminiApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number
  ) {
    super(message);
    this.name = 'GeminiApiError';
  }

  get isNotFound(): boolean {
    return this.status === 404 || this.code === 404;
  }

  get isQuotaExceeded(): boolean {
    return this.status === 429 || this.code === 429;
  }
}

function getApiKey(): string | undefined {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
}

function getImageModels(): string[] {
  if (process.env.GEMINI_IMAGE_MODELS) {
    return process.env.GEMINI_IMAGE_MODELS.split(',').map((m) => m.trim()).filter(Boolean);
  }
  if (process.env.GEMINI_IMAGE_MODEL) {
    const primary = process.env.GEMINI_IMAGE_MODEL.trim();
    const rest = DEFAULT_IMAGE_MODELS.filter((m) => m !== primary);
    return [primary, ...rest];
  }
  return DEFAULT_IMAGE_MODELS;
}

function isProImageModel(model: string): boolean {
  return model.includes('3-pro-image');
}

function buildGenerationConfig(model: string): Record<string, unknown> {
  const config: Record<string, unknown> = {
    responseModalities: ['TEXT', 'IMAGE'],
    temperature: isProImageModel(model) ? 0.2 : 0.4,
  };

  if (isProImageModel(model)) {
    const imageSize = process.env.GEMINI_IMAGE_SIZE?.trim() || '2K';
    config.imageConfig = { imageSize };
  }

  return config;
}

function formatApiError(status: number, body: GeminiResponse | string): GeminiApiError {
  let message = `Gemini API error (${status})`;
  let code: number | undefined;

  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as GeminiResponse;
      message = parsed.error?.message || message;
      code = parsed.error?.code;
    } catch {
      message = body.substring(0, 400);
    }
  } else if (body.error?.message) {
    message = body.error.message;
    code = body.error.code;
  }

  if (status === 429 || code === 429) {
    message =
      'Gemini image generation quota exceeded. Enable billing in Google AI Studio ' +
      '(https://aistudio.google.com/apikey) or wait and retry. Image models require paid quota on many accounts.';
  }

  return new GeminiApiError(message, status, code);
}

async function callImageModel(
  model: string,
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<{ imageBase64: string; mimeType: string; text?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: buildGenerationConfig(model),
    }),
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw formatApiError(response.status, rawText);
  }

  let result: GeminiResponse;
  try {
    result = JSON.parse(rawText) as GeminiResponse;
  } catch {
    throw new GeminiApiError('Invalid response from Gemini API', 500);
  }

  if (result.error?.message) {
    throw formatApiError(result.error.code || 500, result);
  }

  const parts = result.candidates?.[0]?.content?.parts ?? [];
  let outputImage: { data: string; mimeType: string } | null = null;
  const textParts: string[] = [];

  for (const part of parts) {
    if (part.text) textParts.push(part.text);
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      outputImage = {
        data: inline.data,
        mimeType: part.inlineData?.mimeType || part.inline_data?.mime_type || 'image/png',
      };
    }
  }

  if (!outputImage) {
    throw new Error(
      textParts.length > 0
        ? `No image generated: ${textParts.join(' ').substring(0, 300)}`
        : 'Model did not return an image. Try a clearer product photo or a different angle.'
    );
  }

  return {
    imageBase64: outputImage.data,
    mimeType: outputImage.mimeType,
    text: textParts.join('\n') || undefined,
  };
}

async function callWithModelFallback(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  prompt: string,
  preferredModel?: string
): Promise<{ result: { imageBase64: string; mimeType: string; text?: string }; model: string }> {
  const models = preferredModel
    ? [preferredModel, ...getImageModels().filter((m) => m !== preferredModel)]
    : getImageModels();
  const errors: string[] = [];

  for (const model of models) {
    try {
      console.log(`[ImageLocalize] Trying model: ${model}`);
      const result = await callImageModel(model, apiKey, imageBase64, mimeType, prompt);
      return { result, model };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${model}: ${msg}`);
      console.warn(`[ImageLocalize] Model ${model} failed:`, msg);

      if (error instanceof GeminiApiError) {
        // Don't try other models on quota/auth errors — same key, same limits
        if (error.isQuotaExceeded || error.status === 401 || error.status === 403) {
          throw error;
        }
        // Try next model only when this model doesn't exist
        if (error.isNotFound) continue;
      }

      throw error instanceof Error ? error : new Error(msg);
    }
  }

  throw new Error(
    `No image model available. Tried: ${models.join(', ')}. ${errors[errors.length - 1] || ''}`
  );
}

export async function localizeProductImage(
  imageBase64: string,
  mimeType: string,
  options?: { brandNames?: string; refine?: boolean }
): Promise<{ imageBase64: string; mimeType: string; model: string; message?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const brandNames = options?.brandNames?.trim() || 'Himalaya and other well-known international brand names';
  const prompt = LOCALIZATION_PROMPT.replace('{brandNames}', brandNames);

  const { result, model: usedModel } = await callWithModelFallback(
    apiKey,
    imageBase64,
    mimeType,
    prompt
  );

  let finalResult = result;

  if (options?.refine !== false) {
    try {
      console.log(`[ImageLocalize] Refinement pass with model: ${usedModel}`);
      const { result: refined } = await callWithModelFallback(
        apiKey,
        result.imageBase64,
        result.mimeType,
        REFINEMENT_PROMPT,
        usedModel
      );
      finalResult = refined;
    } catch (refineError) {
      console.warn('[ImageLocalize] Refinement pass skipped:', refineError);
    }
  }

  return {
    imageBase64: finalResult.imageBase64,
    mimeType: finalResult.mimeType,
    model: usedModel,
    message: finalResult.text,
  };
}
