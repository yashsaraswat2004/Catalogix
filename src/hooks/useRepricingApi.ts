import { useState, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface RepricingStrategy {
  MATCH_LOWEST: 'MATCH_LOWEST';
  LOWER_BY_PERCENTAGE: 'LOWER_BY_PERCENTAGE';
  LOWER_BY_AMOUNT: 'LOWER_BY_AMOUNT';
  HIGHER_BY_PERCENTAGE: 'HIGHER_BY_PERCENTAGE';
  HIGHER_BY_AMOUNT: 'HIGHER_BY_AMOUNT';
}

export interface RepricingCSVRow {
  identifierType: string;
  identifierValue: string;
  strategy: string;
  ruleValue: string;
  productName?: string;
}

export interface RepricingJobSummary {
  jobId: string;
  totalItems: number;
  validatedItems?: number;
  failedValidationItems?: number;
  successfulItems?: number;
  failedItems?: number;
  skippedItems?: number;
  status: string;
}

export interface RepricingPreviewItem {
  identifier: string;
  productName?: string;
  currentPrice: number;
  newPrice: number;
  change: number;
  changePercent: number;
  strategy: string;
  status: string;
  errors?: string[];
}

export interface RepricingJob {
  _id: string;
  filename: string;
  status: string;
  totalItems: number;
  validatedItems: number;
  failedValidationItems: number;
  successfulItems: number;
  failedItems: number;
  skippedItems: number;
  createdAt: string;
  previewGeneratedAt?: string;
  approvedAt?: string;
  executionCompletedAt?: string;
}

export function useRepricingApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = () => {
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('token='))
      ?.split('=')[1];

    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  };

  // Download repricing template
  const downloadTemplate = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/repricing/template`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'repricing-template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Upload and validate CSV
  const uploadRepricingCSV = useCallback(async (
    credentials: { accessKey: string; secretKey: string; vendorId: string },
    rows: RepricingCSVRow[],
    filename: string,
    config?: { minPrice?: number; maxPriceChangePercent?: number }
  ): Promise<RepricingJobSummary> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/repricing/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ credentials, rows, filename, config }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      return {
        jobId: data.jobId,
        totalItems: data.totalItems,
        status: 'UPLOADED',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Generate preview
  const generatePreview = useCallback(async (
    jobId: string,
    credentials: { accessKey: string; secretKey: string; vendorId: string },
    config?: { minPrice?: number }
  ): Promise<{ summary: { total: number; previewReady: number; validationFailed: number; skipped: number } }> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/repricing/preview/${jobId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ credentials, config }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Preview generation failed');
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Preview generation failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get preview data
  const getPreview = useCallback(async (
    jobId: string
  ): Promise<{ job: { id: unknown; status: string; totalItems: number; validatedItems: number; failedValidationItems: number; skippedItems: number; previewGeneratedAt?: string }; items: RepricingPreviewItem[] }> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/repricing/preview/${jobId}`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get preview');
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get preview';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Approve job
  const approveJob = useCallback(async (jobId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/repricing/approve/${jobId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Approval failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Approval failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Execute repricing
  const executeRepricing = useCallback(async (
    jobId: string,
    credentials: { accessKey: string; secretKey: string; vendorId: string },
    config?: { rateLimitDelay?: number; maxRetries?: number }
  ): Promise<{ summary: { total: number; successful: number; failed: number; skipped: number } }> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/repricing/execute/${jobId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ credentials, config }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Execution failed');
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Execution failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get job status
  const getJobStatus = useCallback(async (jobId: string): Promise<{ jobStatus: string; totalItems: number; successful: number; failed: number; skipped: number; inProgress: number }> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/repricing/status/${jobId}`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get status');
      }

      return data.status;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get status';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get job history
  const getJobHistory = useCallback(async (
    limit: number = 20,
    skip: number = 0
  ): Promise<{ jobs: RepricingJob[]; total: number }> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/repricing/history?limit=${limit}&skip=${skip}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get history');
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get history';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cancel job
  const cancelJob = useCallback(async (jobId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/repricing/cancel/${jobId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Cancellation failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cancellation failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    downloadTemplate,
    uploadRepricingCSV,
    generatePreview,
    getPreview,
    approveJob,
    executeRepricing,
    getJobStatus,
    getJobHistory,
    cancelJob,
  };
}
