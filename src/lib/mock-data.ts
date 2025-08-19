
import type { User, AppData, Team, Organization, TeamType } from '@/types';

export const mockUsers: Omit<User, 'id'>[] = [
  { name: 'Alice Johnson', username: 'alicej', email: 'alice.j@example.com', phoneNumber: '1112223333', role: 'admin' },
  { name: 'Bob Williams', username: 'bobw', email: 'bob.w@example.com', phoneNumber: '4445556666', role: 'super' },
  { name: 'Charlie Brown', username: 'charlieb', email: 'charlie.b@example.com', phoneNumber: '7778889999', role: 'update' },
  { name: 'Diana Prince', username: 'dianap', email: 'diana.p@example.com', phoneNumber: '1234567890', role: 'inquiry' },
  { name: 'Ethan Hunt', username: 'ethanh', email: 'ethan.h@example.com', phoneNumber: '0987654321', role: 'individual' },
  { name: 'Fiona Glenanne', username: 'fionag', email: 'fiona.g@example.com', phoneNumber: '1122334455', role: 'individual' },
];

export const mockAppData: Omit<AppData, 'id'>[] = [
  { name: 'Shuttlecock Supply', value: '150 boxes', lastUpdated: '2023-10-27T10:00:00Z', updatedBy: 'system', isFlagged: false },
  { name: 'Court Maintenance Status', value: 'All courts operational', lastUpdated: '2023-10-27T11:00:00Z', updatedBy: 'system', isFlagged: false },
  { name: 'Sponsorship Revenue', value: '25000', lastUpdated: '2023-10-26T15:30:00Z', updatedBy: 'system', isFlagged: true },
];

export const mockOrganizations: Omit<Organization, 'id'>[] = [
  { name: 'Ace Badminton Club', location: 'Metropolis' },
  { name: 'Smashville Academy', location: 'Star City' },
  { name: 'Shuttle Masters', location: 'Gotham' },
  { name: 'Phoenix Badminton', location: 'Central City' },
];

export const mockTeams: (Omit<Team, 'id' | 'organizationId'> & { organizationName: string })[] = [
    // Singles
    { type: 'singles', player1Name: 'Ken Masters', genderP1: 'male', organizationName: 'Ace Badminton Club', lotNumber: 1 },
    { type: 'singles', player1Name: 'Ryu Hoshi', genderP1: 'male', organizationName: 'Shuttle Masters', lotNumber: 2 },
    { type: 'singles', player1Name: 'Chun-Li', genderP1: 'female', organizationName: 'Phoenix Badminton', lotNumber: 3 },
    { type: 'singles', player1Name: 'Cammy White', genderP1: 'female', organizationName: 'Smashville Academy', lotNumber: 4 },
    { type: 'singles', player1Name: 'Fei Long', genderP1: 'male', organizationName: 'Ace Badminton Club', lotNumber: 5 },
    { type: 'singles', player1Name: 'Dee Jay', genderP1: 'male', organizationName: 'Shuttle Masters', lotNumber: 6 },
    { type: 'singles', player1Name: 'Sakura Kasugano', genderP1: 'female', organizationName: 'Phoenix Badminton', lotNumber: 7 },
    { type: 'singles', player1Name: 'Karin Kanzuki', genderP1: 'female', organizationName: 'Smashville Academy', lotNumber: 8 },

    // Men's Doubles
    { type: 'mens_doubles', player1Name: 'Mario Mario', player2Name: 'Luigi Mario', organizationName: 'Ace Badminton Club', lotNumber: 1 },
    { type: 'mens_doubles', player1Name: 'Wario', player2Name: 'Waluigi', organizationName: 'Shuttle Masters', lotNumber: 2 },
    { type: 'mens_doubles', player1Name: 'Donkey Kong', player2Name: 'Diddy Kong', organizationName: 'Phoenix Badminton', lotNumber: 3 },
    { type: 'mens_doubles', player1Name: 'Bowser', player2Name: 'Bowser Jr.', organizationName: 'Smashville Academy', lotNumber: 4 },

    // Women's Doubles
    { type: 'womens_doubles', player1Name: 'Peach Toadstool', player2Name: 'Daisy', organizationName: 'Ace Badminton Club', lotNumber: 1 },
    { type: 'womens_doubles', player1Name: 'Rosalina', player2Name: 'Pauline', organizationName: 'Shuttle Masters', lotNumber: 2 },
    { type: 'womens_doubles', player1Name: 'Toadette', player2Name: 'Birdo', organizationName: 'Phoenix Badminton', lotNumber: 3 },
    { type: 'womens_doubles', player1Name: 'Wendy O. Koopa', player2Name: 'Pom Pom', organizationName: 'Smashville Academy', lotNumber: 4 },

    // Mixed Doubles
    { type: 'mixed_doubles', player1Name: 'Link', genderP1: 'male', player2Name: 'Zelda', genderP2: 'female', organizationName: 'Ace Badminton Club', lotNumber: 1 },
    { type: 'mixed_doubles', player1Name: 'Ganondorf', genderP1: 'male', player2Name: 'Impa', genderP2: 'female', organizationName: 'Shuttle Masters', lotNumber: 2 },
    { type: 'mixed_doubles', player1Name: 'Samus Aran', genderP1: 'female', player2Name: 'Adam Malkovich', genderP2: 'male', organizationName: 'Phoenix Badminton', lotNumber: 3 },
    { type: 'mixed_doubles', player1Name: 'Ridley', genderP1: 'male', player2Name: 'Mother Brain', genderP2: 'female', organizationName: 'Smashville Academy', lotNumber: 4 },
];
    
