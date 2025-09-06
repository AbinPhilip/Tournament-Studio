
'use server';

import { db } from '@/lib/firebase';
import { collection, writeBatch, getDocs } from 'firebase/firestore';
import { mockUsers, mockOrganizations, mockTeams } from '@/lib/mock-data';
import { revalidatePath } from 'next/cache';

export async function seedDatabase() {
    try {
        const batch = writeBatch(db);
        
        // Define collections to clear
        const collectionsToDelete = ['users', 'organizations', 'teams', 'matches', 'tournaments', 'sponsors', 'images'];
        
        // Clear existing data
        for (const collectionName of collectionsToDelete) {
            const snapshot = await getDocs(collection(db, collectionName));
            snapshot.forEach(doc => batch.delete(doc.ref));
        }

        // Add Organizations
        const orgRefs: Record<string, string> = {};
        for (const org of mockOrganizations) {
            const orgRef = collection(db, 'organizations').doc();
            batch.set(orgRef, org);
            orgRefs[org.name] = orgRef.id;
        }
        
        // Add Users
        mockUsers.forEach(user => {
            const userRef = collection(db, 'users').doc();
            batch.set(userRef, user);
        });

        // Add Teams
        mockTeams.forEach(team => {
            const teamRef = collection(db, 'teams').doc();
            const { organizationName, ...teamData } = team;
            if (orgRefs[organizationName]) {
                 batch.set(teamRef, { ...teamData, organizationId: orgRefs[organizationName] });
            } else {
                console.warn(`Organization "${organizationName}" not found for team "${team.player1Name}". Skipping team.`);
            }
        });

        await batch.commit();
        revalidatePath('/login');
        return { success: true, message: 'Database has been reset with mock data.' };

    } catch (error) {
        console.error('Seeding failed:', error);
        return { success: false, message: 'Could not seed the database.' };
    }
}
