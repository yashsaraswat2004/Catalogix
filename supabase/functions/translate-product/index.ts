import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { products } = await req.json();

    if (!Array.isArray(products) || products.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No products provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Translate] Translating ${products.length} products...`);

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('[Translate] LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Translation service not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        // Nothing to translate
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

      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are a professional translator specializing in e-commerce product listings. Translate the following English product information into natural, fluent Korean suitable for the Coupang marketplace.

Rules:
1. Maintain proper Korean grammar and natural phrasing
2. Keep brand names in their original form (do not translate brand names)
3. Use appropriate Korean e-commerce terminology
4. Keep numbers, URLs, and special characters unchanged
5. For product names, make them attractive for Korean shoppers
6. For descriptions, use polite/formal Korean (합니다/습니다 form)

Respond ONLY with a JSON object mapping field names to translated Korean text. Example:
{"productName": "번역된 상품명", "brand": "브랜드명", ...}

Do not include any explanation, just the JSON object.`
              },
              {
                role: 'user',
                content: `Translate these product fields from English to Korean:\n\n${translationPrompt}`
              }
            ],
          }),
        });

        if (!response.ok) {
          console.error(`[Translate] AI API error: ${response.status}`);
          // Keep original on error
          translatedProducts.push(product);
          continue;
        }

        const aiResult = await response.json();
        const content = aiResult.choices?.[0]?.message?.content || '';
        
        console.log(`[Translate] AI response for "${data.productName}":`, content.substring(0, 200));

        // Parse the JSON response
        let translations: Record<string, string> = {};
        try {
          // Extract JSON from response (handle potential markdown code blocks)
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
        // Keep original on error
        translatedProducts.push(product);
      }
    }

    console.log(`[Translate] Successfully processed ${translatedProducts.length} products`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        products: translatedProducts,
        message: `Translated ${translatedProducts.length} products to Korean`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Translate] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
