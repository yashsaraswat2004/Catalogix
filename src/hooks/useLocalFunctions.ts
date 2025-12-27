// Express Backend Integration
// Connects frontend to your self-hosted Express backend

// Backend URL - Update this for production deployment
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api';

export async function invokeFunction(functionName: string, body: any) {
  // Map edge function names to Express endpoints
  const endpoint = functionName === 'coupang-api' ? 'coupang' : 'translate';
  
  console.log(`[Backend] Calling: ${BACKEND_URL}/${endpoint}`);
  
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
      console.error(`[Backend] Error response:`, errorText);
      return { 
        data: null, 
        error: { message: `Backend error: ${errorText}` } 
      };
    }
    
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error(`[Backend] Network error:`, error);
    return { 
      data: null, 
      error: { message: error instanceof Error ? error.message : 'Network error - is backend running?' } 
    };
  }
}

export function isUsingLocalFunctions() {
  return true; // Always using your own Express backend
}
