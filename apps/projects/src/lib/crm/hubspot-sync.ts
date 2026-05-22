import { Client } from '@hubspot/api-client';
import { prisma } from '@/lib/prisma';
import { decryptToken } from './crypto';
import type { LeadStage, ConfidenceRating } from '@agero/db';

// ─── Field mapping ────────────────────────────────────────────────────────────

const HS_PROPERTIES = [
  'dealname',
  'amount',
  'dealstage',
  'hubspot_owner_id',
  'closedate',
  'go_no_go_date',
  'decision_date',
  'start_date',
  'completion_date',
  'lease_expiry_date',
  'entry_gp__c',
  'confidence_rating',
  'project_location',
  'service__c',
  'deal_classification__c',
  'client_type',
  'floor_area',
  'current_address',
  'future_address',
  'hs_lastmodifieddate',
];

// HubSpot dealstage IDs are pipeline-specific. Map the numeric stages from the doc.
// These are the default HubSpot pipeline internal names — Bernie should verify via
// GET /crm/v3/properties/deals. We store the raw HS stage value and map to enum here.
function mapStage(hsStage: string | null | undefined): LeadStage {
  if (!hsStage) return 'RESEARCH';
  const s = hsStage.toLowerCase();
  if (s.includes('research') || s === '0') return 'RESEARCH';
  if (s.includes('validated') || s === '1') return 'VALIDATED';
  if (s.includes('developing') || s === '2') return 'DEVELOPING';
  if (s.includes('qualified') || s === '3') return 'QUALIFIED';
  if (s.includes('submission_in') || s.includes('in progress') || s === '4') return 'SUBMISSION_IN_PROGRESS';
  if (s.includes('submission_await') || s.includes('awaiting') || s === '5') return 'SUBMISSION_AWAITING';
  if (s.includes('intent') || s === '6') return 'INTENT_TO_NEGOTIATE';
  if (s.includes('closedwon') || s.includes('won') || s === '7') return 'CLOSED_WON';
  if (s.includes('closedlost') || s.includes('lost') || s === '8') return 'CLOSED_LOST';
  if (s.includes('dead') || s === '9' || s === '10') return 'DEAD';
  if (s.includes('withdrawn') || s === '11' || s === '12' || s === '13') return 'WITHDRAWN';
  return 'RESEARCH';
}

function mapConfidence(hsValue: string | null | undefined): ConfidenceRating | null {
  if (!hsValue) return null;
  const v = hsValue.toUpperCase();
  if (v === 'GREEN') return 'GREEN';
  if (v === 'YELLOW') return 'YELLOW';
  if (v === 'RED') return 'RED';
  return null;
}

function probFromConfidence(
  rating: ConfidenceRating | null,
  settings: { confidenceGreenPct: unknown; confidenceYellowPct: unknown; confidenceRedPct: unknown; confidenceNonePct: unknown }
): number {
  const g = parseFloat(String(settings.confidenceGreenPct));
  const y = parseFloat(String(settings.confidenceYellowPct));
  const r = parseFloat(String(settings.confidenceRedPct));
  const n = parseFloat(String(settings.confidenceNonePct));
  if (rating === 'GREEN') return g;
  if (rating === 'YELLOW') return y;
  if (rating === 'RED') return r;
  return n;
}

function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function parseDecimal(v: string | null | undefined): string | null {
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : String(n);
}

// ─── Build Lead data from HS deal properties ──────────────────────────────────

function dealToLeadData(
  props: Record<string, string | null | undefined>,
  settings: { confidenceGreenPct: unknown; confidenceYellowPct: unknown; confidenceRedPct: unknown; confidenceNonePct: unknown }
) {
  const confidence = mapConfidence(props.confidence_rating);
  const prob = probFromConfidence(confidence, settings);
  return {
    leadName: props.dealname ?? 'Untitled',
    stage: mapStage(props.dealstage),
    contractValue: parseDecimal(props.amount),
    entryGpPct: parseDecimal(props['entry_gp__c']),
    confidenceRating: confidence,
    probabilityPct: String(prob),
    goNoGoDate: parseDate(props.go_no_go_date),
    decisionDate: parseDate(props.decision_date),
    contractDate: parseDate(props.closedate),
    startDate: parseDate(props.start_date),
    completionDate: parseDate(props.completion_date),
    leaseExpiryDate: parseDate(props.lease_expiry_date),
    projectLocation: props.project_location ?? null,
    serviceType: props['service__c'] ?? null,
    dealClassification: props['deal_classification__c'] ?? null,
    clientType: props.client_type ?? null,
    floorAreaM2: parseDecimal(props.floor_area),
    currentAddress: props.current_address ?? null,
    futureAddress: props.future_address ?? null,
    hubspotLastModified: parseDate(props.hs_lastmodifieddate),
  };
}

