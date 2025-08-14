
"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DashboardHeader } from '@/components/dashboard/header';
import { Loader2 } from 'lucide-react';
import { MainNav } from '@/components/dashboard/main-nav';
import { CollapsibleButton } from '@/components/ui/collapsible-button';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);


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

  const isCourtUmpire = user.role === 'court';

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <DashboardHeader user={user} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} isCollapsed={isCollapsed} />
      <div className="flex flex-1">
        {!isCourtUmpire && (
          <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-background transition-all duration-300 lg:flex ${isCollapsed ? 'w-20' : 'w-64'}`}>
            <div className="flex-1">
              <MainNav user={user} isCollapsed={isCollapsed} />
            </div>
            <div className="mt-auto p-4">
              <CollapsibleButton isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
            </div>
          </aside>
        )}
        <main className={`flex-1 p-4 pt-20 md:p-8 transition-all duration-300 ${!isCourtUmpire ? (isCollapsed ? 'lg:ml-20' : 'lg:ml-64') : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
