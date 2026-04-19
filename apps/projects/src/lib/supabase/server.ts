import { StorageClient } from "@supabase/storage-js";

export function createStorageAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const jwtKey = process.env.SUPABASE_SERVICE_ROLE_JWT;
  if (!jwtKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_JWT is not set.");
  }
  return new StorageClient(`${supabaseUrl}/storage/v1`, {
    apikey: jwtKey,
    Authorization: `Bearer ${jwtKey}`,
  });
}
