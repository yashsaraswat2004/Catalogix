// Express Backend Integration
// Connects frontend to your self-hosted Express backend

import config from '@/lib/config';

// Backend URL - Uses environment variable or falls back to localhost
const BACKEND_URL = `${config.apiUrl}/api`;

export async function invokeFunction(functionName: string, body: any) {
  // Map edge function names to Express endpoints
  const endpoint = functionName === 'coupang-api' ? 'coupang' : 'translate';
  
  if (config.isDevelopment) {
    console.log(`[Backend] Calling: ${BACKEND_URL}/${endpoint}`);
  }
  
  try {
    const response = await fetch(`${BACKEND_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      if (config.isDevelopment) {
        console.error(`[Backend] Error response:`, errorText);
      }
      return { 
        data: null, 
        error: { message: `Backend error: ${errorText}` } 
      };
    }
    
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    if (config.isDevelopment) {
      console.error(`[Backend] Network error:`, error);
    }
    return { 
      data: null, 
      error: { message: error instanceof Error ? error.message : 'Network error - is backend running?' } 
    };
  }
}

export function isUsingLocalFunctions() {
  return true; // Always using your own Express backend
}
