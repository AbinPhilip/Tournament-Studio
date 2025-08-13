import type { User, AppData, Team, Organization } from '@/types';

export const mockUsers: User[] = [
  { id: '1', username: 'individual_user', phoneNumber: '1112223333', role: 'individual', name: 'Alex Doe', email: 'alex.doe@example.com' },
  { id: '2', username: 'update_user', phoneNumber: '4445556666', role: 'update', name: 'Ben Carter', email: 'ben.carter@example.com' },
  { id: '3', username: 'admin_user', phoneNumber: '7778889999', role: 'admin', name: 'Casey Smith', email: 'casey.smith@example.com' },
  { id: '4', username: 'inquiry_user', phoneNumber: '1234567890', role: 'inquiry', name: 'Dana Ray', email: 'dana.ray@example.com' },
];

export const mockAppData: AppData[] = [
    { id: 1, name: 'Client Onboarding Status', value: 'Phase 2', lastUpdated: '2023-10-26T10:00:00Z', updatedBy: 'Ben Carter', isFlagged: false },
    { id: 2, name: 'Project Alpha Budget', value: '50000', lastUpdated: '2023-10-25T14:30:00Z', updatedBy: 'Ben Carter', isFlagged: false },
    { id: 3, name: 'Server Uptime', value: '99.98', lastUpdated: '2023-10-26T11:00:00Z', updatedBy: 'System', isFlagged: false },
    { id: 4, name: 'Q4 Marketing Spend', value: '15000', lastUpdated: '2023-10-24T09:15:00Z', updatedBy: 'Ben Carter', isFlagged: true },
    { id: 5, name: 'Support Ticket Volume', value: '253', lastUpdated: '2023-10-26T16:45:00Z', updatedBy: 'System', isFlagged: false },
    { id: 6, name: 'Active Users', value: '1250', lastUpdated: '2023-10-26T18:00:00Z', updatedBy: 'System', isFlagged: false },
];

export const mockOrganizations: Organization[] = [
    { id: '1', name: 'Legends Club', location: 'Kuala Lumpur, Malaysia' },
    { id: '2', name: 'Indonesia National Team', location: 'Jakarta, Indonesia' },
    { id: '3', name: 'Spain National Team', location: 'Madrid, Spain' },
];

export const mockTeams: Team[] = [
    { id: '1', type: 'mens_doubles', player1Name: 'Lee Chong Wei', player2Name: 'Lin Dan', organizationId: '1', genderP1: 'male' },
    { id: '2', type: 'mixed_doubles', player1Name: 'Tontowi Ahmad', player2Name: 'Liliyana Natsir', organizationId: '2', genderP1: 'male' },
    { id: '3', type: 'singles', player1Name: 'Carolina Marín', organizationId: '3' },
];
