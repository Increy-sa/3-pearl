export const STAGE_CHECKLISTS: Record<string, string[]> = {
  DEVELOPMENT: [
    'Domain Booked',
    'Email Created',
    'Store Documented',
    'Migration Done'
  ]
};

export function areChecklistItemsComplete(stage: string, currentChecklist: { text: string; completed: boolean }[]): boolean {
  const mandatory = STAGE_CHECKLISTS[stage];
  if (!mandatory) return true;
  return mandatory.every(item => 
    currentChecklist.some(cl => cl.text === item && cl.completed)
  );
}

export function getRoleForStage(stage: string): string | null {
  switch (stage) {
    case 'DESIGN': return 'DESIGNER';
    case 'CLIENT_REVISION': return 'DESIGNER';
    case 'CLIENT_APPROVED': return 'DESIGNER';
    case 'DEVELOPMENT': return 'DEVELOPER';
    case 'DEVELOPMENT_REVISION': return 'DEVELOPER';   // Back to developer
    case 'PENDING_AM_REVIEW': return 'ACCOUNT_MANAGER'; // Notify AM
    case 'REVIEW': return 'QA';
    case 'LEGAL_PROCESSING': return 'ACCOUNT_MANAGER';
    default: return null;
  }
}
