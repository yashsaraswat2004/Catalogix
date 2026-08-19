// Environment configuration
// All environment variables should be accessed through this file

export const config = {
  // API Configuration
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  
  // App Configuration
  appName: import.meta.env.VITE_APP_NAME || 'NexCatalog',
  appUrl: import.meta.env.VITE_APP_URL || 'https://nexcatalog.com',
  
  // Environment
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  mode: import.meta.env.MODE,
  
  // Feature Flags
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  enableSentry: import.meta.env.VITE_ENABLE_SENTRY === 'true',
  
  // Sentry
  sentryDsn: import.meta.env.VITE_SENTRY_DSN || '',

  // AI (Shipping tools — CN22 address parsing, India Post translation)
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
} as const;

// Type-safe environment variable access
export type Config = typeof config;

// Validate required environment variables in production
export function validateEnv(): void {
  if (config.isProduction) {
    const requiredVars = ['VITE_API_URL'];
    const missing = requiredVars.filter(
      (varName) => !import.meta.env[varName]
    );
    
    if (missing.length > 0) {
      console.warn(
        `Warning: Missing environment variables: ${missing.join(', ')}`
      );
    }
  }
}

export default config;
