
import type { User, AppData, Team, Organization, TeamType } from '@/types';

export const mockUsers: Omit<User, 'id'>[] = [
  { name: 'Alice Johnson', username: 'alicej', email: 'alice.j@example.com', phoneNumber: '1112223333', role: 'admin' },
  { name: 'Bob Williams', username: 'bobw', email: 'bob.w@example.com', phoneNumber: '4445556666', role: 'super' },
  { name: 'Charlie Brown', username: 'charlieb', email: 'charlie.b@example.com', phoneNumber: '7778889999', role: 'update' },
  { name: 'Diana Prince', username: 'dianap', email: 'diana.p@example.com', phoneNumber: '1234567890', role: 'inquiry' },
  { name: 'Ethan Hunt', username: 'ethanh', email: 'ethan.h@example.com', phoneNumber: '0987654321', role: 'individual' },
  { name: 'Fiona Glenanne', username: 'fionag', email: 'fiona.g@example.com', phoneNumber: '1122334455', role: 'individual' },
  { name: 'Sajan Varghese', username: 'sajanvarghese', email: 'sajan.varghese@example.com', phoneNumber: '1234567890', role: 'admin' },
  { name: 'Sharon Thomas', username: 'sharonthomas', email: 'sharon.thomas@example.com', phoneNumber: '1234567890', role: 'admin' },
];

export const mockAppData: Omit<AppData, 'id'>[] = [
  { name: 'Shuttlecock Supply', value: '150 boxes', lastUpdated: '2023-10-27T10:00:00Z', updatedBy: 'system', isFlagged: false },
  { name: 'Court Maintenance Status', value: 'All courts operational', lastUpdated: '2023-10-27T11:00:00Z', updatedBy: 'system', isFlagged: false },
  { name: 'Sponsorship Revenue', value: '25000', lastUpdated: '2023-10-26T15:30:00Z', updatedBy: 'system', isFlagged: true },
];

export const mockOrganizations: Omit<Organization, 'id'>[] = [
  { name: 'St.Peter\'s & St.Paul\'s OSC, Koyambedu', location: 'Koyambedu' },
  { name: 'St.George OSC, Padi', location: 'Padi' },
  { name: 'St.Gregorios OSC, Perambur', location: 'Perambur' },
  { name: 'St.Thomas OSC, Puzhuthivakkam', location: 'Puzhuthivakkam' },
  { name: 'Mar Gregorios OSC, Tambaram', location: 'Tambaram' },
  { name: 'St.Mary\'s OSC, Thiruvottiyur', location: 'Thiruvottiyur' },
  { name: 'St.George OSC, Ramalingapuram', location: 'Ramalingapuram' },
  { name: 'St.Thomas Cathedral, Broadway', location: 'Broadway' },
  { name: 'St.Mary\'s Cathedral, Coimbatore', location: 'Coimbatore' },
  { name: 'St.George OSC, Avadi', location: 'Avadi' },
];

