import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// HMAC-SHA256 signature generation following Coupang's exact specification
async function generateHmacSignature(
  method: string,
  path: string,
  query: string,
  secretKey: string,
  accessKey: string
): Promise<{ authorization: string; datetime: string }> {
  // Generate datetime in exact format: yymmddTHHMMSSZ (UTC)
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const datetime = `${now.getUTCFullYear().toString().slice(2)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  // Create the message to sign: datetime + method + path + query
  const message = datetime + method + path + query;
  
  console.log('[HMAC] Generating signature for message:', { datetime, method, path, queryLength: query.length });

  // Generate HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Create authorization header in exact format
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
  
  return { authorization, datetime };
}

// Product payload transformer - converts our format to Coupang API format
function transformProductToCoupangFormat(product: any, vendorId: string): any {
  // Extract category code from the full category string
  const categoryCode = product.category?.split('>').pop()?.trim() || product.category;
  
  // Build items array (for options/variants)
  const items = [];
  
  // Single item for products without options
  const item: any = {
    itemName: product.productName,
    originalPrice: product.discountBasePrice || product.salePrice,
    salePrice: product.salePrice,
    maximumBuyCount: product.maxPurchasePerPerson || 0,
    maximumBuyForPerson: product.maxPurchasePerPerson || 0,
    maximumBuyForPersonPeriod: product.maxPurchasePeriod || 1,
    unitCount: 1,
    adultOnly: product.adultOnly ? "ADULT_ONLY" : "EVERYONE",
    taxType: product.taxable ? "TAX" : "FREE",
    parallelImported: product.parallelImport ? "PARALLEL_IMPORTED" : "NOT_PARALLEL_IMPORTED",
    overseasPurchased: product.overseasPurchase ? "OVERSEAS_PURCHASED" : "NOT_OVERSEAS_PURCHASED",
    vendorItemId: product.vendorProductCode || `ITEM-${Date.now()}`,
    modelNo: product.modelNumber || "",
    barcode: product.barcode || "",
    images: [
      {
        imageOrder: 0,
        imageType: "REPRESENTATION",
        vendorPath: product.mainImage
      }
    ],
    contents: [
      {
        contentsType: "TEXT",
        contentDetails: [
          {
            content: product.detailedDescription || product.productName,
            detailType: "TEXT"
          }
        ]
      }
    ],
    attributes: []
  };

  // Add additional images if present
  if (product.additionalImages && Array.isArray(product.additionalImages)) {
    product.additionalImages.forEach((img: string, idx: number) => {
      if (img && img.trim()) {
        item.images.push({
          imageOrder: idx + 1,
          imageType: "DETAIL",
          vendorPath: img.trim()
        });
      }
    });
  }

  // Add search options as attributes if present
  if (product.optionType1 && product.optionValue1) {
    item.attributes.push({
      attributeTypeName: product.optionType1,
      attributeValueName: product.optionValue1
    });
  }
  if (product.optionType2 && product.optionValue2) {
    item.attributes.push({
      attributeTypeName: product.optionType2,
      attributeValueName: product.optionValue2
    });
  }

  items.push(item);

  // Build the full product payload
  return {
    displayCategoryCode: parseInt(categoryCode) || 0,
    sellerProductName: product.productName,
    vendorId: vendorId,
    saleStartedAt: product.saleStartDate || new Date().toISOString().split('T')[0],
    saleEndedAt: product.saleEndDate || "2099-12-31",
    brand: product.brand,
    generalProductName: product.productName,
    productGroup: "",
    deliveryMethod: "SEQUENCIAL",
    deliveryCompanyCode: "CJGLS",
    deliveryChargeType: "FREE",
    deliveryCharge: 0,
    freeShipOverAmount: 0,
    deliveryChargeOnReturn: 5000,
    remoteAreaDeliverable: "Y",
    unionDeliveryType: "NOT_UNION_DELIVERY",
    returnCenterCode: "",
    returnChargeName: "",
    companyContactNumber: "",
    returnZipCode: "",
    returnAddress: "",
    returnAddressDetail: "",
    returnCharge: 5000,
    returnChargeVendor: "N",
    afterServiceInformation: "",
    afterServiceContactNumber: "",
    outboundShippingPlaceCode: "",
    vendorUserId: "",
    requested: false,
    items: items,
    requiredDocuments: [],
    extraInfoMessage: "",
    manufacture: product.manufacturer || product.brand,
    notices: []
  };
}

// Validate credentials by making a lightweight API call
async function validateCredentials(accessKey: string, secretKey: string, vendorId: string): Promise<{ valid: boolean; message: string }> {
  const method = "GET";
  const path = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`;
  const query = `vendorId=${vendorId}&nextToken=&maxPerPage=1&status=APPROVED`;
  
  try {
    const { authorization } = await generateHmacSignature(method, path, query, secretKey, accessKey);
    
    const response = await fetch(`https://api-gateway.coupang.com${path}?${query}`, {
      method,
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json;charset=UTF-8'
      }
    });

    console.log('[Validate] Response status:', response.status);
    
    if (response.status === 200) {
      return { valid: true, message: 'API credentials are valid' };
    } else if (response.status === 401) {
      return { valid: false, message: 'Invalid API credentials. Please check your Access Key and Secret Key.' };
    } else if (response.status === 403) {
      return { valid: false, message: 'Access forbidden. Please check your Vendor ID and API permissions.' };
    } else {
      const body = await response.text();
      console.log('[Validate] Response body:', body);
      return { valid: false, message: `API error (${response.status}): ${body.slice(0, 200)}` };
    }
  } catch (error: unknown) {
    console.error('[Validate] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, message: `Connection error: ${errorMessage}` };
  }
}

