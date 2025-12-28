import { Router, Request, Response } from 'express';

const router = Router();

// Fields that need translation
const TRANSLATABLE_FIELDS = [
  'productName',
  'brand',
  'manufacturer',
  'searchKeywords',
  'optionType1',
  'optionValue1',
  'optionType2',
  'optionValue2',
  'optionType3',
  'optionValue3',
  'optionType4',
  'optionValue4',
  'detailedDescription',
];

router.post('/', async (req: Request, res: Response) => {
  try {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.json({ success: false, error: 'No products provided' });
    }

    console.log(`[Translate] Translating ${products.length} products...`);

    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      console.error('[Translate] GEMINI_API_KEY not configured');
      return res.json({ success: false, error: 'Translation service not configured' });
    }

    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

    const translatedProducts = [];

    for (const product of products) {
      const data = product.data;
      
      // Check if translation is needed
      if (!data.needsTranslation) {
        translatedProducts.push(product);
        continue;
      }

      // Collect all English text fields that need translation
      const textsToTranslate: { field: string; text: string }[] = [];
      
      for (const field of TRANSLATABLE_FIELDS) {
        const value = data[field];
        if (value && typeof value === 'string' && value.trim()) {
          textsToTranslate.push({ field, text: value });
        }
      }

      if (textsToTranslate.length === 0) {
        translatedProducts.push({
          ...product,
          data: { ...data, needsTranslation: false }
        });
        continue;
      }

      console.log(`[Translate] Product "${data.productName}": ${textsToTranslate.length} fields to translate`);

      // Build a single prompt with all fields to translate
      const translationPrompt = textsToTranslate.map((t, i) => 
        `${i + 1}. [${t.field}]: ${t.text}`
      ).join('\n');

      const systemPrompt = `You are a professional translator specializing in e-commerce product listings. Translate the following English product information into natural, fluent Korean suitable for the Coupang marketplace.

Rules:
1. Maintain proper Korean grammar and natural phrasing
2. Keep brand names in their original form (do not translate brand names)
3. Use appropriate Korean e-commerce terminology
4. Keep numbers, URLs, and special characters unchanged
5. For product names, make them attractive for Korean shoppers
6. For descriptions, use polite/formal Korean (합니다/습니다 form)

Respond ONLY with a JSON object mapping field names to translated Korean text. Example:
{"productName": "번역된 상품명", "brand": "브랜드명", ...}

Do not include any explanation, just the JSON object.`;

      try {
        const response = await fetch(geminiApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${systemPrompt}\n\nTranslate these product fields from English to Korean:\n\n${translationPrompt}`
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048,
            }
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Translate] Gemini API error: ${response.status}`, errorText);
          translatedProducts.push(product);
          continue;
        }

        const aiResult = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const content = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        console.log(`[Translate] AI response for "${data.productName}":`, content.substring(0, 200));

        // Parse the JSON response
        let translations: Record<string, string> = {};
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            translations = JSON.parse(jsonMatch[0]);
          }
        } catch (parseErr) {
          console.error('[Translate] Failed to parse AI response as JSON:', parseErr);
        }

        // Apply translations to product data
        const translatedData = { ...data };
        for (const field of TRANSLATABLE_FIELDS) {
          if (translations[field]) {
            translatedData[field] = translations[field];
          }
        }
        translatedData.needsTranslation = false;

        translatedProducts.push({
          ...product,
          data: translatedData
        });

      } catch (aiError) {
        console.error(`[Translate] Error translating product:`, aiError);
        translatedProducts.push(product);
      }
    }

    console.log(`[Translate] Successfully processed ${translatedProducts.length} products`);

    return res.json({ 
      success: true, 
      products: translatedProducts,
      message: `Translated ${translatedProducts.length} products to Korean`
    });

  } catch (error) {
    console.error('[Translate] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: errorMessage });
  }
});

export default router;
