import { createClient } from "@supabase/supabase-js";

/**
 * Browser-safe Supabase client using the anon key.
 * Use this in Client Components for real-time subscriptions or client-side reads.
 */
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
