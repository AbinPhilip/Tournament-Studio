import { Logo } from '@/components/logo';
import { UserNav } from '@/components/dashboard/user-nav';
import type { User } from '@/types';

export function DashboardHeader({ user }: { user: User | null }) {
  // We will conditionally render the MainNav in the layout based on role.
  // For now, the header can remain simple.
  const MainNav = (
    <nav className="hidden md:flex items-center space-x-4 lg:space-x-6">
      <a href="/dashboard" className="text-sm font-medium transition-colors hover:text-primary">Dashboard</a>
      <a href="/dashboard/tournament" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Tournament</a>
      <a href="/dashboard/scheduler" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Scheduler</a>
      <a href="/dashboard/umpire" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Umpire</a>
    </nav>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <Logo />
        <div className="flex-1 ml-6">
           {user && (user.role === 'admin' || user.role === 'super') && MainNav}
        </div>
        <div className="flex items-center justify-end space-x-4">
          <UserNav />
        </div>
      </div>
    </header>
  );
}
