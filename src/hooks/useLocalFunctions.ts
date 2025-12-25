// Helper for local edge function development
// When running `supabase functions serve`, use this to call local functions

const LOCAL_FUNCTIONS_URL = 'http://localhost:8000';

// Get the current backend mode from localStorage
function getBackendMode(): 'cloud' | 'local' {
  if (typeof window === 'undefined') return 'cloud';
  const saved = localStorage.getItem('coupang_backend_mode');
  return saved === 'local' ? 'local' : 'cloud';
}

export async function invokeFunction(functionName: string, body: any) {
  const useLocal = getBackendMode() === 'local';
  
  if (useLocal) {
    console.log(`[Local] Calling local function: ${functionName}`);
    const response = await fetch(`${LOCAL_FUNCTIONS_URL}/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Function error: ${errorText}`);
    }
    
    return { data: await response.json(), error: null };
  }
  
  // Use Supabase client for cloud functions
  const { supabase } = await import('@/integrations/supabase/client');
  return supabase.functions.invoke(functionName, { body });
}

export function isUsingLocalFunctions() {
  return getBackendMode() === 'local';
}
