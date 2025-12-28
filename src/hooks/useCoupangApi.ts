import { useState, useCallback } from 'react';
import { CoupangApiCredentials, ParsedProduct, WingSettings } from '@/types/coupang';
import { invokeFunction, isUsingLocalFunctions } from '@/hooks/useLocalFunctions';

export interface UploadResult {
  productIndex: number;
  productName: string;
  success: boolean;
  productId?: string;
  error?: string;
  details?: any;
}

export interface BatchUploadResponse {
  success: boolean;
  message: string;
  successCount?: number;
  failedCount?: number;
  validCount?: number;
  invalidCount?: number;
  results?: UploadResult[];
  dryRun?: boolean;
  products?: any[];
  error?: string;
}

export function useCoupangApi() {
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Log which mode we're using
  const logMode = () => {
    if (isUsingLocalFunctions()) {
      console.log('[CoupangAPI] Using LOCAL backend (your IP)');
    } else {
      console.log('[CoupangAPI] Using CLOUD backend');
    }
  };

  // Validate API credentials
  const validateCredentials = useCallback(async (
    credentials: CoupangApiCredentials
  ): Promise<{ valid: boolean; message: string }> => {
    setIsValidating(true);
    setError(null);
    logMode();

    try {
      const { data, error: fnError } = await invokeFunction('coupang-api', {
        action: 'validate',
        credentials: {
          accessKey: credentials.accessKey,
          secretKey: credentials.secretKey,
          vendorId: credentials.vendorId,
        },
      });

      if (fnError) {
        const message = fnError.message || 'Failed to validate credentials';
        setError(message);
        return { valid: false, message };
      }

      return { valid: data?.success || false, message: data?.message || 'Unknown response' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setError(message);
      return { valid: false, message };
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Dry run to validate products without uploading
  const dryRun = useCallback(async (
    credentials: CoupangApiCredentials,
    wingSettings: WingSettings,
    products: ParsedProduct[]
  ): Promise<BatchUploadResponse> => {
    setIsValidating(true);
    setError(null);
    logMode();

    try {
      const productData = products.map(p => p.data);

      const { data, error: fnError } = await invokeFunction('coupang-api', {
        action: 'upload',
        credentials: {
          accessKey: credentials.accessKey,
          secretKey: credentials.secretKey,
          vendorId: credentials.vendorId,
        },
        wingSettings,
        products: productData,
        dryRun: true,
      });

      if (fnError) {
        const message = fnError.message || 'Dry run failed';
        setError(message);
        return { success: false, message, error: message };
      }

      return data as BatchUploadResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setError(message);
      return { success: false, message, error: message };
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Upload products to Coupang
  const uploadProducts = useCallback(async (
    credentials: CoupangApiCredentials,
    wingSettings: WingSettings,
    products: ParsedProduct[],
    onProgress?: (current: number, total: number) => void
  ): Promise<BatchUploadResponse> => {
    setIsUploading(true);
    setError(null);
    logMode();

    try {
      const productData = products.map(p => p.data);

      // Report initial progress
      onProgress?.(0, products.length);

      const { data, error: fnError } = await invokeFunction('coupang-api', {
        action: 'upload',
        credentials: {
          accessKey: credentials.accessKey,
          secretKey: credentials.secretKey,
          vendorId: credentials.vendorId,
        },
        wingSettings,
        products: productData,
        dryRun: false,
      });

      if (fnError) {
        const message = fnError.message || 'Upload failed';
        setError(message);
        return { success: false, message, error: message };
      }

      // Report completion
      onProgress?.(products.length, products.length);

      return data as BatchUploadResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setError(message);
      return { success: false, message, error: message };
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Test HMAC signature generation
  const testSignature = useCallback(async (
    credentials: CoupangApiCredentials
  ): Promise<{ success: boolean; message: string }> => {
    setIsValidating(true);
    setError(null);
    logMode();

    try {
      const { data, error: fnError } = await invokeFunction('coupang-api', {
        action: 'test-signature',
        credentials: {
          accessKey: credentials.accessKey,
          secretKey: credentials.secretKey,
          vendorId: credentials.vendorId,
        },
      });

      if (fnError) {
        const message = fnError.message || 'Signature test failed';
        setError(message);
        return { success: false, message };
      }

      return { success: data?.success || false, message: data?.message || 'Unknown response' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setError(message);
      return { success: false, message };
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Fetch shipping centers from Coupang API
  const fetchShippingCenters = useCallback(async (
    credentials: CoupangApiCredentials
  ): Promise<{
    success: boolean;
    returnCenters: Array<{ code: string; name: string; address: string; zipCode: string; contactNumber: string }>;
    shippingPlaces: Array<{ code: string; name: string; address: string; zipCode: string; countryCode?: string }>;
    message: string;
  }> => {
    setIsValidating(true);
    setError(null);
    logMode();

    try {
      const { data, error: fnError } = await invokeFunction('coupang-api', {
        action: 'fetch-shipping-centers',
        credentials: {
          accessKey: credentials.accessKey,
          secretKey: credentials.secretKey,
          vendorId: credentials.vendorId,
        },
      });

      if (fnError) {
        const message = fnError.message || 'Failed to fetch shipping centers';
        setError(message);
        return { success: false, returnCenters: [], shippingPlaces: [], message };
      }

      return {
        success: data?.success || false,
        returnCenters: data?.returnCenters || [],
        shippingPlaces: data?.shippingPlaces || [],
        message: data?.message || 'Unknown response'
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setError(message);
      return { success: false, returnCenters: [], shippingPlaces: [], message };
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Translate products from English to Korean
  const translateProducts = useCallback(async (
    products: ParsedProduct[]
  ): Promise<{ success: boolean; products: ParsedProduct[]; message: string }> => {
    // Check if any products need translation
    const needsTranslation = products.some(p => p.data.needsTranslation);
    if (!needsTranslation) {
      return { success: true, products, message: 'No translation needed' };
    }

    setIsValidating(true);
    setError(null);
    logMode();

    try {
      console.log('[CoupangAPI] Translating products to Korean...');
      
      const { data, error: fnError } = await invokeFunction('translate-product', {
        products: products.map(p => ({
          id: p.id,
          rowIndex: p.rowIndex,
          data: p.data,
          validationErrors: p.validationErrors,
          status: p.status,
        })),
      });

      if (fnError) {
        const message = fnError.message || 'Translation failed';
        setError(message);
        return { success: false, products, message };
      }

      if (data?.success && Array.isArray(data.products)) {
        console.log('[CoupangAPI] Translation successful');
        return { 
          success: true, 
          products: data.products as ParsedProduct[], 
          message: data.message || 'Translation complete' 
        };
      }

      return { success: false, products, message: data?.error || 'Translation failed' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Translation error';
      setError(message);
      return { success: false, products, message };
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Recommend a category based on product name/description
  const recommendCategory = useCallback(async (
    credentials: CoupangApiCredentials,
    productName: string,
    productDescription?: string,
    brand?: string
  ): Promise<{ success: boolean; categoryCode?: string; categoryName?: string; message: string }> => {
    setIsValidating(true);
    setError(null);
    logMode();

    try {
      console.log('[CoupangAPI] Recommending category for:', productName);
      
      const { data, error: fnError } = await invokeFunction('coupang-api', {
        action: 'recommend-category',
        credentials: {
          accessKey: credentials.accessKey,
          secretKey: credentials.secretKey,
          vendorId: credentials.vendorId,
        },
        productName,
        productDescription,
        brand,
      });

      if (fnError) {
        const message = fnError.message || 'Category recommendation failed';
        setError(message);
        return { success: false, message };
      }

      if (data?.success) {
        return { 
          success: true, 
          categoryCode: data.categoryCode,
          categoryName: data.categoryName,
          message: data.message || 'Category recommended' 
        };
      }

      return { success: false, message: data?.error || 'Category recommendation failed' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setError(message);
      return { success: false, message };
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Validate a category code
  const validateCategory = useCallback(async (
    credentials: CoupangApiCredentials,
    categoryCode: string
  ): Promise<{ success: boolean; valid: boolean; message: string }> => {
    try {
      const { data, error: fnError } = await invokeFunction('coupang-api', {
        action: 'validate-category',
        credentials: {
          accessKey: credentials.accessKey,
          secretKey: credentials.secretKey,
          vendorId: credentials.vendorId,
        },
        categoryCode,
      });

      if (fnError) {
        return { success: false, valid: false, message: fnError.message || 'Validation failed' };
      }

      return { 
        success: true, 
        valid: data?.valid || false,
        message: data?.valid ? 'Category is valid' : 'Category is invalid or not a leaf category'
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      return { success: false, valid: false, message };
    }
  }, []);

  // Fetch category metadata for attribute requirements
  const fetchCategoryMeta = useCallback(async (
    credentials: CoupangApiCredentials,
    categoryCode: string
  ): Promise<{ success: boolean; meta?: any; message: string }> => {
    try {
      const { data, error: fnError } = await invokeFunction('coupang-api', {
        action: 'fetch-category-meta',
        credentials: {
          accessKey: credentials.accessKey,
          secretKey: credentials.secretKey,
          vendorId: credentials.vendorId,
        },
        categoryCode,
      });

      if (fnError) {
        return { success: false, message: fnError.message || 'Failed to fetch category metadata' };
      }

      return { 
        success: data?.success || false, 
        meta: data?.meta,
        message: data?.message || 'Unknown response' 
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      return { success: false, message };
    }
  }, []);

  return {
    isValidating,
    isUploading,
    error,
    isLocalMode: isUsingLocalFunctions(),
    validateCredentials,
    dryRun,
    uploadProducts,
    testSignature,
    fetchShippingCenters,
    translateProducts,
    recommendCategory,
    validateCategory,
    fetchCategoryMeta,
    clearError: () => setError(null),
  };
}
