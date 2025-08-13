
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, writeBatch, doc, DocumentReference, query, limit } from 'firebase/firestore';
import { mockUsers, mockAppData, mockOrganizations, mockTeams } from '@/lib/mock-data';
import type { Organization, Team } from '@/types';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SeedDatabasePage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSeed = async () => {
    setIsLoading(true);
    try {
        const batch = writeBatch(db);

        // 1. Clear existing data
        const collectionsToClear = ['users', 'organizations', 'teams', 'appData', 'matches'];
        for (const coll of collectionsToClear) {
            const querySnapshot = await getDocs(collection(db, coll));
            querySnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
        }
        await batch.commit(); // Commit deletions first

        // 2. Start a new batch for seeding
        const seedBatch = writeBatch(db);

        // Add Organizations and get their new document IDs
        const orgsCollectionRef = collection(db, 'organizations');
        const orgNameIdMap: { [key: string]: string } = {};

        for (const org of mockOrganizations) {
          const docRef = doc(orgsCollectionRef); // Create a new doc with a generated ID
          seedBatch.set(docRef, org);
          orgNameIdMap[org.name] = docRef.id;
        }
        
        // Add Teams with correct organization IDs from the map
        const teamsCollectionRef = collection(db, 'teams');
        mockTeams.forEach(team => {
            const orgId = orgNameIdMap[team.organizationName];
            if (orgId) {
                const docRef = doc(teamsCollectionRef);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { organizationName, ...teamData } = team;
                seedBatch.set(docRef, { ...teamData, organizationId: orgId });
            } else {
              console.warn(`Could not find organization ID for team associated with: ${team.organizationName}`);
            }
        });

        // Add Users
        const usersCollectionRef = collection(db, 'users');
        mockUsers.forEach(user => {
            const docRef = doc(usersCollectionRef);
            seedBatch.set(docRef, user);
        });

        // Add AppData
        const appDataCollectionRef = collection(db, 'appData');
        mockAppData.forEach(data => {
            const docRef = doc(appDataCollectionRef);
            seedBatch.set(docRef, data);
        });

        // 3. Commit the single batch
        await seedBatch.commit();

        toast({
            title: 'Database Reset!',
            description: 'Your database has been cleared and re-seeded with mock data.',
            duration: 5000,
        });

    } catch (error) {
        console.error("Seeding failed:", error);
        toast({
            title: 'Seeding Failed',
            description: 'An error occurred while clearing or seeding the database. Check console for details.',
            variant: 'destructive',
        });
    } finally {
        setIsLoading(false);
    }
};


  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Seed Database</CardTitle>
          <CardDescription>
            This will first clear all current data (users, teams, matches, etc.) and then populate your Firestore database with the initial mock data. This is useful for resetting the application to a clean state.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button onClick={handleSeed} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Clear and Reseed Database
          </Button>
          <Button onClick={() => router.push('/login')} variant="outline">
            Go to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
