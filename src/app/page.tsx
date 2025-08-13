
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
  const [dbIsEmpty, setDbIsEmpty] = useState(false);

  useEffect(() => {
    const checkDatabase = async () => {
      setIsCheckingDb(true);
      try {
        const usersCollectionRef = collection(db, 'users');
        const q = query(usersCollectionRef, limit(1));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          setDbIsEmpty(true);
          router.replace('/dashboard/seed-database');
        } else {
           setDbIsEmpty(false);
        }
      } catch (error) {
        console.error("Failed to check database:", error);
        // Fallback to login on error, assuming DB might exist but is inaccessible
        setDbIsEmpty(false);
      } finally {
        setIsCheckingDb(false);
      }
    };

    checkDatabase();
  }, [router]);
  
  useEffect(() => {
    // This effect handles redirection after the DB check and auth state are known.
    if (!isCheckingDb && !dbIsEmpty && !authLoading) {
        if (user) {
            router.replace('/dashboard');
        } else {
            router.replace('/login');
        }
    }
  }, [user, authLoading, isCheckingDb, dbIsEmpty, router]);

  // Show a loader while we determine where to go.
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Loading your experience...</p>
    </div>
  );
}
