
"use client";

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ListOrdered, Cog, Shield, Settings } from 'lucide-react';

export default function AdminView() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Administrator Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {user?.name}. Manage users, teams, and system settings.</p>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Tournament Actions</CardTitle>
            <CardDescription>Configure, schedule, and manage the tournament.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" onClick={() => router.push('/dashboard/tournament')}>
                <Cog className="mr-2"/> Configure Tournament
            </Button>
            <Button variant="outline" onClick={() => router.push('/dashboard/scheduler')}>
                <ListOrdered className="mr-2"/> Go to Scheduler
            </Button>
            <Button variant="outline" onClick={() => router.push('/dashboard/umpire')}>
                <Shield className="mr-2"/> Go to Umpire View
            </Button>
        </CardContent>
      </Card>
      
      <Card>
          <CardHeader>
            <CardTitle>System Management</CardTitle>
            <CardDescription>Manage application-wide settings, including users, teams, and organizations.</CardDescription>
          </CardHeader>
          <CardContent>
             <Button onClick={() => router.push('/dashboard/settings')}>
                <Settings className="mr-2" />
                System Settings
            </Button>
          </CardContent>
        </Card>
    </div>
  );
}
