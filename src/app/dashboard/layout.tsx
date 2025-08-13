"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { DashboardHeader } from '@/components/dashboard/header';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Allow access to the seed page without authentication
    if (pathname === '/dashboard/seed-database') {
      return;
    }

    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router, pathname]);

  // For the seed page, don't show a loader if auth is loading, just show the page
  if (pathname !== '/dashboard/seed-database' && (loading || !user)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <DashboardHeader />
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
