import { Timestamp } from "firebase/firestore";

export type UserRole = 'individual' | 'update' | 'admin' | 'inquiry' | 'super' | 'court';

export interface User {
  id: string;
  username: string;
  phoneNumber: string;
  role: UserRole;
  name: string;
  email: string;
  courtName?: string; // For court umpire role
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
  location?: string;
}

export interface Team {
    id: string;
    type: TeamType;
    player1Name: string;
    player2Name?: string;
    genderP1?: Gender;
    genderP2?: Gender;
    organizationId: string;
    lotNumber?: number;
}

export interface Sponsor {
  id: string;
  name: string;
  logoUrl?: string;
}

export type TournamentType = 'round-robin' | 'knockout';
export type TournamentStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface Tournament {
    id:string;
    name: string;
    hostName?: string;
    location: string;
    logoUrl?: string;
    numberOfCourts: number;
    courtNames: { name: string }[];
    tournamentType: TournamentType;
    date: Date;
    status?: TournamentStatus;
    startedAt?: Date;
    restTime?: number; // in minutes
    registrationFee?: number;
}

export type MatchStatus = 'PENDING' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';

export interface Match {
    id: string;
    team1Id: string;
    team2Id: string;
    team1Name: string;
    team2Name: string;
    team1OrgName?: string;
    team2OrgName?: string;
    eventType: TeamType;
    courtName: string;
    startTime: Date;
    lastUpdateTime?: Date | null;
    status: MatchStatus;
    winnerId?: string;
    score?: string; // e.g., "2-1" for sets, or "Forfeited"
    scores?: { team1: number, team2: number }[]; // Array of scores per set
    forfeitedById?: string;
    round?: number; // For knockout tournaments
    pointDifferential?: number;
    isRestOverridden?: boolean;
    // Live scoring fields
    live?: {
        team1Points: number;
        team2Points: number;
        servingTeamId: string;
        currentSet: number;
    } | null;
    // Client-side properties
    restEndTime?: number; 
    team1LastPlayed?: number | null;
    team2LastPlayed?: number | null;
    restingPlayers?: string[];
}

export interface ImageMetadata {
  id: string;
  imageUrl: string;
  storagePath: string;
  uploaderId: string;
  createdAt: Timestamp;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
}

export type PaymentStatus = 'pending' | 'paid';

export interface Registration {
    id: string; // Same as teamId
    teamId: string;
    paymentStatus: PaymentStatus;
    paymentAmount?: number;
    paymentDate?: Timestamp;
    kitProvided: boolean;
}
