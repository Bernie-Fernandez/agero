import { createClient } from "@supabase/supabase-js";

const SEED_ORGANISATION_ID = "a1000000-0000-0000-0000-000000000001";
const SEED_USER_ID = "b2000000-0000-0000-0000-000000000001";

export function createProjectsClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { db: { schema: "projects" } });
}

export { SEED_ORGANISATION_ID, SEED_USER_ID };
