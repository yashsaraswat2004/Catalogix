import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// HMAC-SHA256 signature generation following Coupang's exact specification
// Reference: https://developers.coupangcorp.com/hc/en-us/articles/360033461914-Creating-HMAC-Signature
async function generateHmacSignature(
  method: string,
  path: string,
  query: string,
  secretKey: string,
  accessKey: string
): Promise<{ authorization: string; datetime: string }> {
  // Generate datetime in exact format: yyMMdd'T'HHmmss'Z' (UTC)
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const datetime = `${now.getUTCFullYear().toString().slice(2)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  // Create the message to sign: datetime + method + path + query
  const message = datetime + method + path + query;
  
  console.log('[HMAC] Generating signature:', { datetime, method, path, queryLength: query.length });

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
  // Format: "CEA algorithm=HmacSHA256, access-key={accessKey}, signed-date={datetime}, signature={signature}"
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
  
  return { authorization, datetime };
}

// Transform internal product format to exact Coupang API format
// Reference: https://developers.coupangcorp.com/hc/en-us/articles/360033877853-Product-Creation
function transformProductToCoupangFormat(product: any, vendorId: string, wingSettings: any): any {
  // Extract category code - if it's a path like "123>456>789", take the last one
  let categoryCode = 0;
  if (product.category) {
    const parts = product.category.toString().split('>');
    const lastPart = parts[parts.length - 1].trim();
    categoryCode = parseInt(lastPart) || 0;
  }

  // Format dates to Coupang format: yyyy-MM-dd'T'HH:mm:ss
  const formatDate = (dateStr: string, isEnd: boolean = false): string => {
    if (!dateStr) {
      const now = new Date();
      if (isEnd) {
        return "2099-12-31T23:59:59";
      }
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`;
    }
    // Try to parse the date
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return isEnd ? "2099-12-31T23:59:59" : new Date().toISOString().split('T')[0] + "T00:00:00";
      }
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${isEnd ? '23:59:59' : '00:00:00'}`;
    } catch {
      return isEnd ? "2099-12-31T23:59:59" : new Date().toISOString().split('T')[0] + "T00:00:00";
    }
  };

  // Build attributes array from product options
  const attributes: any[] = [];
  if (product.optionType1 && product.optionValue1) {
    attributes.push({
      attributeTypeName: product.optionType1.substring(0, 25),
      attributeValueName: product.optionValue1.substring(0, 30)
    });
  }
  if (product.optionType2 && product.optionValue2) {
    attributes.push({
      attributeTypeName: product.optionType2.substring(0, 25),
      attributeValueName: product.optionValue2.substring(0, 30)
    });
  }
  if (product.optionType3 && product.optionValue3) {
    attributes.push({
      attributeTypeName: product.optionType3.substring(0, 25),
      attributeValueName: product.optionValue3.substring(0, 30)
    });
  }
  if (product.optionType4 && product.optionValue4) {
    attributes.push({
      attributeTypeName: product.optionType4.substring(0, 25),
      attributeValueName: product.optionValue4.substring(0, 30)
    });
  }

  // If no attributes, create a default one (required by Coupang)
  if (attributes.length === 0) {
    attributes.push({
      attributeTypeName: "수량",
      attributeValueName: "1개"
    });
  }

  // Build images array
  const images: any[] = [];
  if (product.mainImage) {
    images.push({
      imageOrder: 0,
      imageType: "REPRESENTATION",
      vendorPath: product.mainImage.trim()
    });
  }
  
  // Add additional images (up to 9 DETAIL images)
  if (product.additionalImages && Array.isArray(product.additionalImages)) {
    product.additionalImages.slice(0, 9).forEach((img: string, idx: number) => {
      if (img && img.trim()) {
        images.push({
          imageOrder: idx + 1,
          imageType: "DETAIL",
          vendorPath: img.trim()
        });
      }
    });
  }

  // Build contents array for product description
  const contents: any[] = [];
  if (product.detailedDescription) {
    // Check if description is HTML
    const isHtml = /<[^>]+>/.test(product.detailedDescription);
    contents.push({
      contentsType: isHtml ? "HTML" : "TEXT",
      contentDetails: [{
        content: product.detailedDescription,
        detailType: "TEXT"
      }]
    });
  }

  // Build search tags from keywords
  const searchTags: string[] = [];
  if (product.searchKeywords) {
    const keywords = product.searchKeywords.split(',').map((k: string) => k.trim()).filter((k: string) => k);
    keywords.slice(0, 20).forEach((keyword: string) => {
      if (keyword.length <= 20) {
        searchTags.push(keyword);
      }
    });
  }

  // Build certification info
  const certifications: any[] = [];
  if (product.certInfoType1) {
    certifications.push({
      certificationType: product.certInfoType1,
      certificationCode: product.certInfoValue1 || ""
    });
  } else {
    // Default: certification not required
    certifications.push({
      certificationType: "NOT_REQUIRED",
      certificationCode: ""
    });
  }

  // Build the single item
  const item = {
    itemName: (product.productName || "Product").substring(0, 150),
    originalPrice: Math.round(product.discountBasePrice || product.salePrice || 0),
    salePrice: Math.round(product.salePrice || 0),
    maximumBuyCount: Math.min(Math.round(product.stockQuantity || 100), 99999),
    maximumBuyForPerson: Math.round(product.maxPurchasePerPerson || 0),
    maximumBuyForPersonPeriod: Math.round(product.maxPurchasePeriod || 1) || 1,
    outboundShippingTimeDay: Math.round(product.leadTime || 1) || 1,
    unitCount: 1,
    adultOnly: product.adultOnly ? "ADULT_ONLY" : "EVERYONE",
    taxType: product.taxable === false ? "FREE" : "TAX",
    parallelImported: product.parallelImport ? "PARALLEL_IMPORTED" : "NOT_PARALLEL_IMPORTED",
    overseasPurchased: product.overseasPurchase ? "OVERSEAS_PURCHASED" : "NOT_OVERSEAS_PURCHASED",
    pccNeeded: product.overseasPurchase ? true : false,
    externalVendorSku: product.vendorProductCode || "",
    barcode: product.barcode || "",
    emptyBarcode: !product.barcode,
    emptyBarcodeReason: !product.barcode ? "상품확인불가_바코드없음사유" : "",
    modelNo: product.modelNumber || "",
    certifications: certifications,
    searchTags: searchTags,
    images: images,
    attributes: attributes,
    contents: contents.length > 0 ? contents : [{
      contentsType: "TEXT",
      contentDetails: [{
        content: product.productName || "Product",
        detailType: "TEXT"
      }]
    }],
    offerCondition: "NEW",
    offerDescription: ""
  };

  // Build the full product payload matching Coupang API exactly
  const payload = {
    displayCategoryCode: categoryCode,
    sellerProductName: (product.productName || "").substring(0, 100),
    vendorId: vendorId,
    saleStartedAt: formatDate(product.saleStartDate, false),
    saleEndedAt: formatDate(product.saleEndDate, true),
    displayProductName: product.brand ? `${product.brand} ${product.productName}`.substring(0, 100) : undefined,
    brand: product.brand || "",
    generalProductName: (product.productName || "").substring(0, 100),
    productGroup: "",
    deliveryMethod: "SEQUENCIAL",
    deliveryCompanyCode: wingSettings.deliveryCompanyCode || "CJGLS",
    deliveryChargeType: "FREE",
    deliveryCharge: 0,
    freeShipOverAmount: 0,
    deliveryChargeOnReturn: Math.round(wingSettings.deliveryChargeOnReturn || 2500),
    remoteAreaDeliverable: "N",
    unionDeliveryType: "NOT_UNION_DELIVERY",
    returnCenterCode: wingSettings.returnCenterCode || "",
    returnChargeName: wingSettings.returnChargeName || "",
    companyContactNumber: wingSettings.companyContactNumber || "",
    returnZipCode: wingSettings.returnZipCode || "",
    returnAddress: wingSettings.returnAddress || "",
    returnAddressDetail: wingSettings.returnAddressDetail || "",
    returnCharge: Math.round(wingSettings.returnCharge || 2500),
    outboundShippingPlaceCode: parseInt(wingSettings.outboundShippingPlaceCode) || 0,
    vendorUserId: wingSettings.vendorUserId || "",
    requested: true, // Auto-submit for approval - products go live after Coupang approves
    items: [item],
    requiredDocuments: [],
    extraInfoMessage: "",
    manufacture: product.manufacturer || product.brand || "",
    bundleInfo: {
      bundleType: "SINGLE"
    }
  };

  return payload;
}

// Validate product data before transformation
function validateProductForUpload(product: any, wingSettings: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required product fields
  if (!product.category) errors.push("Category is required");
  if (!product.productName) errors.push("Product name is required");
  if (!product.salePrice || product.salePrice <= 0) errors.push("Sale price must be greater than 0");
  if (!product.discountBasePrice || product.discountBasePrice <= 0) errors.push("Discount base price must be greater than 0");
  if (!product.stockQuantity || product.stockQuantity <= 0) errors.push("Stock quantity must be greater than 0");
  if (!product.leadTime || product.leadTime < 1) errors.push("Lead time must be at least 1 day");
  if (!product.mainImage) errors.push("Main image URL is required");
  if (!product.detailedDescription) errors.push("Detailed description is required");
  if (!product.brand) errors.push("Brand is required");
  if (!product.manufacturer) errors.push("Manufacturer is required");

  // Validate image URL format
  if (product.mainImage && !product.mainImage.startsWith('http')) {
    errors.push("Main image must be a valid URL starting with http:// or https://");
  }

  // Required Wing settings
  if (!wingSettings.returnCenterCode) errors.push("Return Center Code is required (from Wing settings)");
  if (!wingSettings.returnChargeName) errors.push("Return Location Name is required (from Wing settings)");
  if (!wingSettings.companyContactNumber) errors.push("Contact Number is required (from Wing settings)");
  if (!wingSettings.returnZipCode) errors.push("Return Postal Code is required (from Wing settings)");
  if (!wingSettings.returnAddress) errors.push("Return Address is required (from Wing settings)");
  if (!wingSettings.returnAddressDetail) errors.push("Return Address Detail is required (from Wing settings)");
  if (!wingSettings.outboundShippingPlaceCode) errors.push("Shipping Place Code is required (from Wing settings)");
  if (!wingSettings.deliveryCompanyCode) errors.push("Courier Code is required (from Wing settings)");
  if (!wingSettings.vendorUserId) errors.push("Wing Login ID is required (from Wing settings)");

  return { valid: errors.length === 0, errors };
}

// Validate credentials by making a lightweight API call
async function validateCredentials(accessKey: string, secretKey: string, vendorId: string): Promise<{ valid: boolean; message: string }> {
  const method = "GET";
  const path = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`;
  const query = `vendorId=${vendorId}&nextToken=&maxPerPage=1&status=APPROVED`;
  
  try {
    const { authorization } = await generateHmacSignature(method, path, query, secretKey, accessKey);
    
    console.log('[Validate] Making API request...');
    const response = await fetch(`https://api-gateway.coupang.com${path}?${query}`, {
      method,
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json;charset=UTF-8'
      }
    });

    console.log('[Validate] Response status:', response.status);
    const responseText = await response.text();
    console.log('[Validate] Response body:', responseText.slice(0, 500));
    
    if (response.status === 200) {
      return { valid: true, message: 'API credentials verified successfully!' };
    } else if (response.status === 401) {
      return { valid: false, message: 'Invalid API credentials. Please check your Access Key and Secret Key.' };
    } else if (response.status === 403) {
      // Parse response to check for IP whitelist issue
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.message && errorData.message.includes('ip address')) {
          // Extract IP from message
          const ipMatch = errorData.message.match(/(\d+\.\d+\.\d+\.\d+)/);
          const ip = ipMatch ? ipMatch[1] : 'unknown';
          return { 
            valid: false, 
            message: `IP not whitelisted. Please add IP "${ip}" to your Wing API settings (Seller Info → Open API → IP Whitelist).` 
          };
        }
      } catch {}
      return { valid: false, message: 'Access forbidden. Please check your Vendor ID and API permissions.' };
    } else {
      return { valid: false, message: `API error (${response.status}): ${responseText.slice(0, 200)}` };
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
  vendorId: string,
  wingSettings: any
): Promise<{ success: boolean; productId?: string; error?: string; details?: any; payload?: any }> {
  const method = "POST";
  const path = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`;
  const query = "";
  
  try {
    // Validate product data first
    const validation = validateProductForUpload(product, wingSettings);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
        details: { validationErrors: validation.errors }
      };
    }

    // Transform product to Coupang format
    const payload = transformProductToCoupangFormat(product, vendorId, wingSettings);
    
    console.log('[Upload] Uploading product:', product.productName);
    console.log('[Upload] Payload:', JSON.stringify(payload, null, 2).slice(0, 2000));

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
    console.log('[Upload] Response body:', responseText.slice(0, 1000));

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
        details: responseData,
        payload: payload
      };
    } else {
      // Extract detailed error message from Coupang response
      let errorMsg = `HTTP ${response.status}`;
      if (responseData.message) {
        errorMsg = responseData.message;
      } else if (responseData.data?.message) {
        errorMsg = responseData.data.message;
      } else if (responseData.error) {
        errorMsg = responseData.error;
      }
      
      return {
        success: false,
        error: errorMsg,
        details: responseData,
        payload: payload
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

// Batch upload with rate limiting (max 10 per second per Coupang docs)
async function batchUpload(
  products: any[],
  accessKey: string,
  secretKey: string,
  vendorId: string,
  wingSettings: any
): Promise<{ results: any[]; successCount: number; failedCount: number }> {
  const results: any[] = [];
  let successCount = 0;
  let failedCount = 0;

  // Process one at a time with 150ms delay (ensuring under 10 per second)
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    console.log(`[Batch] Processing product ${i + 1}/${products.length}: ${product.productName}`);
    
    const result = await uploadProduct(product, accessKey, secretKey, vendorId, wingSettings);
    
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

    // Rate limiting: 150ms delay between requests (allows ~6-7 per second, well under limit)
    if (i < products.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 150));
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
    const { action, credentials, products, wingSettings, dryRun } = await req.json();

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

        // Validate wing settings
        if (!wingSettings) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Wing settings are required. Please configure return location and shipping settings.' 
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // If dry run, validate and return transformed payloads without API calls
        if (dryRun) {
          console.log('[API] Dry run mode - validating without API calls');
          
          const transformedProducts = products.map((p: any, idx: number) => {
            const validation = validateProductForUpload(p, wingSettings);
            let transformed = null;
            
            if (validation.valid) {
              transformed = transformProductToCoupangFormat(p, vendorId, wingSettings);
            }
            
            return {
              index: idx,
              productName: p.productName,
              valid: validation.valid,
              errors: validation.errors,
              transformed: transformed
            };
          });
          
          const validCount = transformedProducts.filter((p: any) => p.valid).length;
          const invalidCount = transformedProducts.filter((p: any) => !p.valid).length;
          
          return new Response(
            JSON.stringify({
              success: invalidCount === 0,
              dryRun: true,
              message: invalidCount === 0 
                ? `All ${validCount} products are valid and ready for upload.`
                : `${invalidCount} product(s) have validation errors. Please fix them before uploading.`,
              validCount,
              invalidCount,
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
        const uploadResult = await batchUpload(products, accessKey, secretKey, vendorId, wingSettings);
        
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

      case 'validate-products': {
        // Validate products without uploading
        if (!products || !Array.isArray(products) || products.length === 0) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'No products provided for validation.' 
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        const validationResults = products.map((p: any, idx: number) => {
          const validation = validateProductForUpload(p, wingSettings || {});
          return {
            index: idx,
            productName: p.productName,
            valid: validation.valid,
            errors: validation.errors
          };
        });

        const validCount = validationResults.filter((r: any) => r.valid).length;

        return new Response(
          JSON.stringify({
            success: true,
            validCount,
            invalidCount: validationResults.length - validCount,
            results: validationResults
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
            authorization: authorization.slice(0, 80) + '...',
            message: 'HMAC signature generated successfully. Use validate action to test with actual API.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'fetch-shipping-centers': {
        // Fetch return shipping centers and outbound shipping places from Coupang API
        console.log('[API] Fetching shipping centers for vendor:', vendorId);
        
        const results: { returnCenters: any[]; shippingPlaces: any[]; error?: string } = {
          returnCenters: [],
          shippingPlaces: []
        };

        // Fetch return shipping centers
        try {
          const returnPath = `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/returnShippingCenters`;
          const returnQuery = `pageSize=50&pageNum=1`;
          const { authorization: returnAuth } = await generateHmacSignature('GET', returnPath, returnQuery, secretKey, accessKey);
          
          console.log('[API] Fetching return centers...');
          const returnResponse = await fetch(`https://api-gateway.coupang.com${returnPath}?${returnQuery}`, {
            method: 'GET',
            headers: {
              'Authorization': returnAuth,
              'Content-Type': 'application/json;charset=UTF-8'
            }
          });

          const returnText = await returnResponse.text();
          console.log('[API] Return centers response:', returnResponse.status, returnText.slice(0, 500));
          
          if (returnResponse.status === 200) {
            const returnData = JSON.parse(returnText);
            if (returnData.data && Array.isArray(returnData.data)) {
              results.returnCenters = returnData.data.map((center: any) => ({
                code: center.returnCenterCode,
                name: center.shippingPlaceName || center.returnCenterName || 'Unknown',
                address: center.returnAddress || '',
                zipCode: center.returnZipCode || '',
                contactNumber: center.companyContactNumber || ''
              }));
            }
          }
        } catch (err) {
          console.error('[API] Error fetching return centers:', err);
        }

        // Fetch outbound shipping places
        try {
          const shippingPath = `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/outboundShippingCenters`;
          const shippingQuery = `pageSize=50&pageNum=1`;
          const { authorization: shippingAuth } = await generateHmacSignature('GET', shippingPath, shippingQuery, secretKey, accessKey);
          
          console.log('[API] Fetching outbound shipping places...');
          const shippingResponse = await fetch(`https://api-gateway.coupang.com${shippingPath}?${shippingQuery}`, {
            method: 'GET',
            headers: {
              'Authorization': shippingAuth,
              'Content-Type': 'application/json;charset=UTF-8'
            }
          });

          const shippingText = await shippingResponse.text();
          console.log('[API] Shipping places response:', shippingResponse.status, shippingText.slice(0, 500));
          
          if (shippingResponse.status === 200) {
            const shippingData = JSON.parse(shippingText);
            if (shippingData.data && Array.isArray(shippingData.data)) {
              results.shippingPlaces = shippingData.data.map((place: any) => ({
                code: place.outboundShippingPlaceCode,
                name: place.shippingPlaceName || 'Unknown',
                address: place.placeAddresses?.[0]?.returnAddress || '',
                zipCode: place.placeAddresses?.[0]?.returnZipCode || ''
              }));
            }
          }
        } catch (err) {
          console.error('[API] Error fetching shipping places:', err);
        }

        return new Response(
          JSON.stringify({
            success: true,
            ...results,
            message: `Found ${results.returnCenters.length} return center(s) and ${results.shippingPlaces.length} shipping place(s).`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Unknown action: ${action}. Supported actions: validate, upload, validate-products, test-signature` 
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
