import type { LeadStage } from '@agero/db';

const STAGE_LABEL_MAP: Record<LeadStage, string> = {
  RESEARCH: '0 Research Lead',
  VALIDATED: '1 Validated Deal',
  DEVELOPING: '2 Developing Deal',
  QUALIFIED: '3 Qualified Deal',
  SUBMISSION_IN_PROGRESS: '4 Submission in Progress',
  SUBMISSION_AWAITING: '5 Submission Awaiting Decision',
  INTENT_TO_NEGOTIATE: '6 Intent to Negotiate',
  CLOSED_WON: '7 Closed Won',
  CLOSED_LOST: '8 Closed Lost',
  WITHDRAWN: '9 Pursuit Withdrawn',
  PURSUIT_UNSUCCESSFUL: '10 Pursuit Unsuccessful',
  DEAD: '11 Dead',
  SUBMISSION_DECLINED: '12 Submission Declined',
  SUBMISSION_WITHDRAWN: '13 Submission Withdrawn',
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
