/**
 * Debug utilities for the image API
 */

export function debugLog(message: string, data?: any) {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `[DEBUG] ${message}`,
      data ? JSON.stringify(data, null, 2) : ""
    );
  }
}

export function debugError(message: string, error: any) {
  console.error(`[ERROR] ${message}`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    stack: error?.stack,
  });
}

export function validateEnvironment() {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  debugLog("Environment validation passed", {
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
