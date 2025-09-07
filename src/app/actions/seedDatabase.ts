
'use server';

import { db } from '@/lib/firebase';
import { collection, writeBatch, getDocs, doc, query } from 'firebase/firestore';
import { mockUsers, mockOrganizations, mockTeams } from '@/lib/mock-data';
import { revalidatePath } from 'next/cache';
import type { Sponsor, Tournament } from '@/types';

export async function seedDatabase() {
    try {
        // 1. Preserve existing logos
        let tournamentLogoUrl: string | undefined;
        const tourneyQuery = query(collection(db, 'tournaments'));
        const tourneySnap = await getDocs(tourneyQuery);
        if (!tourneySnap.empty) {
            tournamentLogoUrl = (tourneySnap.docs[0].data() as Tournament).logoUrl;
        }

        const sponsorsWithLogos: { name: string; logoUrl?: string }[] = [];
        const sponsorsQuery = query(collection(db, 'sponsors'));
        const sponsorsSnap = await getDocs(sponsorsQuery);
        sponsorsSnap.forEach(doc => {
            const sponsor = doc.data() as Sponsor;
            if (sponsor.logoUrl) {
                sponsorsWithLogos.push({ name: sponsor.name, logoUrl: sponsor.logoUrl });
            }
        });

        const batch = writeBatch(db);
        
        // 2. Define collections to clear
        const collectionsToDelete = ['users', 'organizations', 'teams', 'matches', 'tournaments', 'sponsors', 'images', 'registrations'];
        
        for (const collectionName of collectionsToDelete) {
            const snapshot = await getDocs(collection(db, collectionName));
            snapshot.forEach(doc => batch.delete(doc.ref));
        }
        
        await batch.commit();

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

        await addBatch.commit();
        
        // 6. Restore logos in a separate batch
        const logoBatch = writeBatch(db);
        
        if (tournamentLogoUrl) {
            const newTourneyQuery = query(collection(db, 'tournaments'));
            const newTourneySnap = await getDocs(newTourneyQuery);
            if (!newTourneySnap.empty) {
                const newTourneyRef = newTourneySnap.docs[0].ref;
                logoBatch.update(newTourneyRef, { logoUrl: tournamentLogoUrl });
            }
        }
        
        for (const sponsorLogoInfo of sponsorsWithLogos) {
            const newSponsorQuery = query(collection(db, 'sponsors'), where('name', '==', sponsorLogoInfo.name));
            const newSponsorSnap = await getDocs(newSponsorQuery);
             if (!newSponsorSnap.empty) {
                const newSponsorDocRef = newSponsorSnap.docs[0].ref;
                logoBatch.update(newSponsorDocRef, { logoUrl: sponsorLogoInfo.logoUrl });
             }
        }

        await logoBatch.commit();
        revalidatePath('/login', 'layout');
        return { success: true, message: 'Database has been reset with mock data.' };

    } catch (error) {
        console.error('Seeding failed:', error);
        return { success: false, message: 'Could not seed the database.' };
    }
}