export const mockTeams: (Omit<Team, 'id' | 'organizationId'> & { organizationName: string })[] = [
    // Mens Doubles
    { type: 'mens_doubles', player1Name: 'Allen B George', player2Name: 'Rohan James', organizationName: 'St.George OSC, Ramalingapuram' },
    { type: 'mens_doubles', player1Name: 'Sanjan Sunil', player2Name: 'Johan Thomas', organizationName: 'St.Peter\'s & St.Paul\'s OSC, Koyambedu' },
    { type: 'mens_doubles', player1Name: 'Vineeth P V', player2Name: 'Shalin Sunil', organizationName: 'St.Peter\'s & St.Paul\'s OSC, Koyambedu' },
    { type: 'mens_doubles', player1Name: 'Ajay', player2Name: 'O J Philip', organizationName: 'St.George OSC, Padi' },
    { type: 'mens_doubles', player1Name: 'Ebin Thomas', player2Name: 'Ajith Jacob', organizationName: 'St.George OSC, Padi' },
    { type: 'mens_doubles', player1Name: 'Febin Thomas', player2Name: 'Sibin Koshy', organizationName: 'St.George OSC, Padi' },
    { type: 'mens_doubles', player1Name: 'Shabin T S', player2Name: 'Shijin', organizationName: 'St.George OSC, Padi' },
    { type: 'mens_doubles', player1Name: 'Abraham George Thomas', player2Name: 'Roshan Thomas Mathew', organizationName: 'St.Gregorios OSC, Perambur' },
    { type: 'mens_doubles', player1Name: 'Noble Chandy Alex', player2Name: 'Basil P Eldo', organizationName: 'St.Gregorios OSC, Perambur' },
    { type: 'mens_doubles', player1Name: 'Reuben Cherian', player2Name: 'Avinash George Thomas', organizationName: 'St.Gregorios OSC, Perambur' },
    { type: 'mens_doubles', player1Name: 'Shine P Eldo', player2Name: 'Jojy T', organizationName: 'St.Gregorios OSC, Perambur' },
    { type: 'mens_doubles', player1Name: 'Basil Manithottam', player2Name: 'Russel B Rex', organizationName: 'St.Thomas OSC, Puzhuthivakkam' },
    { type: 'mens_doubles', player1Name: 'Nevin Justy', player2Name: 'Alwyn Roy', organizationName: 'St.Thomas OSC, Puzhuthivakkam' },
    { type: 'mens_doubles', player1Name: 'Jijo Jose', player2Name: 'Roshan B Reji', organizationName: 'Mar Gregorios OSC, Tambaram' },
    { type: 'mens_doubles', player1Name: 'Remil P Babu', player2Name: 'Nathaniel Geevarghese Skariah', organizationName: 'Mar Gregorios OSC, Tambaram' },
    { type: 'mens_doubles', player1Name: 'Robin Varghese', player2Name: 'Subin Varghese C', organizationName: 'Mar Gregorios OSC, Tambaram' },
    { type: 'mens_doubles', player1Name: 'Sonu Jacob Zachariah', player2Name: 'George Steve Varghese', organizationName: 'Mar Gregorios OSC, Tambaram' },
    { type: 'mens_doubles', player1Name: 'Sibi', player2Name: 'Merwin', organizationName: 'St.Mary\'s OSC, Thiruvottiyur' },
    { type: 'mens_doubles', player1Name: 'David Babu', player2Name: 'Albin Biju', organizationName: 'St.Mary\'s OSC, Thiruvottiyur' },
    { type: 'mens_doubles', player1Name: 'Linosh', player2Name: 'Rohan Thomas', organizationName: 'St.Mary\'s OSC, Thiruvottiyur' },
    { type: 'mens_doubles', player1Name: 'Sunjith', player2Name: 'Shaun', organizationName: 'St.Thomas Cathedral, Broadway' },
    { type: 'mens_doubles', player1Name: 'Thomas', player2Name: 'Immanuel', organizationName: 'St.Thomas Cathedral, Broadway' },
    { type: 'mens_doubles', player1Name: 'Andrew', player2Name: 'Jibu', organizationName: 'St.Thomas Cathedral, Broadway' },
    { type: 'mens_doubles', player1Name: 'Eldhow Sabu', player2Name: 'Lawrence KV', organizationName: 'St.Mary\'s Cathedral, Coimbatore' },
    { type: 'mens_doubles', player1Name: 'Gregery Mohan', player2Name: 'Albin Abraham', organizationName: 'St.George OSC, Avadi' },
    { type: 'mens_doubles', player1Name: 'Jeevan Thomas John', player2Name: 'Kenneth', organizationName: 'St.George OSC, Avadi' },
    { type: 'mens_doubles', player1Name: 'Sharon Thomas', player2Name: 'Jones Thomas', organizationName: 'St.George OSC, Avadi' },
    { type: 'mens_doubles', player1Name: 'Denis Thomas', player2Name: 'Jithin Philip', organizationName: 'St.George OSC, Avadi' },
    { type: 'mens_doubles', player1Name: 'Nibin', player2Name: 'Johjen', organizationName: 'St.George OSC, Avadi' },
    
    // Womens Doubles
    { type: 'womens_doubles', player1Name: 'Ancy B George', player2Name: 'Anju Susan Thomas', organizationName: 'St.George OSC, Ramalingapuram' },
    { type: 'womens_doubles', player1Name: 'Sarah Cherian', player2Name: 'Sheba Cherian', organizationName: 'St.Peter\'s & St.Paul\'s OSC, Koyambedu' },
    { type: 'womens_doubles', player1Name: 'Teena Thomas', player2Name: 'Sherine Vineeth', organizationName: 'St.Peter\'s & St.Paul\'s OSC, Koyambedu' },
    { type: 'womens_doubles', player1Name: 'Ancy Thomson', player2Name: 'Alisha Susan', organizationName: 'St.George OSC, Padi' },
    { type: 'womens_doubles', player1Name: 'Subitha Anoop', player2Name: 'Jinsi Daniel', organizationName: 'St.George OSC, Padi' },
    { type: 'womens_doubles', player1Name: 'Merlin Rachel Joy', player2Name: 'Lincy Anna Varghese', organizationName: 'St.Thomas OSC, Puzhuthivakkam' },
    { type: 'womens_doubles', player1Name: 'Jerlin K Reji', player2Name: 'Sharon Zacharia', organizationName: 'Mar Gregorios OSC, Tambaram' },
    { type: 'womens_doubles', player1Name: 'Sinu Jacob Zachariah', player2Name: 'Johnse Johnson', organizationName: 'Mar Gregorios OSC, Tambaram' },
    { type: 'womens_doubles', player1Name: 'Steffii Mary', player2Name: 'Sharon Ancy', organizationName: 'St.Mary\'s OSC, Thiruvottiyur' },
    { type: 'womens_doubles', player1Name: 'Vincy', player2Name: 'Sharon', organizationName: 'St.Mary\'s OSC, Thiruvottiyur' },
    { type: 'womens_doubles', player1Name: 'Annette', player2Name: 'Leena', organizationName: 'St.Thomas Cathedral, Broadway' },
    { type: 'womens_doubles', player1Name: 'Jinu Mathew', player2Name: 'Sneha Jithin', organizationName: 'St.George OSC, Avadi' },
    { type: 'womens_doubles', player1Name: 'Kezia john', player2Name: 'Irene Biju', organizationName: 'St.Gregorios OSC, Perambur' },
    
    // Mixed Doubles
    { type: 'mixed_doubles', player1Name: 'Vineeth P V', genderP1: 'male', player2Name: 'Teena Thomas', genderP2: 'female', organizationName: 'St.Peter\'s & St.Paul\'s OSC, Koyambedu' },
    { type: 'mixed_doubles', player1Name: 'Shabin T S', genderP1: 'male', player2Name: 'Subitha Anoop', genderP2: 'female', organizationName: 'St.George OSC, Padi' },
    { type: 'mixed_doubles', player1Name: 'Basil Manithottam', genderP1: 'male', player2Name: 'Merlin Rachel Joy', genderP2: 'female', organizationName: 'St.Thomas OSC, Puzhuthivakkam' },
    { type: 'mixed_doubles', player1Name: 'Nevin Justy', genderP1: 'male', player2Name: 'Lincy Anna Varghese', genderP2: 'female', organizationName: 'St.Thomas OSC, Puzhuthivakkam' },
    { type: 'mixed_doubles', player1Name: 'Remil P Babu', genderP1: 'male', player2Name: 'Johnse', genderP2: 'female', organizationName: 'Mar Gregorios OSC, Tambaram' },
    { type: 'mixed_doubles', player1Name: 'Subin Varghese', genderP1: 'male', player2Name: 'Jerlin K Reji', genderP2: 'female', organizationName: 'Mar Gregorios OSC, Tambaram' },
    { type: 'mixed_doubles', player1Name: 'Albin', genderP1: 'male', player2Name: 'Vincy', genderP2: 'female', organizationName: 'St.Mary\'s OSC, Thiruvottiyur' },
    { type: 'mixed_doubles', player1Name: 'Bijo', genderP1: 'male', player2Name: 'Steffi Mary', genderP2: 'female', organizationName: 'St.Mary\'s OSC, Thiruvottiyur' },
    { type: 'mixed_doubles', player1Name: 'Linosh', genderP1: 'male', player2Name: 'Sharon Ancy', genderP2: 'female', organizationName: 'St.Mary\'s OSC, Thiruvottiyur' },
    { type: 'mixed_doubles', player1Name: 'Shine P Eldo', genderP1: 'male', player2Name: 'Irene Biju', genderP2: 'female', organizationName: 'St.Gregorios OSC, Perambur' },
    { type: 'mixed_doubles', player1Name: 'Basil P E', genderP1: 'male', player2Name: 'Jenifer', genderP2: 'female', organizationName: 'St.Gregorios OSC, Perambur' },
    { type: 'mixed_doubles', player1Name: 'Abraham', genderP1: 'male', player2Name: 'Kezia John', genderP2: 'female', organizationName: 'St.Gregorios OSC, Perambur' },
    { type: 'mixed_doubles', player1Name: 'Sunjith', genderP1: 'male', player2Name: 'Annette', genderP2: 'female', organizationName: 'St.Thomas Cathedral, Broadway' },
    { type: 'mixed_doubles', player1Name: 'Shaun', genderP1: 'male', player2Name: 'Leena', genderP2: 'female', organizationName: 'St.Thomas Cathedral, Broadway' },
    { type: 'mixed_doubles', player1Name: 'Jithin Philip', genderP1: 'male', player2Name: 'Sneha Jithin', genderP2: 'female', organizationName: 'St.George OSC, Avadi' },
    { type: 'mixed_doubles', player1Name: 'Denis Thomas', genderP1: 'male', player2Name: 'Jinu Mathew', genderP2: 'female', organizationName: 'St.George OSC, Avadi' },
    { type: 'mixed_doubles', player1Name: 'Sharon Thomas', genderP1: 'male', player2Name: 'Donia Sharon', genderP2: 'female', organizationName: 'St.George OSC, Avadi' },
    { type: 'mixed_doubles', player1Name: 'Jones Thomas', genderP1: 'male', player2Name: 'Simi Sherry', genderP2: 'female', organizationName: 'St.George OSC, Avadi' }
];
    
