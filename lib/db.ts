import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function createSupabaseServer(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL!;
  const anon = process.env.SUPABASE_ANON_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }

  // Always use service role key for server-side operations to bypass RLS
  if (!service) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY - required for server-side database access"
    );
  }

  // Debug log to verify we're using the service role key
  if (process.env.NODE_ENV === "development") {
    console.log("[DEBUG] Creating Supabase client with service role key");
    console.log(
      "[DEBUG] Service key starts with:",
      service.substring(0, 20) + "..."
    );
  }

  cached = createClient(url, service, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: { fetch },
    db: {
      schema: "public",
    },
  });
  return cached;
}

export async function fetchUserDisplayName(
  userId: string
): Promise<string | null> {
  try {
    const supabase = createSupabaseServer();

    // Fetch user metadata from auth.users table using service role
    const { data, error } = await supabase.auth.admin.getUserById(userId);

    if (error) {
      console.warn(
        `[WARNING] Could not fetch user profile for ${userId}:`,
        error.message
      );
      return null;
    }

    if (!data.user) {
      console.warn(`[WARNING] No user found for ID ${userId}`);
      return null;
    }

    // Try to get display name from user metadata
    const displayName =
      data.user.user_metadata?.full_name ||
      data.user.user_metadata?.name ||
      data.user.user_metadata?.display_name ||
      data.user.email?.split("@")[0] || // Fallback to email username
      null;

    return displayName;
  } catch (error) {
    console.warn(
      `[WARNING] Failed to fetch user display name for ${userId}:`,
      error
    );
    return null;
  }
}
