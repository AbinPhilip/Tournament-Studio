import { Timestamp } from "firebase/firestore";

export type UserRole = 'individual' | 'update' | 'admin' | 'inquiry' | 'super';

export interface User {
  id: string;
  username: string;
  phoneNumber: string;
  role: UserRole;
  name: string;
  email: string;
}

export interface AppData {
  id: string | number;
  name: string;
  value: string;
  lastUpdated: string;
  updatedBy: string;
  isFlagged: boolean;
}

export type TeamType = 'singles' | 'mens_doubles' | 'womens_doubles' | 'mixed_doubles';
export type Gender = 'male' | 'female';

export interface Organization {
  id: string;
  name: string;
  location: string;
}

export interface Team {
    id: string;
    type: TeamType;
    player1Name: string;
    player2Name?: string;
    genderP1?: Gender;
    genderP2?: Gender;
    organizationId: string;
    photoUrl?: string;
}

export type TournamentType = 'round-robin' | 'knockout';

export interface Tournament {
    id:string;
    location: string;
    date: Timestamp;
    numberOfCourts: number;
    courtNames: { name: string }[];
    tournamentType: TournamentType;
}

export type MatchStatus = 'PENDING' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';

export interface Match {
    id: string;
    team1Id: string;
    team2Id: string;
    team1Name: string;
    team2Name: string;
    eventType: TeamType;
    courtName: string;
    startTime: Timestamp;
    status: MatchStatus;
    winnerId?: string;
    score?: string;
    round?: number; // For knockout tournaments
}
