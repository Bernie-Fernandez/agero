import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import {
  calcBusinessUnitSummary,
  calcConsolidatedPnL,
  calcWIPSchedule,
  calcProjectFinancialSummary,
  calcUnsecuredForecast,
} from '@/lib/finance/calculations';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are the financial controller for Agero Group Pty Ltd, a commercial construction head contractor based in Melbourne, Australia. You write concise, professional monthly management report commentary for the business owner. Your commentary is direct, factual, and action-oriented. You identify key variances against budget, explain the likely causes based on the data provided, and flag any risks or opportunities. You write in first person plural (we, our). You never use bullet points — always write in clear prose paragraphs. Maximum 3 paragraphs per section. Do not include headings. Do not repeat the numbers verbatim — interpret them.`;

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number) { return (n * 100).toFixed(1) + '%'; }
function monthName(d: Date) { return d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' }); }

async function buildPrompt(sectionKey: string, reportMonth: Date, organisationId: string): Promise<string> {
  const month = monthName(reportMonth);
  const nextMonth = monthName(new Date(Date.UTC(reportMonth.getUTCFullYear(), reportMonth.getUTCMonth() + 1, 1)));

  switch (sectionKey) {
    case 'business_unit_summary': {
      const data = await calcBusinessUnitSummary(organisationId, reportMonth);
      return `Write financial commentary for the Business Unit Summary for ${month}. Awarded margin: ${fmt(data.awardedMargin)} (rate: ${fmtPct(data.awardedMarginRate)}). Backlog margin: ${fmt(data.backlogMargin)} (rate: ${fmtPct(data.backlogMarginRate)}). Net project cash flow: ${fmt(data.netProjectCashFlow)}. Net cash vs gross margin variance: ${fmt(data.netCashVsGrossMargin)}. Current ratio: ${data.currentRatio?.toFixed(2) ?? 'N/A'} (target >1.2). Quick ratio: ${data.quickRatio?.toFixed(2) ?? 'N/A'} (target >1.0). Working capital: ${fmt(data.workingCapital)}. Debtor days: ${data.debtorDays?.toFixed(0) ?? 'N/A'} (target <45). Creditor days: ${data.creditorDays?.toFixed(0) ?? 'N/A'} (target <45). Full year margin forecast: ${fmt(data.fyForecastMargin)}. Cash balance: ${fmt(data.cashBalance)}.`;
    }

    case 'consolidated_pl': {
      const data = await calcConsolidatedPnL(organisationId, reportMonth);
      return `Write financial commentary for the Consolidated P&L for ${month}. Revenue this month: ${fmt(data.thisMonth.revenue)} vs budget ${data.budget.revenue ? fmt(data.budget.revenue) : 'N/A'}. YTD revenue: ${fmt(data.ytd.revenue)} vs budget ${fmt(data.budget.revenue)}. Gross profit this month: ${fmt(data.thisMonth.grossProfit)} (${fmtPct(data.thisMonth.grossMarginPct)} margin) vs target 25%. YTD gross profit: ${fmt(data.ytd.grossProfit)} (${fmtPct(data.ytd.grossMarginPct)} margin). Indirect expenses YTD: ${fmt(data.ytd.indirectExpenses)}. Net profit this month: ${fmt(data.thisMonth.netProfitBeforeTax)} (${fmtPct(data.thisMonth.netProfitRate)} rate). YTD net profit: ${fmt(data.ytd.netProfitBeforeTax)} vs budget ${fmt(data.budget.netProfitBeforeTax)}. Revenue variance vs budget: ${fmtPct(data.variance.revenuePct)}.`;
    }

    case 'project_financial': {
      const wip = await calcWIPSchedule(organisationId, reportMonth);
      const summary = await calcProjectFinancialSummary(organisationId, reportMonth, wip);
      const totalCV = summary.reduce((s, p) => s + p.forecastContractValue, 0);
      const overallMargin = totalCV > 0 ? summary.reduce((s, p) => s + p.forecastMarginDollars, 0) / totalCV : 0;
      const redProjects = summary.filter((p) => p.flag === 'RED');
      const amberProjects = summary.filter((p) => p.flag === 'AMBER');
      const overbilled = wip.filter((w) => w.overbilledUnderbilled < 0);
      const underbilled = wip.filter((w) => w.overbilledUnderbilled > 0);
      const labourBreach = summary.filter((p) => p.labourVariance > 0);
      const subBreach = summary.filter((p) => p.subVariance > 0);
      return `Write financial commentary for the Project Financial Summary for ${month}. Total portfolio contract value: ${fmt(totalCV)}. Overall forecast margin: ${fmtPct(overallMargin)}. Projects flagged RED: ${redProjects.length > 0 ? redProjects.map((p) => p.projectName + ' (' + (p.flagReason ?? 'action required') + ')').join(', ') : 'none'}. Projects flagged AMBER: ${amberProjects.length > 0 ? amberProjects.map((p) => p.projectName).join(', ') : 'none'}. Overbilled projects: ${overbilled.length > 0 ? overbilled.map((w) => w.projectName + ' (' + fmt(Math.abs(w.overbilledUnderbilled)) + ')').join(', ') : 'none'}. Underbilled projects: ${underbilled.length > 0 ? underbilled.map((w) => w.projectName + ' (' + fmt(w.overbilledUnderbilled) + ')').join(', ') : 'none'}. Labour benchmark breaches: ${labourBreach.length > 0 ? labourBreach.map((p) => p.projectName).join(', ') : 'none'}. Sub cost benchmark breaches: ${subBreach.length > 0 ? subBreach.map((p) => p.projectName).join(', ') : 'none'}.`;
    }

    case 'wip_schedule': {
      const wip = await calcWIPSchedule(organisationId, reportMonth);
      const totalUnderbilled = wip.filter((w) => w.overbilledUnderbilled > 0).reduce((s, w) => s + w.overbilledUnderbilled, 0);
      const totalOverbilled = wip.filter((w) => w.overbilledUnderbilled < 0).reduce((s, w) => s + Math.abs(w.overbilledUnderbilled), 0);
      const totalCV = wip.reduce((s, w) => s + w.contractValue, 0);
      const weightedPct = totalCV > 0 ? wip.reduce((s, w) => s + w.pctComplete * w.contractValue, 0) / totalCV : 0;
      const decliningGP = wip.filter((w) => w.estimatedGpPct < 0.12);
      const largest = wip.reduce((best, w) => {
        const move = Math.abs(w.overbilledUnderbilled);
        return move > Math.abs(best?.overbilledUnderbilled ?? 0) ? w : best;
      }, wip[0]);
      return `Write WIP schedule commentary for ${month}. Total underbilled (asset): ${fmt(totalUnderbilled)}. Total overbilled (liability): ${fmt(totalOverbilled)}. Projects with declining estimated GP: ${decliningGP.length > 0 ? decliningGP.map((w) => w.projectName + ' (' + fmtPct(w.estimatedGpPct) + ')').join(', ') : 'none'}. Largest WIP movement: ${largest ? largest.projectName + ' (' + fmt(Math.abs(largest.overbilledUnderbilled)) + ', ' + (largest.overbilledUnderbilled > 0 ? 'underbilled' : 'overbilled') + ')' : 'N/A'}. Overall portfolio % complete: ${fmtPct(weightedPct)}.`;
    }

    case 'month_ahead': {
      const busUnit = await calcBusinessUnitSummary(organisationId, reportMonth);
      const secured = await prisma.securedForecast.findMany({ where: { organisationId } });
      const nextMonthKey = new Date(Date.UTC(reportMonth.getUTCFullYear(), reportMonth.getUTCMonth() + 1, 1));
      const monthBudgetKey = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][nextMonthKey.getUTCMonth()];
      const nextMonthRevenue = secured.reduce((s, sf) => {
        const v = (sf as unknown as Record<string, unknown>)[monthBudgetKey];
        return s + (v ? parseFloat(String(v)) || 0 : 0);
      }, 0);
      const projects = await prisma.financeProject.findMany({
        where: { organisationId, reportMonth, deletedAt: null },
      });
      const subPayments = projects.reduce((s, p) => s + parseFloat(String(p.subClaims || 0)), 0);
      const cashOutlook = busUnit.cashBalance > 100000 ? 'positive' : busUnit.cashBalance > 0 ? 'tight' : 'negative';
      return `Write a Month Ahead commentary for ${nextMonth}. Expected progress claims to issue: ${fmt(nextMonthRevenue)} based on secured forecast. Subcontractor payments due: approximately ${fmt(subPayments * 0.3)} (estimated 30% of current sub claims). Cash position outlook: ${cashOutlook} based on current bank balance of ${fmt(busUnit.cashBalance)} and expected inflows/outflows.`;
    }

    default:
      return `Write financial commentary for the ${sectionKey.replace(/_/g, ' ')} section for ${month}. Provide a professional, concise summary.`;
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { sectionKey, reportId } = await req.json();
  if (!sectionKey || !reportId) return NextResponse.json({ error: 'Missing sectionKey or reportId' }, { status: 400 });

  const report = await prisma.managementReport.findFirst({
    where: { id: reportId, organisationId: user.organisationId },
  });
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

  const userPrompt = await buildPrompt(sectionKey, report.reportMonth, user.organisationId);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const aiDraft = message.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('');

  // Upsert section record
  const section = await prisma.managementReportSection.upsert({
    where: { managementReportId_sectionKey: { managementReportId: reportId, sectionKey } },
    create: {
      managementReportId: reportId,
      sectionKey,
      aiDraft,
      aiGeneratedAt: new Date(),
    },
    update: {
      aiDraft,
      aiGeneratedAt: new Date(),
    },
  });

  return NextResponse.json({ aiDraft, sectionId: section.id });
}
