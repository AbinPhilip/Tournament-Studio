
"use client";

import Link from "next/link";
import { Logo } from '@/components/logo';
import { UserNav } from '@/components/dashboard/user-nav';
import type { User } from '@/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { MainNav } from "./main-nav";

export function DashboardHeader({ user }: { user: User | null }) {

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
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

        <div className="hidden lg:flex">
             <Link href="/dashboard">
                <Logo />
            </Link>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-4">
          <UserNav />
        </div>
      </div>
    </header>
  );
}