// Upload a single product with full error handling
async function uploadProduct(
  product: any,
  accessKey: string,
  secretKey: string,
  vendorId: string
): Promise<{ success: boolean; productId?: string; error?: string; details?: any }> {
  const method = "POST";
  const path = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`;
  const query = "";
  
  try {
    // Transform product to Coupang format
    const payload = transformProductToCoupangFormat(product, vendorId);
    
    console.log('[Upload] Uploading product:', product.productName);
    console.log('[Upload] Payload preview:', JSON.stringify(payload).slice(0, 500));

    const { authorization } = await generateHmacSignature(method, path, query, secretKey, accessKey);

    const response = await fetch(`https://api-gateway.coupang.com${path}`, {
      method,
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json;charset=UTF-8'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log('[Upload] Response status:', response.status);
    console.log('[Upload] Response body:', responseText.slice(0, 500));

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { rawResponse: responseText };
    }

    if (response.status === 200 || response.status === 201) {
      return {
        success: true,
        productId: responseData.data?.sellerProductId || responseData.sellerProductId,
        details: responseData
      };
    } else {
      return {
        success: false,
        error: responseData.message || responseData.error || `HTTP ${response.status}`,
        details: responseData
      };
    }
  } catch (error: unknown) {
    console.error('[Upload] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      error: errorMessage
    };
  }
}

// Batch upload with controlled concurrency and progress tracking
async function batchUpload(
  products: any[],
  accessKey: string,
  secretKey: string,
  vendorId: string,
  batchSize: number = 1
): Promise<{ results: any[]; successCount: number; failedCount: number }> {
  const results: any[] = [];
  let successCount = 0;
  let failedCount = 0;

  // Process one at a time to be safe with API rate limits
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    console.log(`[Batch] Processing product ${i + 1}/${products.length}: ${product.productName}`);
    
    const result = await uploadProduct(product, accessKey, secretKey, vendorId);
    
    results.push({
      productIndex: i,
      productName: product.productName,
      ...result
    });

    if (result.success) {
      successCount++;
    } else {
      failedCount++;
    }

    // Add delay between requests to respect rate limits
    if (i < products.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return { results, successCount, failedCount };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, credentials, products, dryRun } = await req.json();

    console.log('[API] Action:', action, '| Products count:', products?.length || 0, '| Dry run:', dryRun);

    // Validate request has credentials
    if (!credentials || !credentials.accessKey || !credentials.secretKey || !credentials.vendorId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing API credentials. Please provide accessKey, secretKey, and vendorId.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { accessKey, secretKey, vendorId } = credentials;

    // Handle different actions
    switch (action) {
      case 'validate': {
        // Only validate credentials without uploading
        const validation = await validateCredentials(accessKey, secretKey, vendorId);
        return new Response(
          JSON.stringify({ success: validation.valid, message: validation.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'upload': {
        // Validate products array
        if (!products || !Array.isArray(products) || products.length === 0) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'No products provided for upload.' 
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // If dry run, just validate and return transformed payloads
        if (dryRun) {
          console.log('[API] Dry run mode - validating without API calls');
          const transformedProducts = products.map((p, idx) => ({
            index: idx,
            original: p,
            transformed: transformProductToCoupangFormat(p, vendorId)
          }));
          
          return new Response(
            JSON.stringify({
              success: true,
              dryRun: true,
              message: `Validated ${products.length} products. Ready for upload.`,
              products: transformedProducts
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // First validate credentials before attempting upload
        const credValidation = await validateCredentials(accessKey, secretKey, vendorId);
        if (!credValidation.valid) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: credValidation.message 
            }),
            { 
              status: 401, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Perform batch upload
        const uploadResult = await batchUpload(products, accessKey, secretKey, vendorId);
        
        return new Response(
          JSON.stringify({
            success: uploadResult.failedCount === 0,
            message: `Uploaded ${uploadResult.successCount}/${products.length} products successfully.`,
            successCount: uploadResult.successCount,
            failedCount: uploadResult.failedCount,
            results: uploadResult.results
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'test-signature': {
        // Test endpoint to verify HMAC signature generation
        const testPath = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products';
        const testQuery = `vendorId=${vendorId}&nextToken=&maxPerPage=1`;
        const { authorization, datetime } = await generateHmacSignature('GET', testPath, testQuery, secretKey, accessKey);
        
        return new Response(
          JSON.stringify({
            success: true,
            datetime,
            authorization: authorization.slice(0, 50) + '...',
            message: 'HMAC signature generated successfully. Use validate action to test with actual API.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Unknown action: ${action}. Supported actions: validate, upload, test-signature` 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }
  } catch (error: unknown) {
    console.error('[API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
