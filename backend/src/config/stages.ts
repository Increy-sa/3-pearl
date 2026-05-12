/**
 * Stage-Based Workflow & SLA Configuration
 * 
 * Defines the valid pipeline stages, their display order,
 * allowed transitions, and per-stage SLA thresholds.
 */

export const STAGES = [
  'INTAKE',
  'LEGAL_PROCESSING',
  'DESIGN',
  'PENDING_CLIENT_APPROVAL',  // Design sent to client for approval
  'CLIENT_APPROVED',           // Client approved the designs
  'CLIENT_REVISION',           // Client requested revision
  'DEVELOPMENT',
  'PENDING_AM_REVIEW',         // Developer done → awaiting Account Manager review
  'DEVELOPMENT_REVISION',      // AM requested revision → back to developer
  'REVIEW',
  'DELIVERED',
] as const;

export type Stage = typeof STAGES[number];

/**
 * Per-stage SLA thresholds in hours.
 */
export const SLA_HOURS: Record<Stage, number> = {
  INTAKE:                   24,
  LEGAL_PROCESSING:         48,
  DESIGN:                   48,
  PENDING_CLIENT_APPROVAL:  72,
  CLIENT_APPROVED:           0,
  CLIENT_REVISION:          48,
  DEVELOPMENT:              72,
  PENDING_AM_REVIEW:        24,  // AM should review within 24h
  DEVELOPMENT_REVISION:     48,  // Developer must fix within 48h
  REVIEW:                   24,
  DELIVERED:                 0,
};

/**
 * Allowed forward transitions.
 */
export const STAGE_TRANSITIONS: Record<Stage, Stage[]> = {
  INTAKE:                   ['LEGAL_PROCESSING'],
  LEGAL_PROCESSING:         ['DESIGN'],
  DESIGN:                   ['PENDING_CLIENT_APPROVAL', 'DEVELOPMENT'],
  PENDING_CLIENT_APPROVAL:  ['CLIENT_APPROVED', 'CLIENT_REVISION'],
  CLIENT_APPROVED:          ['DEVELOPMENT'],
  CLIENT_REVISION:          ['DESIGN'],
  DEVELOPMENT:              ['PENDING_AM_REVIEW'],
  PENDING_AM_REVIEW:        ['DELIVERED', 'DEVELOPMENT_REVISION'],  // AM approves → DELIVERED directly, or revision → back to dev
  DEVELOPMENT_REVISION:     ['PENDING_AM_REVIEW'],
  REVIEW:                   ['DELIVERED', 'DESIGN'],
  DELIVERED:                [],
};

/**
 * Stage display labels (Arabic).
 */
export const STAGE_LABELS: Record<Stage, string> = {
  INTAKE:                   'استلام الطلب',
  LEGAL_PROCESSING:         'المعالجة القانونية',
  DESIGN:                   'التصميم',
  PENDING_CLIENT_APPROVAL:  'بانتظار اعتماد العميل',
  CLIENT_APPROVED:          'معتمد من العميل',
  CLIENT_REVISION:          'طلب تعديل من العميل',
  DEVELOPMENT:              'التطوير والبرمجة',
  PENDING_AM_REVIEW:        'بانتظار مراجعة مدير الحساب',
  DEVELOPMENT_REVISION:     'تعديل من مدير الحساب',
  REVIEW:                   'المراجعة والفحص',
  DELIVERED:                'تم التسليم',
};

/**
 * Check if a stage transition is valid.
 */
export function isValidTransition(from: string, to: string): boolean {
  const allowed = STAGE_TRANSITIONS[from as Stage];
  if (!allowed) return false;
  return allowed.includes(to as Stage);
}

/**
 * Check if a ticket's SLA is breached based on stageEnteredAt.
 */
export function isSlaBreached(stage: string, stageEnteredAt: Date): boolean {
  const hours = SLA_HOURS[stage as Stage];
  if (!hours || hours === 0) return false;
  
  const now = new Date();
  const elapsed = (now.getTime() - stageEnteredAt.getTime()) / (1000 * 60 * 60);
  return elapsed > hours;
}

/**
 * Get remaining SLA time in hours (negative if breached).
 */
export function getSlaRemainingHours(stage: string, stageEnteredAt: Date): number {
  const hours = SLA_HOURS[stage as Stage];
  if (!hours || hours === 0) return Infinity;
  
  const now = new Date();
  const elapsed = (now.getTime() - stageEnteredAt.getTime()) / (1000 * 60 * 60);
  return Math.round((hours - elapsed) * 10) / 10; // 1 decimal place
}
