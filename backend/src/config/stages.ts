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
  'DEVELOPMENT',
  'REVIEW',
  'DELIVERED',
] as const;

export type Stage = typeof STAGES[number];

/**
 * Per-stage SLA thresholds in hours.
 * If a ticket remains in a stage longer than this, it is flagged as breached.
 */
export const SLA_HOURS: Record<Stage, number> = {
  INTAKE:           24,
  LEGAL_PROCESSING: 48,
  DESIGN:           48,
  DEVELOPMENT:      72,
  REVIEW:           24,
  DELIVERED:        0,  // No SLA for delivered tickets
};

/**
 * Allowed forward transitions.
 * Each stage maps to the stages it can advance to.
 */
export const STAGE_TRANSITIONS: Record<Stage, Stage[]> = {
  INTAKE:           ['LEGAL_PROCESSING'],
  LEGAL_PROCESSING: ['DESIGN'],
  DESIGN:           ['DEVELOPMENT'],
  DEVELOPMENT:      ['REVIEW'],
  REVIEW:           ['DELIVERED', 'DESIGN'], // Can send back to DESIGN for revisions
  DELIVERED:        [],
};

/**
 * Stage display labels (Arabic).
 */
export const STAGE_LABELS: Record<Stage, string> = {
  INTAKE:           'استلام الطلب',
  LEGAL_PROCESSING: 'المعالجة القانونية',
  DESIGN:           'التصميم',
  DEVELOPMENT:      'التطوير والبرمجة',
  REVIEW:           'المراجعة والفحص',
  DELIVERED:        'تم التسليم',
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
