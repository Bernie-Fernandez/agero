import { createClient } from "@supabase/supabase-js";
import { StorageClient } from "@supabase/storage-js";

/**
 * General Supabase server client (service role).
 * Only use this in Server Components, Route Handlers, and Server Actions.
 * Never expose the service role key to the browser.
 */
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Storage-only admin client.
 *
 * @supabase/supabase-js 2.x sends zero auth headers on storage requests when
 * initialised with the new sb_secret_* key format, so uploads land as anonymous
 * and the storage server rejects them with "Invalid Compact JWS".
 *
 * This client bypasses createClient() and constructs StorageClient directly,
 * injecting the JWT-format service role key (SUPABASE_SERVICE_ROLE_JWT) as
 * explicit Authorization + apikey headers — the only format the storage server
 * will accept for service-role uploads.
 */
export function createStorageAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // SUPABASE_SERVICE_ROLE_JWT must be the legacy eyJ... JWT key from:
  // Supabase dashboard → Project Settings → API → Legacy API keys → service_role (JWT)
  const jwtKey = process.env.SUPABASE_SERVICE_ROLE_JWT;
  if (!jwtKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_JWT is not set. " +
      "Add the legacy JWT service role key (eyJ...) from " +
      "Supabase dashboard → Project Settings → API → Legacy API keys."
    );
  }
  return new StorageClient(`${supabaseUrl}/storage/v1`, {
    apikey: jwtKey,
    Authorization: `Bearer ${jwtKey}`,
  });
}
