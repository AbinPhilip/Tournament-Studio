
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
  
  useEffect(() => {
    const checkDatabaseAndRedirect = async () => {
      try {
        const usersCollectionRef = collection(db, 'users');
        const q = query(usersCollectionRef, limit(1));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          // If DB is empty, go straight to seeding, no auth check needed.
          router.replace('/dashboard/seed-database');
          return;
        }
      } catch (error) {
        console.error("Failed to check database:", error);
        // Fallback to login on error
        router.replace('/login');
        return;
      }

      // This part only runs if the database is NOT empty.
      if (!authLoading) {
        if (user) {
          router.replace('/dashboard');
        } else {
          router.replace('/login');
        }
      }
    };

    checkDatabaseAndRedirect();
  }, [router, authLoading, user]);
  
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Loading your experience...</p>
    </div>
  );
}
