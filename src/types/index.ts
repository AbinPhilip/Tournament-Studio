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
