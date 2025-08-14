
"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { DashboardHeader } from '@/components/dashboard/header';
import { Loader2 } from 'lucide-react';
import { MainNav } from '@/components/dashboard/main-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPage = pathname === '/dashboard/seed-database';

  useEffect(() => {
    if (!loading && !user && !isPublicPage) {
      router.replace('/login');
    }
  }, [user, loading, router, isPublicPage]);

  if (loading && !isPublicPage) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (isPublicPage) {
    return <>{children}</>;
  }
  
  if (!user) {
     return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  const isAdmin = user.role === 'admin' || user.role === 'super';

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <DashboardHeader user={user} />
      <div className="flex flex-1">
        <MainNav user={user} />
        <main className={`flex-1 p-4 md:p-8 ${isAdmin ? 'lg:ml-64' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
