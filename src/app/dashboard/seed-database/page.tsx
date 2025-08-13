
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, writeBatch, doc } from 'firebase/firestore';
import { mockUsers, mockAppData, mockOrganizations, mockTeams } from '@/lib/mock-data';
import { Loader2 } from 'lucide-react';
import type { Organization, Team } from '@/types';
import { useRouter } from 'next/navigation';

export default function SeedDatabasePage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const seedCollection = async (collectionName: string, data: any[]) => {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    if (!snapshot.empty) {
        toast({ title: 'Info', description: `Collection "${collectionName}" is not empty, skipping seed.`});
        return;
    }

    const batch = writeBatch(db);
    data.forEach((item) => {
        const newDocRef = doc(collectionRef);
        batch.set(newDocRef, item);
    });
    await batch.commit();
    toast({ title: 'Success', description: `Collection "${collectionName}" seeded.`});
  };

  const seedTeamsWithOrgIds = async () => {
    const teamsCollectionRef = collection(db, 'teams');
    const teamsSnapshot = await getDocs(teamsCollectionRef);
    if (!teamsSnapshot.empty) {
        toast({ title: 'Info', description: `Collection "teams" is not empty, skipping seed.`});
        return;
    }

    const orgsCollectionRef = collection(db, 'organizations');
    const orgsSnapshot = await getDocs(orgsCollectionRef);
    const orgs = orgsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));
    
    if(orgs.length === 0) {
        toast({ title: 'Error', description: 'Organizations must be seeded before teams.', variant: 'destructive' });
        return;
    }
    
    const orgIdMap: { [key: string]: string } = {};
    mockOrganizations.forEach((mockOrg, index) => {
        const foundOrg = orgs.find(o => o.name === mockOrg.name);
        if(foundOrg) {
            orgIdMap[(index + 1).toString()] = foundOrg.id;
        }
    });

    const teamsToSeed = mockTeams.map(team => ({
        ...team,
        organizationId: orgIdMap[team.organizationId] || ''
    })).filter(team => team.organizationId);

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
        await seedCollection('organizations', mockOrganizations);
        await seedTeamsWithOrgIds();
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
