
'use server';

import { db } from '@/lib/firebase';
import { collection, writeBatch, getDocs, doc } from 'firebase/firestore';
import { mockUsers, mockOrganizations, mockTeams } from '@/lib/mock-data';
import { revalidatePath } from 'next/cache';
import type { Sponsor, Tournament } from '@/types';

export async function seedDatabase() {
    try {
        // 1. Preserve existing logos
        let tournamentLogoUrl: string | undefined;
        const tourneySnap = await getDocs(collection(db, 'tournaments'));
        if (!tourneySnap.empty) {
            tournamentLogoUrl = (tourneySnap.docs[0].data() as Tournament).logoUrl;
        }

        const sponsorsWithLogos: { name: string; logoUrl?: string }[] = [];
        const sponsorsSnap = await getDocs(collection(db, 'sponsors'));
        sponsorsSnap.forEach(doc => {
            const sponsor = doc.data() as Sponsor;
            if (sponsor.logoUrl) {
                sponsorsWithLogos.push({ name: sponsor.name, logoUrl: sponsor.logoUrl });
            }
        });

        const batch = writeBatch(db);
        
        // 2. Define collections to clear
        const collectionsToDelete = ['users', 'organizations', 'teams', 'matches', 'tournaments', 'sponsors', 'images', 'registrations'];
        
        // Clear existing data
        for (const collectionName of collectionsToDelete) {
            const snapshot = await getDocs(collection(db, collectionName));
            snapshot.forEach(doc => batch.delete(doc.ref));
        }
        
        await batch.commit(); // Commit deletions first

        // Start a new batch for additions
        const addBatch = writeBatch(db);

        // 3. Add Organizations
        const orgRefs: Record<string, string> = {};
        for (const org of mockOrganizations) {
            const orgRef = doc(collection(db, 'organizations'));
            addBatch.set(orgRef, org);
            orgRefs[org.name] = orgRef.id;
        }
        
        // 4. Add Users
        mockUsers.forEach(user => {
            const userRef = doc(collection(db, 'users'));
            addBatch.set(userRef, user);
        });

        // 5. Add Teams
        mockTeams.forEach(team => {
            const teamRef = doc(collection(db, 'teams'));
            const { organizationName, ...teamData } = team;
            if (orgRefs[organizationName]) {
                 addBatch.set(teamRef, { ...teamData, organizationId: orgRefs[organizationName] });
            } else {
                console.warn(`Organization "${organizationName}" not found for team "${team.player1Name}". Skipping team.`);
            }
        });
        
        // 6. Restore logos
        if (tournamentLogoUrl) {
            const newTourneyQuery = await getDocs(collection(db, 'tournaments'));
            if (!newTourneyQuery.empty) {
                const newTourneyRef = newTourneyQuery.docs[0].ref;
                addBatch.update(newTourneyRef, { logoUrl: tournamentLogoUrl });
            }
        }
        
        if (sponsorsWithLogos.length > 0) {
            for (const sponsorLogoInfo of sponsorsWithLogos) {
                 const newSponsorQuery = await getDocs(collection(db, 'sponsors'));
                 const newSponsorDoc = newSponsorQuery.docs.find(d => d.data().name === sponsorLogoInfo.name);
                 if (newSponsorDoc) {
                    addBatch.update(newSponsorDoc.ref, { logoUrl: sponsorLogoInfo.logoUrl });
                 }
            }
        }

        await addBatch.commit();
        revalidatePath('/login');
        return { success: true, message: 'Database has been reset with mock data.' };

    } catch (error) {
        console.error('Seeding failed:', error);
        return { success: false, message: 'Could not seed the database.' };
    }
}
