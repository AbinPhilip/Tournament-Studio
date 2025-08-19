
import type { User, AppData, Team, Organization, TeamType } from '@/types';

// This file is intentionally left blank. 
// All data is now managed directly in Firestore through the application UI.

export const mockUsers: Omit<User, 'id'>[] = [];
export const mockAppData: Omit<AppData, 'id'>[] = [];
export const mockOrganizations: Omit<Organization, 'id'>[] = [];
export const mockTeams: (Omit<Team, 'id' | 'organizationId'> & { organizationName: string })[] = [];
    
