
"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DashboardHeader } from '@/components/dashboard/header';
import { Loader2 } from 'lucide-react';
import { MainNav } from '@/components/dashboard/main-nav';

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
  
  // Ensure that only authorized roles can see this layout
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
      <div className="flex flex-1">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-background lg:flex">
            <MainNav user={user} />
        </aside>
        <main className="flex-1 p-4 pt-20 md:p-8 lg:ml-64">{children}</main>
      </div>
    </div>
  );
}
