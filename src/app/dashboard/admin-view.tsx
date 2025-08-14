
"use client";

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ListOrdered, Cog, Shield, Settings, Users, Building, Trophy } from 'lucide-react';

export default function AdminView() {
  const { user } = useAuth();
  const router = useRouter();

  const navItems = [
    { label: "Tournament Setup", href: "/dashboard/tournament", icon: Cog },
    { label: "Organizations", href: "/dashboard/organizations", icon: Building },
    { label: "Teams", href: "/dashboard/teams", icon: Users },
    { label: "Scheduler", href: "/dashboard/scheduler", icon: ListOrdered },
    { label: "Umpire View", href: "/dashboard/umpire", icon: Shield },
    { label: "Match History", href: "/dashboard/match-history", icon: Trophy },
  ];

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Administrator Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {user?.name}. Manage the tournament and system settings.</p>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Tournament Management</CardTitle>
            <CardDescription>Configure, schedule, and manage all aspects of the tournament.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {navItems.map((item) => (
                <Button key={item.href} variant="outline" onClick={() => router.push(item.href)} className="justify-start text-left">
                    <item.icon className="mr-2"/> {item.label}
                </Button>
            ))}
        </CardContent>
      </Card>
      
      <Card>
          <CardHeader>
            <CardTitle>System Management</CardTitle>
            <CardDescription>Manage application-wide settings, including users, permissions, and the database.</CardDescription>
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
