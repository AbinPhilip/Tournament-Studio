
"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LoadingShuttlecock } from '@/components/ui/loading-shuttlecock';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isDbSeeded, setIsDbSeeded] = useState<boolean | null>(null);
  
  useEffect(() => {
    async function checkDb() {
      try {
        const usersQuery = query(collection(db, 'users'), limit(1));
        const usersSnap = await getDocs(usersQuery);
        setIsDbSeeded(!usersSnap.empty);
      } catch (error) {
        console.error("Error checking database:", error);
        // Assume not seeded on error to allow manual seeding
        setIsDbSeeded(false); 
      }
    }
    checkDb();
  }, []);

  useEffect(() => {
    // Wait until both auth and db check are complete
    if (authLoading || isDbSeeded === null) return;
    
    if (!isDbSeeded) {
      router.replace('/dashboard/settings');
      return;
    }

    if (user) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }

  }, [router, authLoading, user, isDbSeeded]);
  
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <div className="animate-spin h-16 w-16 border-4 border-primary border-t-transparent rounded-full" />
      <p className="mt-4 text-muted-foreground">Loading your experience...</p>
    </div>
  );
}
