/**
 * Stage-Based Workflow & SLA Configuration
 * 
 * Defines the valid pipeline stages, their display order,
 * allowed transitions, and per-stage SLA thresholds.
 */

export const STAGES = [
  'INTAKE',
  'SEO_STORE_SETUP',
  'DESIGN',
  'DEVELOPMENT',
  'SEO_FINAL',
  'DELIVERED',
] as const;

export type Stage = typeof STAGES[number];

/**
 * Per-stage SLA thresholds in hours.
 */
export const SLA_HOURS: Record<Stage, number> = {
  INTAKE:           24,
  SEO_STORE_SETUP: 168,  // 1 week
  DESIGN:           48,
  DEVELOPMENT:      72,
  SEO_FINAL:       120,  // 5 days
  DELIVERED:         0,
};

/**
 * Allowed forward transitions.
 */
export const STAGE_TRANSITIONS: Record<Stage, Stage[]> = {
  INTAKE:          ['SEO_STORE_SETUP'],
  SEO_STORE_SETUP: ['DESIGN'],
  DESIGN:          ['DEVELOPMENT'],
  DEVELOPMENT:     ['SEO_FINAL'],
  SEO_FINAL:       ['DELIVERED'],
  DELIVERED:       [],
};

/**
 * Stage display labels (Arabic).
 */
export const STAGE_LABELS: Record<Stage, string> = {
  INTAKE:          'استلام الطلب',
  SEO_STORE_SETUP: 'إعدادات الـ SEO',
  DESIGN:          'التصميم',
  DEVELOPMENT:     'التطوير والبرمجة',
  SEO_FINAL:       'المراجعة النهائية وSEO',
  DELIVERED:       'تم التسليم',
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
