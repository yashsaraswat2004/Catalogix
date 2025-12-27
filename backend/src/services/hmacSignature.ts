import crypto from 'crypto';

/**
 * Generate HMAC-SHA256 signature for Coupang API authentication
 * Reference: https://developers.coupangcorp.com/hc/en-us/articles/360033461914-Creating-HMAC-Signature
 */
export function generateHmacSignature(
  method: string,
  path: string,
  query: string,
  secretKey: string,
  accessKey: string
): { authorization: string; datetime: string } {
  // Generate datetime in exact format: yyMMdd'T'HHmmss'Z' (UTC)
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const datetime = `${now.getUTCFullYear().toString().slice(2)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  // Create the message to sign: datetime + method + path + query
  const message = datetime + method + path + query;
  
  console.log('[HMAC] Generating signature:', { datetime, method, path, queryLength: query.length });

  // Generate HMAC-SHA256 signature
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');

  // Create authorization header in exact format
  // Format: "CEA algorithm=HmacSHA256, access-key={accessKey}, signed-date={datetime}, signature={signature}"
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
  
  return { authorization, datetime };
}
