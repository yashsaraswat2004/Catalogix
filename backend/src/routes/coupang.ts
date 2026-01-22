import { Router, Request, Response } from 'express';
import {
  validateCredentials,
  validateProductForUpload,
  transformProductToCoupangFormat,
  batchUpload,
  fetchShippingCenters,
  fetchDisplayCategoryStatus,
  fetchCategoryRelatedMeta,
  recommendCategory,
  getCategoryRequiredAttributes
} from '../services/coupangApi';
import { generateHmacSignature } from '../services/hmacSignature';

const router = Router();

const VALID_ACTIONS = [
  'validate', 'upload', 'validate-products', 'test-signature',
  'fetch-shipping-centers', 'recommend-category', 'validate-category', 
  'fetch-category-meta', 'get-required-attributes'
];

function sanitizeString(str: any): string {
  if (typeof str !== 'string') return '';
  // Remove potential XSS/injection characters but keep Korean and other unicode
  return str.trim().slice(0, 10000);
}

function validateCredentialsInput(credentials: any): { valid: boolean; error?: string } {
  if (!credentials || typeof credentials !== 'object') {
    return { valid: false, error: 'Credentials must be an object' };
  }
  
  const { accessKey, secretKey, vendorId } = credentials;
  
  if (!accessKey || typeof accessKey !== 'string' || accessKey.length < 10) {
    return { valid: false, error: 'Invalid Access Key format' };
  }
  if (!secretKey || typeof secretKey !== 'string' || secretKey.length < 10) {
    return { valid: false, error: 'Invalid Secret Key format' };
  }
  if (!vendorId || typeof vendorId !== 'string' || vendorId.length < 3) {
    return { valid: false, error: 'Invalid Vendor ID format' };
  }
  
  return { valid: true };
}

function validateProductsInput(products: any): { valid: boolean; error?: string } {
  if (!Array.isArray(products)) {
    return { valid: false, error: 'Products must be an array' };
  }
  if (products.length === 0) {
    return { valid: false, error: 'No products provided' };
  }
  if (products.length > 1000) {
    return { valid: false, error: 'Maximum 1000 products per batch' };
  }
  return { valid: true };
}