// ─── Build HubSpot properties from Lead ──────────────────────────────────────

function leadToHsProperties(lead: Record<string, unknown>, changedFields: string[]): Record<string, string> {
  const props: Record<string, string> = {};
  const map: Record<string, string> = {
    leadName: 'dealname',
    contractValue: 'amount',
    stage: 'dealstage',
    contractDate: 'closedate',
    goNoGoDate: 'go_no_go_date',
    decisionDate: 'decision_date',
    startDate: 'start_date',
    completionDate: 'completion_date',
    leaseExpiryDate: 'lease_expiry_date',
    entryGpPct: 'entry_gp__c',
    confidenceRating: 'confidence_rating',
    projectLocation: 'project_location',
    serviceType: 'service__c',
    dealClassification: 'deal_classification__c',
    clientType: 'client_type',
    floorAreaM2: 'floor_area',
    currentAddress: 'current_address',
    futureAddress: 'future_address',
  };
  for (const field of changedFields) {
    const hsProp = map[field];
    if (!hsProp) continue;
    const val = lead[field];
    if (val == null) {
      props[hsProp] = '';
    } else if (val instanceof Date) {
      props[hsProp] = val.toISOString().split('T')[0];
    } else {
      props[hsProp] = String(val);
    }
  }
  return props;
}

// ─── Get HubSpot client for an org ───────────────────────────────────────────

async function getHsClient(organisationId: string): Promise<{ client: Client; settings: NonNullable<Awaited<ReturnType<typeof prisma.hubSpotSyncSettings.findUnique>>> }> {
  const settings = await prisma.hubSpotSyncSettings.findUnique({
    where: { organisationId },
  });
  if (!settings?.accessToken) throw new Error('HubSpot not connected');
  const token = decryptToken(settings.accessToken);
  const client = new Client({ accessToken: token });
  return { client, settings };
}

// ─── Log helper ──────────────────────────────────────────────────────────────

async function log(params: {
  leadId?: string;
  hubspotDealId?: string;
  direction: 'ERP_TO_HUBSPOT' | 'HUBSPOT_TO_ERP';
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  fieldsChanged?: string[];
  beforeValues?: Record<string, unknown>;
  afterValues?: Record<string, unknown>;
  status?: string;
  errorMessage?: string;
}) {
  await prisma.leadSyncLog.create({
    data: {
      leadId: params.leadId ?? null,
      hubspotDealId: params.hubspotDealId ?? null,
      direction: params.direction,
      operation: params.operation,
      fieldsChanged: (params.fieldsChanged ?? []) as never,
      beforeValues: (params.beforeValues ?? {}) as never,
      afterValues: (params.afterValues ?? {}) as never,
      status: params.status ?? 'SUCCESS',
      errorMessage: params.errorMessage ?? null,
    },
  });
}

// ─── Full sync ────────────────────────────────────────────────────────────────

export async function runFullSync(organisationId: string): Promise<{ imported: number; updated: number; errors: number }> {
  const { client, settings } = await getHsClient(organisationId);
  let imported = 0;
  let updated = 0;
  let errors = 0;
  let after: string | undefined;

  do {
    const response = await client.crm.deals.basicApi.getPage(
      100,
      after,
      HS_PROPERTIES,
      undefined,
      undefined,
      false
    );

    for (const deal of response.results) {
      const props = deal.properties as Record<string, string | null | undefined>;
      const hubspotDealId = String(deal.id);
      try {
        const leadData = dealToLeadData(props, settings);
        const existing = await prisma.lead.findUnique({ where: { hubspotDealId } });

        if (existing) {
          await prisma.lead.update({
            where: { hubspotDealId },
            data: { ...leadData, lastSyncedAt: new Date(), syncStatus: 'SYNCED' },
          });
          await log({ leadId: existing.id, hubspotDealId, direction: 'HUBSPOT_TO_ERP', operation: 'UPDATE', afterValues: leadData as Record<string, unknown> });
          updated++;
        } else {
          const created = await prisma.lead.create({
            data: {
              organisationId,
              hubspotDealId,
              ...leadData,
              lastSyncedAt: new Date(),
              syncStatus: 'SYNCED',
            },
          });
          await log({ leadId: created.id, hubspotDealId, direction: 'HUBSPOT_TO_ERP', operation: 'CREATE', afterValues: leadData as Record<string, unknown> });
          imported++;
        }
      } catch (err) {
        errors++;
        await log({
          hubspotDealId,
          direction: 'HUBSPOT_TO_ERP',
          operation: 'CREATE',
          status: 'ERROR',
          errorMessage: String(err),
        });
      }
    }

    after = response.paging?.next?.after;
  } while (after);

  await prisma.hubSpotSyncSettings.update({
    where: { organisationId },
    data: { lastFullSyncAt: new Date(), lastIncrementalSyncAt: new Date(), status: 'CONNECTED' },
  });

  return { imported, updated, errors };
}

