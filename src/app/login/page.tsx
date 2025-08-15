
"use client";

import { useRouter } from 'next/navigation';
import { Logo } from '@/components/logo';
import { LoginForm } from '@/components/login-form';
import { CourtUmpireLogin } from '@/components/court-umpire-login';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MonitorPlay, ShieldCheck, UserCog } from 'lucide-react';
import Link from 'next/link';


export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <Logo />
        <h1 className="text-3xl font-bold">Tournament Manager</h1>
        <p className="text-muted-foreground">Please select your access point.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">

        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex justify-center mb-4">
                <div className="p-4 bg-primary/10 rounded-full">
                    <MonitorPlay className="h-8 w-8 text-primary"/>
                </div>
            </div>
            <CardTitle className="text-center">Presenter View</CardTitle>
            <CardDescription className="text-center">
              Display live scores and tournament info on a public screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col justify-end">
            <Link href="/presenter" target="_blank" passHref>
                <Button className="w-full" variant="outline">Open Presenter View</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
             <div className="flex justify-center mb-4">
                <div className="p-4 bg-secondary/10 rounded-full">
                    <ShieldCheck className="h-8 w-8 text-secondary"/>
                </div>
            </div>
            <CardTitle className="text-center">Court Umpire</CardTitle>
            <CardDescription className="text-center">
              Access the live scoring interface for an assigned court.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col justify-end">
            <CourtUmpireLogin />
          </CardContent>
        </Card>

        <Card className="flex flex-col" >
          <CardHeader>
             <div className="flex justify-center mb-4">
                <div className="p-4 bg-primary/10 rounded-full">
                    <UserCog className="h-8 w-8 text-primary"/>
                </div>
            </div>
            <CardTitle className="text-center">Admin & Staff</CardTitle>
            <CardDescription className="text-center">
              Log in to manage the tournament, teams, and settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
       <footer className="mt-8 text-sm text-muted-foreground">
        Powered by Battledore
      </footer>
    </div>
  );
}
