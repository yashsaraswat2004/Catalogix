import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CoupangApiCredentials, ParsedProduct } from '@/types/coupang';

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
  results?: UploadResult[];
  dryRun?: boolean;
  products?: any[];
  error?: string;
}

export function useCoupangApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate API credentials
  const validateCredentials = useCallback(async (
    credentials: CoupangApiCredentials
  ): Promise<{ valid: boolean; message: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('coupang-api', {
        body: {
          action: 'validate',
          credentials: {
            accessKey: credentials.accessKey,
            secretKey: credentials.secretKey,
            vendorId: credentials.vendorId,
          },
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
      setIsLoading(false);
    }
  }, []);

  // Dry run to validate products without uploading
  const dryRun = useCallback(async (
    credentials: CoupangApiCredentials,
    products: ParsedProduct[]
  ): Promise<BatchUploadResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const productData = products.map(p => p.data);

      const { data, error: fnError } = await supabase.functions.invoke('coupang-api', {
        body: {
          action: 'upload',
          credentials: {
            accessKey: credentials.accessKey,
            secretKey: credentials.secretKey,
            vendorId: credentials.vendorId,
          },
          products: productData,
          dryRun: true,
        },
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
      setIsLoading(false);
    }
  }, []);

  // Upload products to Coupang
  const uploadProducts = useCallback(async (
    credentials: CoupangApiCredentials,
    products: ParsedProduct[],
    onProgress?: (current: number, total: number) => void
  ): Promise<BatchUploadResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const productData = products.map(p => p.data);

      // Report initial progress
      onProgress?.(0, products.length);

      const { data, error: fnError } = await supabase.functions.invoke('coupang-api', {
        body: {
          action: 'upload',
          credentials: {
            accessKey: credentials.accessKey,
            secretKey: credentials.secretKey,
            vendorId: credentials.vendorId,
          },
          products: productData,
          dryRun: false,
        },
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
      setIsLoading(false);
    }
  }, []);

  // Test HMAC signature generation
  const testSignature = useCallback(async (
    credentials: CoupangApiCredentials
  ): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('coupang-api', {
        body: {
          action: 'test-signature',
          credentials: {
            accessKey: credentials.accessKey,
            secretKey: credentials.secretKey,
            vendorId: credentials.vendorId,
          },
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
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    validateCredentials,
    dryRun,
    uploadProducts,
    testSignature,
    clearError: () => setError(null),
  };
}
