
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, writeBatch, doc, DocumentReference } from 'firebase/firestore';
import { mockUsers, mockAppData, mockOrganizations, mockTeams } from '@/lib/mock-data';
import type { Organization, Team } from '@/types';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SeedDatabasePage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // This function now returns the created doc references if needed.
  const seedCollection = async <T extends {}>(collectionName: string, data: T[]): Promise<DocumentReference[] | null> => {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    if (!snapshot.empty) {
      toast({ title: 'Info', description: `Collection "${collectionName}" is not empty, skipping seed.` });
      return null;
    }

    const batch = writeBatch(db);
    const newDocRefs: DocumentReference[] = [];
    data.forEach((item) => {
      const newDocRef = doc(collectionRef);
      newDocRefs.push(newDocRef);
      batch.set(newDocRef, item);
    });
    await batch.commit();
    toast({ title: 'Success', description: `Collection "${collectionName}" seeded.` });
    return newDocRefs;
  };
  
  const seedTeams = async (orgs: Organization[]) => {
      const teamsCollectionRef = collection(db, 'teams');
      const teamsSnapshot = await getDocs(teamsCollectionRef);
      if (!teamsSnapshot.empty) {
          toast({ title: 'Info', description: `Collection "teams" is not empty, skipping seed.`});
          return;
      }
      
      const orgNameIdMap = orgs.reduce((acc, org) => {
          acc[org.name] = org.id;
          return acc;
      }, {} as { [key: string]: string });
      
      const teamsToSeed = mockTeams.map(team => {
        // Find the full mock organization object to get its name
        const mockOrg = mockOrganizations.find(o => o.name === team.organizationName);
        if (!mockOrg) return null; // Should not happen with current data

        // Use the mock organization's name to find its real Firestore ID
        const orgId = orgNameIdMap[mockOrg.name];
        if (!orgId) return null; // Org not found in the seeded orgs

        return {
            ...team,
            organizationId: orgId,
            organizationName: undefined, // Remove the temporary name field
        };
      }).filter((t): t is Omit<Team, 'id'> => t !== null);

      const batch = writeBatch(db);
      teamsToSeed.forEach((item) => {
          const docRef = doc(teamsCollectionRef);
          batch.set(docRef, item);
      });
      await batch.commit();
      toast({ title: 'Success', description: `Collection "teams" seeded.`});
  }

  const handleSeed = async () => {
    setIsLoading(true);
    try {
      await seedCollection('users', mockUsers);
      await seedCollection('appData', mockAppData);
      
      // Seed organizations and wait for it to complete
      await seedCollection('organizations', mockOrganizations);

      // Now fetch the newly created organizations to get their IDs
      const orgsSnapshot = await getDocs(collection(db, 'organizations'));
      const orgs = orgsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));
      
      if (orgs.length > 0) {
        // Pass the organizations with their new IDs to the team seeder
        await seedTeams(orgs);
      } else {
        toast({ title: 'Info', description: 'Skipping team seeding because organizations were already present.' });
      }

      toast({
        title: 'Database Seeded!',
        description: 'You can now log in using the credentials provided.',
        duration: 5000,
      });
    } catch (error) {
      console.error(error);
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
