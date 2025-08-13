
"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isCheckingDb, setIsCheckingDb] = useState(true);
  
  useEffect(() => {
    const checkDatabaseAndRedirect = async () => {
      try {
        const usersCollectionRef = collection(db, 'users');
        const q = query(usersCollectionRef, limit(1));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          // If DB is empty, go straight to seeding, no auth check needed.
          router.replace('/dashboard/seed-database');
        } else {
          // If DB has data, now we check auth state.
          // This part of the logic runs only when the DB is NOT empty.
          if (!authLoading) {
            if (user) {
              router.replace('/dashboard');
            } else {
              router.replace('/login');
            }
          }
        }
      } catch (error) {
        console.error("Failed to check database:", error);
        // On error, the safest bet is to go to login.
        if (!authLoading) {
            router.replace('/login');
        }
      } finally {
        // The loading state should only be turned off after a decision is made.
        // In the case of a populated DB, the second effect will handle it.
        // We set it to false here for the empty DB case.
        setIsCheckingDb(false);
      }
    };

    // We only run this check once on mount.
    // The second useEffect will handle re-routing if auth state changes later.
    if(isCheckingDb) {
        checkDatabaseAndRedirect();
    }
  }, [router, authLoading, user, isCheckingDb]);
  
  // This loader will be shown until one of the redirects happen.
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Loading your experience...</p>
    </div>
  );
}
