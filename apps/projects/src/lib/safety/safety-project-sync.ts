'use server';

import { createServerClient } from './supabase-server';

// Agero Group org UUID in the Safety public schema — seeded in Sprint S1.
// Maps all ERP projects to the single Safety tenant org.
const AGERO_SAFETY_ORG_ID = 'f0e1d2c3-b4a5-4967-8c0d-1e2f3a4b5c6d';

/**
 * Upserts a SafetyProject row in the public schema to keep it in sync with the
 * ERP Project record.  Called from createProject and updateProject server actions.
 *
 * On first create: looks for a matching legacy Safety project by name so the
 * existing QR token is preserved (required for L16/350 Queen Street).
 * On subsequent updates: only name and address are synced; qr_token, status, and
 * building_mgmt_induction_required are never overwritten.
 *
 * Errors are non-fatal — ERP operations must not fail because Safety sync fails.
 */
export async function syncSafetyProject({
  erpProjectId,
  name,
  address,
}: {
  erpProjectId: string;
  name: string;
  address: string | null;
}): Promise<void> {
  try {
    const supabase = createServerClient();

    const { data: existing } = await supabase
      .from('safety_projects')
      .select('id')
      .eq('erp_project_id', erpProjectId)
      .maybeSingle();

    if (!existing) {
      // First sync — look for a legacy Safety project with the same name so we can
      // carry over its QR token (preserves printed QR codes already deployed on site).
      const { data: legacy } = await supabase
        .from('projects')
        .select('token')
        .ilike('name', name)
        .maybeSingle();

      const row: Record<string, unknown> = {
        erp_project_id: erpProjectId,
        organisation_id: AGERO_SAFETY_ORG_ID,
        name,
        address,
        status: 'SETUP',
      };
      if (legacy?.token) row.qr_token = legacy.token;

      const { error } = await supabase.from('safety_projects').insert(row);
      if (error) console.error('[syncSafetyProject] insert error:', error.message);
    } else {
      // Subsequent sync — update only mutable fields; never touch qr_token or status.
      const { error } = await supabase
        .from('safety_projects')
        .update({ name, address, updated_at: new Date().toISOString() })
        .eq('erp_project_id', erpProjectId);
      if (error) console.error('[syncSafetyProject] update error:', error.message);
    }
  } catch (e) {
    console.error('[syncSafetyProject] unexpected error:', e);
  }
}
