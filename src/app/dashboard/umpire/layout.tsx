
"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DashboardHeader } from '@/components/dashboard/header';
import { Loader2 } from 'lucide-react';

export default function UmpireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
       if (!user) {
          router.replace('/login');
       } else if (user.role !== 'update' && user.role !== 'admin' && user.role !== 'super') {
          // Redirect if user is not an umpire/admin/super
          router.replace('/dashboard');
       }
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (user.role !== 'update' && user.role !== 'admin' && user.role !== 'super') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <p>Access Denied. You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <DashboardHeader user={user} />
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
