
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
    const checkDatabase = async () => {
      try {
        const usersCollectionRef = collection(db, 'users');
        const q = query(usersCollectionRef, limit(1));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          router.replace('/dashboard/seed-database');
        } else {
          // If DB is not empty, proceed with normal auth flow
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
        // Fallback to login on error
        router.replace('/login');
      } finally {
        setIsCheckingDb(false);
      }
    };

    checkDatabase();
  }, [user, authLoading, router]);

  if (authLoading || isCheckingDb) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading your experience...</p>
      </div>
    );
  }

  return null;
}
