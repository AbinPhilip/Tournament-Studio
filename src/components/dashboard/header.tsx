
"use client";

import Link from "next/link";
import { Logo } from '@/components/logo';
import { UserNav } from '@/components/dashboard/user-nav';
import type { User } from '@/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { MainNav } from "./main-nav";
import { cn } from "@/lib/utils";

export function DashboardHeader({ user, onToggleCollapse, isCollapsed }: { user: User | null, onToggleCollapse: () => void, isCollapsed: boolean }) {

  return (
    <header className={cn("sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm", )}>
      <div className={cn("flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0 transition-all duration-300", isCollapsed ? "pl-4 lg:pl-24" : "pl-4 lg:pl-4")}>
         <div className="lg:hidden">
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left">
                    <SheetHeader>
                        <SheetTitle className="sr-only">Main Menu</SheetTitle>
                    </SheetHeader>
                    <Link href="/dashboard" className="mb-6 flex">
                        <Logo />
                    </Link>
                    <MainNav user={user} isMobile={true} />
                </SheetContent>
            </Sheet>
         </div>

        <div className="hidden lg:flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="hidden lg:flex">
              {isCollapsed ? <PanelLeftClose /> : <PanelLeftOpen />}
              <span className="sr-only">Toggle Sidebar</span>
            </Button>
             <Link href="/dashboard" className={cn(isCollapsed && 'hidden')}>
                <Logo />
            </Link>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-4 pr-4">
          <UserNav />
        </div>
      </div>
    </header>
  );
}
