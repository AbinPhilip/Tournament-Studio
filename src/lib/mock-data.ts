
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
    { name: 'Legends Club', location: 'Kuala Lumpur, Malaysia' },
    { name: 'Indonesia National Team', location: 'Jakarta, Indonesia' },
    { name: 'Spain National Team', location: 'Madrid, Spain' },
    { name: 'Japan National Team', location: 'Tokyo, Japan' },
];

// Changed `organizationId` to `organizationName` for more robust mapping during seed.
export const mockTeams: (Omit<Team, 'id' | 'organizationId'> & { organizationName: string })[] = [
    // Existing Teams
    { type: 'mens_doubles', player1Name: 'Lee Chong Wei', player2Name: 'Lin Dan', organizationName: 'Legends Club' },
    { type: 'mixed_doubles', player1Name: 'Tontowi Ahmad', player2Name: 'Liliyana Natsir', organizationName: 'Indonesia National Team', genderP1: 'male', genderP2: 'female' },
    { type: 'singles', player1Name: 'Carolina Marín', organizationName: 'Spain National Team', genderP1: 'female' },
    { type: 'womens_doubles', player1Name: 'Yuki Fukushima', player2Name: 'Sayaka Hirota', organizationName: 'Japan National Team' },
    
    // Men's Singles
    { type: 'singles', player1Name: 'Kento Momota', organizationName: 'Japan National Team', genderP1: 'male' },
    { type: 'singles', player1Name: 'Viktor Axelsen', organizationName: 'Spain National Team', genderP1: 'male' },
    { type: 'singles', player1Name: 'Anthony Ginting', organizationName: 'Indonesia National Team', genderP1: 'male' },
    { type: 'singles', player1Name: 'Chou Tien-chen', organizationName: 'Legends Club', genderP1: 'male' },
    { type: 'singles', player1Name: 'Anders Antonsen', organizationName: 'Spain National Team', genderP1: 'male' },
    { type: 'singles', player1Name: 'Shi Yuqi', organizationName: 'Legends Club', genderP1: 'male' },
    { type: 'singles', player1Name: 'Lee Zii Jia', organizationName: 'Legends Club', genderP1: 'male' },
    { type: 'singles', player1Name: 'Jonatan Christie', organizationName: 'Indonesia National Team', genderP1: 'male' },
    { type: 'singles', player1Name: 'Rasmus Gemke', organizationName: 'Spain National Team', genderP1: 'male' },
    { type: 'singles', player1Name: 'Kanta Tsuneyama', organizationName: 'Japan National Team', genderP1: 'male' },
    { type: 'singles', player1Name: 'Lakshya Sen', organizationName: 'Legends Club', genderP1: 'male' },
    { type: 'singles', player1Name: 'Loh Kean Yew', organizationName: 'Legends Club', genderP1: 'male' },
    { type: 'singles', player1Name: 'Heo Kwang-hee', organizationName: 'Legends Club', genderP1: 'male' },
    { type: 'singles', player1Name: 'Lu Guangzu', organizationName: 'Legends Club', genderP1: 'male' },
    { type: 'singles', player1Name: 'Hans-Kristian Vittinghus', organizationName: 'Spain National Team', genderP1: 'male' },

    // Women's Singles
    { type: 'singles', player1Name: 'Tai Tzu-ying', organizationName: 'Legends Club', genderP1: 'female' },
    { type: 'singles', player1Name: 'Nozomi Okuhara', organizationName: 'Japan National Team', genderP1: 'female' },
    { type: 'singles', player1Name: 'P. V. Sindhu', organizationName: 'Legends Club', genderP1: 'female' },
    { type: 'singles', player1Name: 'Akane Yamaguchi', organizationName: 'Japan National Team', genderP1: 'female' },
    { type: 'singles', player1Name: 'Ratchanok Intanon', organizationName: 'Legends Club', genderP1: 'female' },
    { type: 'singles', player1Name: 'An Se-young', organizationName: 'Legends Club', genderP1: 'female' },
    { type: 'singles', player1Name: 'Michelle Li', organizationName: 'Spain National Team', genderP1: 'female' },
    { type: 'singles', player1Name: 'He Bingjiao', organizationName: 'Legends Club', genderP1: 'female' },
    { type: 'singles', player1Name: 'Busanan Ongbamrungphan', organizationName: 'Legends Club', genderP1: 'female' },
    { type: 'singles', player1Name: 'Sayaka Takahashi', organizationName: 'Japan National Team', genderP1: 'female' },
    { type: 'singles', player1Name: 'Kim Ga-eun', organizationName: 'Legends Club', genderP1: 'female' },
    { type: 'singles', player1Name: 'Gregoria Mariska Tunjung', organizationName: 'Indonesia National Team', genderP1: 'female' },
    { type: 'singles', player1Name: 'Mia Blichfeldt', organizationName: 'Spain National Team', genderP1: 'female' },
    { type: 'singles', player1Name: 'Wang Zhiyi', organizationName: 'Legends Club', genderP1: 'female' },
    { type: 'singles', player1Name: 'Saina Nehwal', organizationName: 'Legends Club', genderP1: 'female' },

    // Men's Doubles
    { type: 'mens_doubles', player1Name: 'Marcus Gideon', player2Name: 'Kevin Sanjaya', organizationName: 'Indonesia National Team' },
    { type: 'mens_doubles', player1Name: 'Hendra Setiawan', player2Name: 'Mohammad Ahsan', organizationName: 'Indonesia National Team' },
    { type: 'mens_doubles', player1Name: 'Takeshi Kamura', player2Name: 'Keigo Sonoda', organizationName: 'Japan National Team' },
    { type: 'mens_doubles', player1Name: 'Lee Yang', player2Name: 'Wang Chi-lin', organizationName: 'Legends Club' },
    { type: 'mens_doubles', player1Name: 'Hiroyuki Endo', player2Name: 'Yuta Watanabe', organizationName: 'Japan National Team' },
    { type: 'mens_doubles', player1Name: 'Fajar Alfian', player2Name: 'Muhammad Rian Ardianto', organizationName: 'Indonesia National Team' },
    { type: 'mens_doubles', player1Name: 'Satwiksairaj Rankireddy', player2Name: 'Chirag Shetty', organizationName: 'Legends Club' },
    { type: 'mens_doubles', player1Name: 'Kim Astrup', player2Name: 'Anders Skaarup Rasmussen', organizationName: 'Spain National Team' },
    { type: 'mens_doubles', player1Name: 'Aaron Chia', player2Name: 'Soh Wooi Yik', organizationName: 'Legends Club' },
    { type: 'mens_doubles', player1Name: 'Takuro Hoki', player2Name: 'Yugo Kobayashi', organizationName: 'Japan National Team' },
    { type: 'mens_doubles', player1Name: 'Vladimir Ivanov', player2Name: 'Ivan Sozonov', organizationName: 'Spain National Team' },
    { type: 'mens_doubles', player1Name: 'Ben Lane', player2Name: 'Sean Vendy', organizationName: 'Spain National Team' },
    { type: 'mens_doubles', player1Name: 'Mark Lamsfuß', player2Name: 'Marvin Seidel', organizationName: 'Spain National Team' },
    { type: 'mens_doubles', player1Name: 'Goh V Shem', player2Name: 'Tan Wee Kiong', organizationName: 'Legends Club' },
    { type: 'mens_doubles', player1Name: 'Choi Sol-gyu', player2Name: 'Seo Seung-jae', organizationName: 'Legends Club' },
    { type: 'mens_doubles', player1Name: 'Liu Yuchen', player2Name: 'Ou Xuanyi', organizationName: 'Legends Club' },
    { type: 'mens_doubles', player1Name: 'He Jiting', player2Name: 'Tan Qiang', organizationName: 'Legends Club' },
    { type: 'mens_doubles', player1Name: 'Leo Rolly Carnando', player2Name: 'Daniel Marthin', organizationName: 'Indonesia National Team' },
    { type: 'mens_doubles', player1Name: 'Muhammad Shohibul Fikri', player2Name: 'Bagas Maulana', organizationName: 'Indonesia National Team' },
    { type: 'mens_doubles', player1Name: 'Akira Koga', player2Name: 'Taichi Saito', organizationName: 'Japan National Team' },
    { type: 'mens_doubles', player1Name: 'Ong Yew Sin', player2Name: 'Teo Ee Yi', organizationName: 'Legends Club' },
    { type: 'mens_doubles', player1Name: 'Jeppe Bay', player2Name: 'Lasse Mølhede', organizationName: 'Spain National Team' },

    // Women's Doubles
    { type: 'womens_doubles', player1Name: 'Misaki Matsutomo', player2Name: 'Ayaka Takahashi', organizationName: 'Japan National Team' },
    { type: 'womens_doubles', player1Name: 'Greysia Polii', player2Name: 'Apriyani Rahayu', organizationName: 'Indonesia National Team' },
    { type: 'womens_doubles', player1Name: 'Mayu Matsumoto', player2Name: 'Wakana Nagahara', organizationName: 'Japan National Team' },
    { type: 'womens_doubles', player1Name: 'Kim So-yeong', player2Name: 'Kong Hee-yong', organizationName: 'Legends Club' },
    { type: 'womens_doubles', player1Name: 'Lee So-hee', player2Name: 'Shin Seung-chan', organizationName: 'Legends Club' },
    { type: 'womens_doubles', player1Name: 'Nami Matsuyama', player2Name: 'Chiharu Shida', organizationName: 'Japan National Team' },
    { type: 'womens_doubles', player1Name: 'Jongkolphan Kititharakul', player2Name: 'Rawinda Prajongjai', organizationName: 'Legends Club' },
    { type: 'womens_doubles', player1Name: 'Gabriela Stoeva', player2Name: 'Stefani Stoeva', organizationName: 'Spain National Team' },
    { type: 'womens_doubles', player1Name: 'Pearly Tan', player2Name: 'Thinaah Muralitharan', organizationName: 'Legends Club' },
    { type: 'womens_doubles', player1Name: 'Maiken Fruergaard', player2Name: 'Sara Thygesen', organizationName: 'Spain National Team' },
    { type: 'womens_doubles', player1Name: 'Chloe Birch', player2Name: 'Lauren Smith', organizationName: 'Spain National Team' },
    { type: 'womens_doubles', player1Name: 'Ashwini Ponnappa', player2Name: 'N. Sikki Reddy', organizationName: 'Legends Club' },
    { type: 'womens_doubles', player1Name: 'Siti Fadia Silva Ramadhanti', player2Name: 'Ribka Sugiarto', organizationName: 'Indonesia National Team' },
    { type: 'womens_doubles', player1Name: 'Rin Iwanaga', player2Name: 'Kie Nakanishi', organizationName: 'Japan National Team' },
    { type: 'womens_doubles', player1Name: 'Baek Ha-na', player2Name: 'Lee Yu-lim', organizationName: 'Legends Club' },
    { type: 'womens_doubles', player1Name: 'Jeong Na-eun', player2Name: 'Kim Hye-jeong', organizationName: 'Legends Club' },
    { type: 'womens_doubles', player1Name: 'Puttita Supajirakul', player2Name: 'Sapsiree Taerattanachai', organizationName: 'Legends Club' },
    { type: 'womens_doubles', player1Name: 'Liu Xuanxuan', player2Name: 'Xia Yuting', organizationName: 'Legends Club' },
    { type: 'womens_doubles', player1Name: 'Chen Qingchen', player2Name: 'Jia Yifan', organizationName: 'Legends Club' },
    { type: 'womens_doubles', player1Name: 'Du Yue', player2Name: 'Li Wenmei', organizationName: 'Legends Club' },

    // Mixed Doubles
    { type: 'mixed_doubles', player1Name: 'Zheng Siwei', player2Name: 'Huang Yaqiong', organizationName: 'Legends Club', genderP1: 'male', genderP2: 'female' },
    { type: 'mixed_doubles', player1Name: 'Dechapol Puavaranukroh', player2Name: 'Sapsiree Taerattanachai', organizationName: 'Legends Club', genderP1: 'male', genderP2: 'female' },
    { type: 'mixed_doubles', player1Name: 'Yuta Watanabe', player2Name: 'Arisa Higashino', organizationName: 'Japan National Team', genderP1: 'male', genderP2: 'female' },
    { type: 'mixed_doubles', player1Name: 'Praveen Jordan', player2Name: 'Melati Daeva Oktavianti', organizationName: 'Indonesia National Team', genderP1: 'male', genderP2: 'female' },
    { type: 'mixed_doubles', player1Name: 'Seo Seung-jae', player2Name: 'Chae Yoo-jung', organizationName: 'Legends Club', genderP1: 'male', genderP2: 'female' },
    { type: 'mixed_doubles', player1Name: 'Marcus Ellis', player2Name: 'Lauren Smith', organizationName: 'Spain National Team', genderP1: 'male', genderP2: 'female' },
    { type: 'mixed_doubles', player1Name: 'Tang Chun Man', player2Name: 'Tse Ying Suet', organizationName: 'Legends Club', genderP1: 'male', genderP2: 'female' },
    { type: 'mixed_doubles', player1Name: 'Chan Peng Soon', player2Name: 'Goh Liu Ying', organizationName: 'Legends Club', genderP1: 'male', genderP2: 'female' },
    { type: 'mixed_doubles', player1Name: 'Mark Lamsfuß', player2Name: 'Isabel Herttrich', organizationName: 'Spain National Team', genderP1: 'male', genderP2: 'female' },
    { type: 'mixed_doubles', player1Name: 'Thom Gicquel', player2Name: 'Delphine Delrue', organizationName: 'Spain National Team', genderP1: 'male', genderP2: 'female' },
    { type: 'mixed_doubles', player1Name: 'Robin Tabeling', player2Name: 'Selena Piek', organizationName: 'Spain National Team', genderP1: 'male', genderP2: 'female' },
    { type: 'mixed_doubles', player1Name: 'Mathias Christiansen', player2Name: 'Alexandra Bøje', organizationName: 'Spain National Team', genderP1: 'male', genderP2: 'female' },
    { type: 'mixed_doubles', player1Name: 'Rinov Rivaldy', player2Name: 'Pitha Haningtyas Mentari', organizationName: 'Indonesia National Team', genderP1: 'male', genderP2: 'female' },
    { type: 'mixed_doubles', player1Name: 'Hafiz Faizal', player2Name: 'Gloria Emanuelle Widjaja', organizationName: 'Indonesia National Team', genderP1: 'male', genderP2: 'female' },
    { type: 'mixed_doubles', player1Name: 'Yuki Kaneko', player2Name: 'Misaki Matsutomo', organizationName: 'Japan National Team', genderP1: 'male', genderP2: 'female' },
    { type: 'mixed_doubles', player1Name: 'Takuro Hoki', player2Name: 'Wakana Nagahara', organizationName: 'Japan National Team', genderP1: 'male', genderP2: 'female' },
    { type: 'mixed_doubles', player1Name: 'Kyohei Yamashita', player2Name: 'Naru Shinoya', organizationName: 'Japan National Team', genderP1: 'male', genderP2: 'female' }
];
