export type UserRole = 'individual' | 'update' | 'admin' | 'inquiry';

export interface User {
  id: string;
  username: string;
  phoneNumber: string;
  role: UserRole;
  name: string;
  email: string;
}

export interface AppData {
  id: number;
  name: string;
  value: string;
  lastUpdated: string;
  updatedBy: string;
  isFlagged: boolean;
}

export type TeamType = 'singles' | 'mens_doubles' | 'mixed_doubles';
export type Gender = 'male' | 'female';

export interface Team {
    id: string;
    type: TeamType;
    player1Name: string;
    player2Name?: string;
    genderP1?: Gender;
    organization: string;
}
