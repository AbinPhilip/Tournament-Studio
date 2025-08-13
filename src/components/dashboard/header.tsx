import { Logo } from '@/components/logo';
import { UserNav } from '@/components/dashboard/user-nav';
import type { User } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '../ui/button';
import { ChevronDown, Cog, ListOrdered, Settings, Shield } from 'lucide-react';

export function DashboardHeader({ user }: { user: User | null }) {

  const MainNav = (
    <nav className="hidden md:flex items-center space-x-2 lg:space-x-4">
      <a href="/dashboard" className="text-sm font-medium transition-colors hover:text-primary">Dashboard</a>
        
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="text-sm font-medium text-muted-foreground">
                Tournament <ChevronDown className="relative top-[1px] ml-1 h-3 w-3" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
            <DropdownMenuItem onClick={() => window.location.href='/dashboard/scheduler'}>
                <ListOrdered className="mr-2 h-4 w-4" />
                <span>Scheduler</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.location.href='/dashboard/umpire'}>
                <Shield className="mr-2 h-4 w-4" />
                <span>Umpire View</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="text-sm font-medium text-muted-foreground">
                Settings <ChevronDown className="relative top-[1px] ml-1 h-3 w-3" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
             <DropdownMenuItem onClick={() => window.location.href='/dashboard/tournament'}>
                <Cog className="mr-2 h-4 w-4" />
                <span>Tournament Admin</span>
            </DropdownMenuItem>
             <DropdownMenuItem onClick={() => window.location.href='/dashboard/settings'}>
                <Settings className="mr-2 h-4 w-4" />
                <span>System Settings</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
