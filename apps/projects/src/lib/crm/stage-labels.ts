import type { LeadStage } from '@agero/db';

const STAGE_LABEL_MAP: Record<LeadStage, string> = {
  RESEARCH: 'Research',
  VALIDATED: 'Validated',
  DEVELOPING: 'Developing',
  QUALIFIED: 'Qualified',
  SUBMISSION_IN_PROGRESS: 'Submission (In Progress)',
  SUBMISSION_AWAITING: 'Submission (Awaiting)',
  INTENT_TO_NEGOTIATE: 'Intent to Negotiate',
  CLOSED_WON: 'Closed Won',
  CLOSED_LOST: 'Closed Lost',
  DEAD: 'Dead',
  WITHDRAWN: 'Withdrawn',
  PURSUIT_UNSUCCESSFUL: 'Pursuit Unsuccessful',
  SUBMISSION_DECLINED: 'Submission Declined',
  SUBMISSION_WITHDRAWN: 'Submission Withdrawn',
};

export function stageLabel(stage: string): string {
  return STAGE_LABEL_MAP[stage as LeadStage] ?? stage;
}

export const ALL_STAGES: LeadStage[] = [
  'RESEARCH',
  'VALIDATED',
  'DEVELOPING',
  'QUALIFIED',
  'SUBMISSION_IN_PROGRESS',
  'SUBMISSION_AWAITING',
  'INTENT_TO_NEGOTIATE',
  'CLOSED_WON',
  'CLOSED_LOST',
  'DEAD',
  'WITHDRAWN',
  'PURSUIT_UNSUCCESSFUL',
  'SUBMISSION_DECLINED',
  'SUBMISSION_WITHDRAWN',
];
