
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, writeBatch, doc, DocumentReference, collectionGroup, query, WriteBatch } from 'firebase/firestore';
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
        // 1. Check if any data exists to prevent re-seeding
        const allCollectionsQuery = query(collectionGroup(db, 'users')); // Check one collection is enough
        const snapshot = await getDocs(allCollectionsQuery);
        if (!snapshot.empty) {
            toast({
                title: 'Database Not Empty',
                description: 'Your database already contains data. Seeding was skipped.',
                variant: 'default',
                duration: 5000,
            });
            setIsLoading(false);
            return;
        }

        // 2. Prepare all data for a single batch write
        const batch = writeBatch(db);

        // Add Users
        const usersCollectionRef = collection(db, 'users');
        mockUsers.forEach(user => {
            const docRef = doc(usersCollectionRef);
            batch.set(docRef, user);
        });

        // Add AppData
        const appDataCollectionRef = collection(db, 'appData');
        mockAppData.forEach(data => {
            const docRef = doc(appDataCollectionRef);
            batch.set(docRef, data);
        });

        // Add Organizations and prepare for teams
        const orgsCollectionRef = collection(db, 'organizations');
        const orgNameIdMap: { [key: string]: string } = {};
        mockOrganizations.forEach(org => {
            const docRef = doc(orgsCollectionRef);
            batch.set(docRef, org);
            orgNameIdMap[org.name] = docRef.id;
        });
        
        // Add Teams with correct organization IDs
        const teamsCollectionRef = collection(db, 'teams');
        mockTeams.forEach(team => {
            const orgId = orgNameIdMap[team.organizationName];
            if (orgId) {
                const docRef = doc(teamsCollectionRef);
                const { organizationName, ...teamData } = team;
                batch.set(docRef, { ...teamData, organizationId: orgId });
            }
        });

        // 3. Commit the single batch
        await batch.commit();

        toast({
            title: 'Database Seeded!',
            description: 'Your database has been populated with mock data.',
            duration: 5000,
        });

    } catch (error) {
        console.error("Seeding failed:", error);
        toast({
            title: 'Seeding Failed',
            description: 'An error occurred while seeding the database.',
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
            Populate your Firestore database with the initial mock data. This will allow you to
            use the application with a predefined set of users, teams, and other information.
            This action should only be performed once.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button onClick={handleSeed} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Seed Database
          </Button>
          <Button onClick={() => router.push('/login')} variant="outline">
            Go to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