// ─── Incremental sync ─────────────────────────────────────────────────────────

export async function runIncrementalSync(organisationId: string): Promise<{ synced: number; conflicts: number; errors: number }> {
  const { client, settings } = await getHsClient(organisationId);
  const since = settings.lastIncrementalSyncAt ?? new Date(0);
  let synced = 0;
  let conflicts = 0;
  let errors = 0;
  let after: string | undefined;

  do {
    const response = await client.crm.deals.searchApi.doSearch({
      filterGroups: [{
        filters: [{
          propertyName: 'hs_lastmodifieddate',
          operator: 'GT' as never,
          value: since.toISOString(),
        }],
      }],
      properties: HS_PROPERTIES,
      limit: 100,
      after: after ?? undefined,
      sorts: [],
    });

    for (const deal of response.results) {
      const props = deal.properties as Record<string, string | null | undefined>;
      const hubspotDealId = String(deal.id);
      try {
        const leadData = dealToLeadData(props, settings);
        const existing = await prisma.lead.findUnique({ where: { hubspotDealId } });

        if (!existing) {
          const created = await prisma.lead.create({
            data: { organisationId, hubspotDealId, ...leadData, lastSyncedAt: new Date(), syncStatus: 'SYNCED' },
          });
          await log({ leadId: created.id, hubspotDealId, direction: 'HUBSPOT_TO_ERP', operation: 'CREATE', afterValues: leadData as Record<string, unknown> });
          synced++;
          continue;
        }

        const hsModified = leadData.hubspotLastModified ?? new Date(0);
        const erpLastSync = existing.lastSyncedAt ?? new Date(0);
        const erpModified = existing.updatedAt;

        const hsNewer = hsModified > erpLastSync;
        const erpDirty = erpModified > erpLastSync;

        if (hsNewer && erpDirty) {
          // Conflict — both sides changed since last sync
          await prisma.lead.update({
            where: { hubspotDealId },
            data: { syncStatus: 'CONFLICT' },
          });
          await log({
            leadId: existing.id,
            hubspotDealId,
            direction: 'HUBSPOT_TO_ERP',
            operation: 'UPDATE',
            status: 'CONFLICT',
            beforeValues: { syncStatus: existing.syncStatus },
            afterValues: leadData as Record<string, unknown>,
          });
          conflicts++;
        } else if (hsNewer) {
          const before = { ...existing } as Record<string, unknown>;
          await prisma.lead.update({
            where: { hubspotDealId },
            data: { ...leadData, lastSyncedAt: new Date(), syncStatus: 'SYNCED' },
          });
          await log({ leadId: existing.id, hubspotDealId, direction: 'HUBSPOT_TO_ERP', operation: 'UPDATE', beforeValues: before, afterValues: leadData as Record<string, unknown> });
          synced++;
        }
      } catch (err) {
        errors++;
        await log({ hubspotDealId, direction: 'HUBSPOT_TO_ERP', operation: 'UPDATE', status: 'ERROR', errorMessage: String(err) });
      }
    }

    after = response.paging?.next?.after;
  } while (after);

  await prisma.hubSpotSyncSettings.update({
    where: { organisationId },
    data: { lastIncrementalSyncAt: new Date() },
  });

  return { synced, conflicts, errors };
}

// ─── Push Lead to HubSpot ─────────────────────────────────────────────────────

export async function pushLeadToHubSpot(leadId: string, changedFields: string[]): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;

  const { client } = await getHsClient(lead.organisationId);
  const props = leadToHsProperties(lead as unknown as Record<string, unknown>, changedFields);

  try {
    await client.crm.deals.basicApi.update(lead.hubspotDealId, { properties: props });
    await prisma.lead.update({ where: { id: leadId }, data: { syncStatus: 'SYNCED', lastSyncedAt: new Date() } });
    await log({
      leadId,
      hubspotDealId: lead.hubspotDealId,
      direction: 'ERP_TO_HUBSPOT',
      operation: 'UPDATE',
      fieldsChanged: changedFields,
      afterValues: props,
    });
  } catch (err) {
    await prisma.lead.update({ where: { id: leadId }, data: { syncStatus: 'ERROR' } });
    await log({
      leadId,
      hubspotDealId: lead.hubspotDealId,
      direction: 'ERP_TO_HUBSPOT',
      operation: 'UPDATE',
      status: 'ERROR',
      errorMessage: String(err),
      fieldsChanged: changedFields,
    });
    throw err;
  }
}
