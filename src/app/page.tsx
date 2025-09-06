
"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingShuttlecock } from '@/components/ui/loading-shuttlecock';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    // Wait until auth is complete
    if (authLoading) return;
    
    if (user) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }

  }, [router, authLoading, user]);
  
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <div className="animate-spin h-16 w-16 border-4 border-primary border-t-transparent rounded-full" />
      <p className="mt-4 text-muted-foreground">Loading your experience...</p>
    </div>
  );
}
