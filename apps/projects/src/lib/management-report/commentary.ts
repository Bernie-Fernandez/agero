'use server';

import { requireFinanceAccess } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import type { MgmtReportPageData } from './actions';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommentaryDraft = {
  revenue: string;
  pnl: string;
  projects: string;
  cash: string;
  wip: string;
  outlook: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const fmtC = (v: number) => AUD.format(v);
const pctC = (v: number) => (v * 100).toFixed(1) + '%';

function buildDataSummary(data: MgmtReportPageData, reportMonthLabel: string): string {
  const { pnl, cvrRows, cashPosition, wipSummary } = data;
  const lines: string[] = [];

  lines.push(`REPORT MONTH: ${reportMonthLabel}`);
  lines.push('');
  lines.push('REVENUE:');
  lines.push(`- Actual this month: ${fmtC(pnl.actualRevenue)}`);
  lines.push(`- Budget this month: ${fmtC(pnl.budgetRevenue)}`);
  const revVar = pnl.actualRevenue - pnl.budgetRevenue;
  const revVarPct = pnl.budgetRevenue > 0 ? revVar / pnl.budgetRevenue : 0;
  lines.push(`- Variance: ${fmtC(revVar)} (${pctC(revVarPct)})`);
  lines.push(`- YTD Actual: ${fmtC(pnl.ytdActualRevenue)} vs YTD Budget: ${fmtC(pnl.ytdBudgetRevenue)}`);
  lines.push('');
  lines.push('P&L:');
  lines.push(`- Gross Margin: ${pctC(pnl.actualGrossMarginPct)} (budget: ${pctC(pnl.budgetGrossMarginPct)})`);
  lines.push(`- Overheads: ${fmtC(pnl.actualOverheads)} (budget: ${fmtC(pnl.budgetOverheads)})`);
  lines.push(`- Net Profit: ${fmtC(pnl.actualNetProfit)} (budget: ${fmtC(pnl.budgetNetProfit)})`);
  lines.push('');
  lines.push('PROJECTS (active, non-ignored):');
  for (const r of cvrRows) {
    if (r.health !== 'GREY') {
      lines.push(`- ${r.jobNo} ${r.projectName}: Margin ${pctC(r.forecastMarginPct)}, Health: ${r.health}, Margin to Earn: ${fmtC(r.marginToEarn)}`);
    } else {
      lines.push(`- ${r.jobNo} ${r.projectName}: No snapshot data`);
    }
  }
  lines.push('');
  lines.push('CASH:');
  if (cashPosition.current) {
    const c = cashPosition.current;
    const p = cashPosition.prior;
    lines.push(`- Cash and Bank: ${fmtC(c.cash)}${p ? ` (prior: ${fmtC(p.cash)}, movement: ${fmtC(c.cash - p.cash)})` : ''}`);
    lines.push(`- Accounts Receivable: ${fmtC(c.ar)}`);
    lines.push(`- Accounts Payable: ${fmtC(c.ap)}`);
    lines.push(`- Net Working Capital: ${fmtC(c.cash + c.ar - c.ap)}`);
  } else {
    lines.push('- No Balance Sheet data available');
  }
  lines.push('');
  lines.push('WIP:');
  if (wipSummary) {
    lines.push(`- Net WIP position: ${fmtC(wipSummary.currentMonthWip)}`);
    lines.push(`- Movement this month: ${wipSummary.movement >= 0 ? '+' : ''}${fmtC(wipSummary.movement)}`);
    lines.push(`- Journal status: ${wipSummary.journalPosted ? 'Posted' : 'Pending'}`);
  } else {
    lines.push('- No locked WIP data available');
  }

  return lines.join('\n');
}

// ─── generateCommentary ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are writing the monthly management report commentary for Agero Group Pty Ltd, a Melbourne-based commercial fitout and construction head contractor.

Write in the voice of the Director reporting to shareholders. Tone: professional, direct, factual. No fluff. Use plain language. Reference specific numbers. Flag risks clearly. Highlight wins.

Each commentary section should be 2-4 sentences maximum. Do not pad. Do not use hedging language like "it appears" or "it seems". State facts and your assessment directly.

Return ONLY a JSON object with these exact keys:
{
  "revenue": "commentary text",
  "pnl": "commentary text",
  "projects": "commentary text",
  "cash": "commentary text",
  "wip": "commentary text",
  "outlook": "commentary text"
}`;

export async function generateCommentary(
  data: MgmtReportPageData,
  reportMonthLabel: string,
): Promise<{ ok: boolean; commentary?: CommentaryDraft; error?: string }> {
  await requireFinanceAccess();

  const dataSummary = buildDataSummary(data, reportMonthLabel);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[management-report] generateCommentary: ANTHROPIC_API_KEY is not set');
    return { ok: false, error: 'AI commentary is not configured (missing ANTHROPIC_API_KEY).' };
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Generate management report commentary for the following data:\n\n${dataSummary}` }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>;
    return {
      ok: true,
      commentary: {
        revenue: parsed.revenue ?? '',
        pnl: parsed.pnl ?? '',
        projects: parsed.projects ?? '',
        cash: parsed.cash ?? '',
        wip: parsed.wip ?? '',
        outlook: parsed.outlook ?? '',
      },
    };
  } catch (e) {
    console.error('[management-report] generateCommentary error:', e);
    // Surface the real error in non-production so the cause is diagnosable;
    // keep a generic message in production.
    const detail = e instanceof Error ? e.message : String(e);
    const isProd = process.env.NODE_ENV === 'production';
    return {
      ok: false,
      error: isProd
        ? 'Failed to generate commentary. Please try again.'
        : `Failed to generate commentary: ${detail}`,
    };
  }
}

// ─── saveCommentaryDraft ──────────────────────────────────────────────────────

export async function saveCommentaryDraft(
  snapshotId: string,
  commentary: CommentaryDraft,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireFinanceAccess();
  try {
    const snap = await prisma.managementReportSnapshot.findUnique({
      where: { id: snapshotId },
      select: { organisationId: true, status: true },
    });
    if (!snap || snap.organisationId !== user.organisationId) return { ok: false, error: 'Not found.' };
    if (snap.status === 'LOCKED') return { ok: false, error: 'Cannot edit locked report.' };

    await prisma.managementReportSnapshot.update({
      where: { id: snapshotId },
      data: { commentaryDraft: commentary as unknown as Record<string, string> },
    });
    return { ok: true };
  } catch (e) {
    console.error('[management-report] saveCommentaryDraft error:', e);
    return { ok: false, error: 'Failed to save commentary.' };
  }
}
