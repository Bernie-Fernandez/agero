import type { CashFlowCategory, CashFlowDirection } from '@agero/db';

export const CATEGORY_DIRECTION: Record<CashFlowCategory, CashFlowDirection> = {
  PROGRESS_CLAIM_RECEIPT: 'INFLOW',
  RETENTION_RELEASE: 'INFLOW',
  OTHER_INFLOW: 'INFLOW',
  SUBCONTRACTOR_PAYMENT: 'OUTFLOW',
  WAGES: 'OUTFLOW',
  ATO_BAS: 'OUTFLOW',
  ATO_PAYG: 'OUTFLOW',
  OVERHEAD: 'OUTFLOW',
  LOAN_REPAYMENT: 'OUTFLOW',
  OTHER_OUTFLOW: 'OUTFLOW',
};

export const CATEGORY_LABELS: Record<CashFlowCategory, string> = {
  PROGRESS_CLAIM_RECEIPT: 'Progress Claims Receivable',
  RETENTION_RELEASE: 'Retention Releases',
  OTHER_INFLOW: 'Other Inflows',
  SUBCONTRACTOR_PAYMENT: 'Subcontractor Payments',
  WAGES: 'Wages & Super',
  ATO_BAS: 'ATO — BAS',
  ATO_PAYG: 'ATO — PAYG',
  OVERHEAD: 'Overheads',
  LOAN_REPAYMENT: 'Loan Repayments',
  OTHER_OUTFLOW: 'Other Outflows',
};
