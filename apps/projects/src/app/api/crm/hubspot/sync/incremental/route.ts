import { NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { runIncrementalSync } from '@/lib/crm/hubspot-sync';

export async function POST() {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  try {
    const result = await runIncrementalSync(user.organisationId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
