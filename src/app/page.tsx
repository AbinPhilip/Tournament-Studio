
"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    // We wait until the auth state is resolved before redirecting.
    if (!authLoading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [router, authLoading, user]);
  
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Loading your experience...</p>
    </div>
  );
}
