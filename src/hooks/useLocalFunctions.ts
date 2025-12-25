// Helper for local edge function development
// When running `supabase functions serve`, use this to call local functions

const USE_LOCAL_FUNCTIONS = import.meta.env.VITE_USE_LOCAL_FUNCTIONS === 'true';
const LOCAL_FUNCTIONS_URL = 'http://localhost:54321/functions/v1';

export async function invokeFunction(functionName: string, body: any) {
  if (USE_LOCAL_FUNCTIONS) {
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
  return USE_LOCAL_FUNCTIONS;
}
