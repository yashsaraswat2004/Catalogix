import { config } from '@/lib/config';

function getApiBase(): string {
  const url = (config.apiUrl || 'http://localhost:3001/api').replace(/\/$/, '');
  return url.endsWith('/api') ? url : `${url}/api`;
}

export interface LocalizeImageResult {
  success: boolean;
  imageBase64?: string;
  mimeType?: string;
  model?: string;
  message?: string;
  error?: string;
}

export async function localizeProductImage(
  file: File,
  brandNames?: string
): Promise<LocalizeImageResult> {
  const base64 = await fileToBase64(file);
  const apiBase = getApiBase();

  const response = await fetch(`${apiBase}/images/localize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: base64,
      mimeType: file.type || 'image/jpeg',
      brandNames: brandNames?.trim() || undefined,
      refine: true,
    }),
  });

  const data = (await response.json()) as LocalizeImageResult;

  if (!response.ok) {
    return {
      success: false,
      error: data.error || `Request failed (${response.status})`,
    };
  }

  return data;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export function base64ToObjectUrl(base64: string, mimeType: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export function downloadBase64Image(base64: string, mimeType: string, filename: string): void {
  const url = base64ToObjectUrl(base64, mimeType);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
