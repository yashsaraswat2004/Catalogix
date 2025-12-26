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
      console.log('[CoupangAPI] Using LOCAL edge functions (your IP)');
    } else {
      console.log('[CoupangAPI] Using CLOUD edge functions (Lovable Cloud IPs)');
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
    clearError: () => setError(null),
  };
}
