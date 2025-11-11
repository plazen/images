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
    code: (error as any)?.code,
    stack: error?.stack,
  });
}

export function validateEnvironment() {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ENCRYPTION_KEY",
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
  if (process.env.ENCRYPTION_KEY?.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string.");
  }

  debugLog("Environment validation passed", {
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
  });
}
