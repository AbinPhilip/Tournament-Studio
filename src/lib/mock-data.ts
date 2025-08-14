
import type { User, AppData, Team, Organization } from '@/types';

// This file now only contains the structure for seeding data.
// The actual data is managed in Firestore.

export const mockUsers: Omit<User, 'id'>[] = [
  { username: 'individual_user', phoneNumber: '1112223333', role: 'individual', name: 'Alex Doe', email: 'alex.doe@example.com' },
  { username: 'update_user', phoneNumber: '4445556666', role: 'update', name: 'Ben Carter', email: 'ben.carter@example.com' },
  { username: 'admin_user', phoneNumber: '7778889999', role: 'admin', name: 'Casey Smith', email: 'casey.smith@example.com' },
  { username: 'inquiry_user', phoneNumber: '1234567890', role: 'inquiry', name: 'Dana Ray', email: 'dana.ray@example.com' },
  { username: 'super_user', phoneNumber: '0000000000', role: 'super', name: 'Super Admin', email: 'super.admin@example.com' },
];

export const mockAppData: Omit<AppData, 'id'>[] = [
    { name: 'Client Onboarding Status', value: 'Phase 2', lastUpdated: '2023-10-26T10:00:00Z', updatedBy: 'Ben Carter', isFlagged: false },
    { name: 'Project Alpha Budget', value: '50000', lastUpdated: '2023-10-25T14:30:00Z', updatedBy: 'Ben Carter', isFlagged: false },
    { name: 'Server Uptime', value: '99.98', lastUpdated: '2023-10-26T11:00:00Z', updatedBy: 'System', isFlagged: false },
    { name: 'Q4 Marketing Spend', value: '15000', lastUpdated: '2023-10-24T09:15:00Z', updatedBy: 'Ben Carter', isFlagged: true },
    { name: 'Support Ticket Volume', value: '253', lastUpdated: '2023-10-26T16:45:00Z', updatedBy: 'System', isFlagged: false },
    { name: 'Active Users', value: '1250', lastUpdated: '2023-10-26T18:00:00Z', updatedBy: 'System', isFlagged: false },
];

export const mockOrganizations: Omit<Organization, 'id'>[] = [
    { name: "St.Peter's & St.Paul's OSC, Koyambedu", location: 'Koyambedu' },
    { name: 'St.George OSC, Padi', location: 'Padi' },
    { name: 'St.Gregorios OSC, Perambur', location: 'Perambur' },
    { name: 'St.Thomas OSC, Puzhuthivakkam', location: 'Puzhuthivakkam' },
    { name: 'Mar Gregorios OSC, Tambaram', location: 'Tambaram' },
    { name: "St.Mary's OSC, Thiruvottiyur", location: 'Thiruvottiyur' },
    { name: 'St.George OSC, Ramalingapuram', location: 'Ramalingapuram' },
    { name: 'St.Thomas Cathedral, Broadway', location: 'Broadway' },
    { name: "St.Mary's Cathedral, Coimbatore", location: 'Coimbatore' },
    { name: 'St.George OSC, Avadi', location: 'Avadi' },
];

// Changed `organizationId` to `organizationName` for more robust mapping during seed.
// Clearing mockTeams as they are associated with old organizations.
export const mockTeams: (Omit<Team, 'id' | 'organizationId'> & { organizationName: string })[] = [];
