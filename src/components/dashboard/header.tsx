
"use client";

import Link from "next/link";
import { Logo } from '@/components/logo';
import { UserNav } from '@/components/dashboard/user-nav';
import type { User } from '@/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, PanelLeftClose, PanelRightClose } from "lucide-react";
import { MainNav } from "./main-nav";
import { cn } from "@/lib/utils";

export function DashboardHeader({ user, onToggleCollapse, isCollapsed }: { user: User | null, onToggleCollapse: () => void, isCollapsed: boolean }) {
  const isCourtUmpire = user?.role === 'court';
  return (
    <header className={cn("sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm", )}>
      <div className={cn("flex h-16 items-center px-4 sm:justify-between sm:space-x-0 transition-all duration-300", !isCourtUmpire && (isCollapsed ? "lg:ml-20" : "lg:ml-64"))}>
         <div className="lg:hidden">
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0">
                    <SheetHeader className="p-4 border-b">
                        <Link href="/dashboard" className="flex">
                           <Logo />
                        </Link>
                    </SheetHeader>
                    <div className="p-4">
                        <MainNav user={user} isMobile={true} />
                    </div>
                </SheetContent>
            </Sheet>
         </div>

        <div className="hidden lg:flex items-center gap-4">
             <Link href="/dashboard" className={cn(isCollapsed ? 'pl-4' : '')}>
                <Logo isCollapsed={isCollapsed} />
            </Link>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-4">
          <UserNav />
        </div>
      </div>
    </header>
  );
}
