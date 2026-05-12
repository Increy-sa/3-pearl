export const mockTickets = [
  {
    id: 'TKT-001',
    clientName: 'Fresh Finds Grocery',
    status: 'PENDING_AI_PROPOSAL',
    assignedStaff: [],
  },
  {
    id: 'TKT-002',
    clientName: 'Luxe Leather Goods',
    status: 'DESIGN_IN_PROGRESS',
    assignedStaff: ['Charlie Designer'],
  },
  {
    id: 'TKT-003',
    clientName: 'Tech Haven',
    status: 'DEVELOPMENT_IN_PROGRESS',
    assignedStaff: ['Dave Programmer'],
  },
  {
    id: 'TKT-004',
    clientName: 'Bloom Florals',
    status: 'ASSIGNED_TO_AM',
    assignedStaff: ['Bob AM'],
  },
];

export const simulateAIProposal = async (data: any) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: 'AI-101',
        brandVoice: 'Modern, Trustworthy, Innovative',
        suggestedNames: ['NovaStore', 'Elevate Commerce', 'Aura Market'],
        colorPalette: ['#0f172a', '#3b82f6', '#10b981', '#f8fafc'],
      });
    }, 2000); // Simulate network delay
  });
};