// Main endpoint - handles all actions via POST body
router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      action, 
      credentials, 
      products, 
      wingSettings, 
      dryRun,
      productName,
      productDescription,
      brand,
      attributes: reqAttributes,
      categoryCode: reqCategoryCode
    } = req.body;

    // Validate action
    if (!action || !VALID_ACTIONS.includes(action)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid action. Valid actions: ${VALID_ACTIONS.join(', ')}` 
      });
    }

    console.log('[API] Action:', action, '| Products count:', products?.length || 0, '| Dry run:', dryRun);

    // Validate credentials
    const credCheck = validateCredentialsInput(credentials);
    if (!credCheck.valid) {
      return res.status(400).json({ 
        success: false, 
        error: credCheck.error || 'Invalid credentials'
      });
    }

    const { accessKey, secretKey, vendorId } = credentials;

    switch (action) {
      case 'validate': {
        const validation = await validateCredentials(accessKey, secretKey, vendorId);
        return res.json({ success: validation.valid, message: validation.message });
      }

      case 'upload': {
        // Validate products array
        const productsCheck = validateProductsInput(products);
        if (!productsCheck.valid) {
          return res.status(400).json({ 
            success: false, 
            error: productsCheck.error 
          });
        }

        if (!wingSettings) {
          return res.status(400).json({ 
            success: false, 
            error: 'Wing settings are required. Please configure return location and shipping settings.' 
          });
        }

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
          
          return res.json({
            success: invalidCount === 0,
            dryRun: true,
            message: invalidCount === 0 
              ? `All ${validCount} products are valid and ready for upload.`
              : `${invalidCount} product(s) have validation errors. Please fix them before uploading.`,
            validCount,
            invalidCount,
            products: transformedProducts
          });
        }

        // Validate credentials first
        const credValidation = await validateCredentials(accessKey, secretKey, vendorId);
        if (!credValidation.valid) {
          return res.status(401).json({ 
            success: false, 
            error: credValidation.message 
          });
        }

        // Perform batch upload
        const uploadResult = await batchUpload(products, accessKey, secretKey, vendorId, wingSettings);
        
        return res.json({
          success: uploadResult.failedCount === 0,
          message: `Uploaded ${uploadResult.successCount}/${products.length} products successfully.`,
          successCount: uploadResult.successCount,
          failedCount: uploadResult.failedCount,
          results: uploadResult.results
        });
      }

      case 'validate-products': {
        // Validate products array
        const valProductsCheck = validateProductsInput(products);
        if (!valProductsCheck.valid) {
          return res.status(400).json({ 
            success: false, 
            error: valProductsCheck.error 
          });
        }

        const validationResults = products.map((p: any, idx: number) => {
          const validation = validateProductForUpload(p, wingSettings || {});
          return {
            index: idx,
            productName: sanitizeString(p.productName),
            valid: validation.valid,
            errors: validation.errors
          };
        });

        const validCount = validationResults.filter((r: any) => r.valid).length;

        return res.json({
          success: true,
          validCount,
          invalidCount: validationResults.length - validCount,
          results: validationResults
        });
      }

      case 'test-signature': {
        const testPath = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products';
        const testQuery = `vendorId=${vendorId}&nextToken=&maxPerPage=1`;
        const { authorization, datetime } = generateHmacSignature('GET', testPath, testQuery, secretKey, accessKey);
        
        return res.json({
          success: true,
          datetime,
          authorization: authorization.slice(0, 80) + '...',
          message: 'HMAC signature generated successfully. Use validate action to test with actual API.'
        });
      }

      case 'fetch-shipping-centers': {
        console.log('[API] Fetching shipping centers for vendor:', vendorId);
        
        const results = await fetchShippingCenters(accessKey, secretKey, vendorId);

        return res.json({
          success: true,
          ...results,
          message: `Found ${results.returnCenters.length} return center(s) and ${results.shippingPlaces.length} shipping place(s).`,
          note: results.returnCenters.length === 0 
            ? 'If no return centers found, create one in WING or use "NO_RETURN_CENTERCODE" to manually add return location info.'
            : undefined
        });
      }

      case 'recommend-category': {
        if (!productName) {
          return res.status(400).json({ 
            success: false, 
            error: 'Product name is required for category recommendation.' 
          });
        }

        const result = await recommendCategory(accessKey, secretKey, productName, productDescription, brand, reqAttributes);
        
        if (result.success) {
          return res.json({
            success: true,
            categoryCode: result.categoryCode,
            categoryName: result.categoryName,
            message: `Recommended category: ${result.categoryName} (${result.categoryCode})`
          });
        } else {
          return res.json({
            success: false,
            error: result.error
          });
        }
      }

      case 'validate-category': {
        if (!reqCategoryCode) {
          return res.status(400).json({ 
            success: false, 
            error: 'Category code is required.' 
          });
        }

        const cache = new Map<number, boolean>();
        const isValid = await fetchDisplayCategoryStatus(parseInt(reqCategoryCode), accessKey, secretKey, cache);

        return res.json({ 
          success: true, 
          valid: isValid, 
          categoryCode: reqCategoryCode 
        });
      }

      case 'fetch-category-meta': {
        if (!reqCategoryCode) {
          return res.status(400).json({ 
            success: false, 
            error: 'Category code is required.' 
          });
        }

        try {
          const cache = new Map<number, any>();
          const meta = await fetchCategoryRelatedMeta(parseInt(reqCategoryCode), accessKey, secretKey, cache);
          
          return res.json({ 
            success: true, 
            meta,
            message: 'Category metadata fetched successfully' 
          });
        } catch (err) {
          return res.status(500).json({ 
            success: false, 
            error: err instanceof Error ? err.message : 'Failed to fetch category metadata' 
          });
        }
      }

      case 'get-required-attributes': {
        if (!reqCategoryCode) {
          return res.status(400).json({ 
            success: false, 
            error: 'Please enter a category code.' 
          });
        }

        const categoryCodeNum = parseInt(reqCategoryCode);
        if (isNaN(categoryCodeNum) || categoryCodeNum <= 0) {
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid category code. Please enter a valid numeric category code.' 
          });
        }

        const result = await getCategoryRequiredAttributes(categoryCodeNum, accessKey, secretKey);
        
        if (result.success) {
          const mandatory = result.attributes?.filter((a: any) => a.required) || [];
          const optional = result.attributes?.filter((a: any) => !a.required) || [];
          
          let message = '';
          if (result.message) {
            message = result.message;
          } else if (mandatory.length === 0) {
            message = `Category ${reqCategoryCode} has no mandatory attributes.`;
          } else {
            message = `Category ${reqCategoryCode} requires ${mandatory.length} mandatory attribute${mandatory.length > 1 ? 's' : ''}.`;
          }
          
          return res.json({ 
            success: true, 
            categoryCode: reqCategoryCode,
            mandatoryAttributes: mandatory,
            optionalAttributes: optional,
            totalMandatory: mandatory.length,
            totalOptional: optional.length,
            message
          });
        } else {
          // Return 400 for client errors, not 500
          return res.status(400).json({ 
            success: false, 
            error: result.error || 'Unable to fetch category information.'
          });
        }
      }

      default:
        return res.status(400).json({ 
          success: false, 
          error: `Unknown action: ${action}. Valid actions: validate, upload, validate-products, test-signature, fetch-shipping-centers, recommend-category, validate-category, fetch-category-meta` 
        });
    }
  } catch (error) {
    console.error('[API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: errorMessage });
  }
});

export default router;
