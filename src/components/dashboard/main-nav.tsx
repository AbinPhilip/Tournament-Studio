
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, ListOrdered, Shield, Cog, Settings, Trophy, Users, Building } from "lucide-react"
import type { User, UserRole } from "@/types"
import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { doc, getDoc, collection, onSnapshot, Unsubscribe } from "firebase/firestore"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type NavItem = {
    id: string;
    href: string;
    label: string;
    icon: React.ElementType;
}

const allNavItems: NavItem[] = [
    { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "tournament", href: "/dashboard/tournament", label: "Tournament Setup", icon: Cog },
    { id: "organizations", href: "/dashboard/organizations", label: "Organizations", icon: Building },
    { id: "teams", href: "/dashboard/teams", label: "Teams", icon: Users },
    { id: "scheduler", href: "/dashboard/scheduler", label: "Scheduler", icon: ListOrdered },
    { id: "umpire", href: "/dashboard/umpire", label: "Umpire View", icon: Shield },
    { id: "match-history", href: "/dashboard/match-history", label: "Match History", icon: Trophy },
    { id: "settings", href: "/dashboard/settings", label: "System Settings", icon: Settings },
];

type RolePermissions = Record<UserRole, string[]>;

const defaultPermissions: RolePermissions = {
    super: ['dashboard', 'tournament', 'organizations', 'teams', 'scheduler', 'umpire', 'match-history', 'settings'],
    admin: ['dashboard', 'tournament', 'organizations', 'teams', 'scheduler', 'umpire', 'match-history', 'settings'],
    update: ['dashboard', 'umpire', 'match-history'],
    inquiry: ['dashboard', 'match-history'],
    individual: ['dashboard', 'match-history'],
    court: [],
};


export function MainNav({ user, isMobile = false, isCollapsed = false }: { user: User | null, isMobile?: boolean, isCollapsed?: boolean }) {
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<RolePermissions>(defaultPermissions);
  
  useEffect(() => {
    const permsCollectionRef = collection(db, 'rolePermissions');
    const unsubscribe = onSnapshot(permsCollectionRef, (snapshot) => {
        if (snapshot.empty) {
            setPermissions(defaultPermissions);
            return;
        }
        const fetchedPerms = snapshot.docs.reduce((acc, doc) => {
            acc[doc.id as UserRole] = doc.data().modules;
            return acc;
        }, {} as Partial<RolePermissions>);
        setPermissions(current => ({...current, ...fetchedPerms}));
    }, (error) => {
        console.error("Failed to fetch permissions in real-time:", error);
        setPermissions(defaultPermissions);
    });

    return () => unsubscribe();
  }, []);

  const getIsActive = (href: string, currentPath: string) => {
    if (href === '/dashboard') return currentPath === href;
    return currentPath.startsWith(href);
  }

  const role = user?.role;
  if (!role || role === 'court') return null;

  const allowedModuleIds = permissions[role] || [];
  
  // Backward compatibility for old permission names
  const effectiveModuleIds = new Set(allowedModuleIds);
  if (effectiveModuleIds.has('standings')) effectiveModuleIds.add('match-history');
  if (effectiveModuleIds.has('court-view')) effectiveModuleIds.add('umpire');


  const navItems = allNavItems.filter(item => effectiveModuleIds.has(item.id));
  
  if (isCollapsed && !isMobile) {
    return (
        <TooltipProvider>
            <nav className={cn("flex flex-col gap-2 items-center", isMobile ? "p-0" : "p-4")}>
                {navItems.map(item => (
                    <Tooltip key={item.href} delayDuration={0}>
                        <TooltipTrigger asChild>
                            <Link 
                                href={item.href}
                                className={cn(
                                    "flex items-center justify-center h-10 w-10 rounded-lg text-muted-foreground transition-all hover:text-primary hover:bg-muted",
                                    getIsActive(item.href, pathname) && "bg-muted text-primary",
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                <span className="sr-only">{item.label}</span>
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                           <p>{item.label}</p>
                        </TooltipContent>
                    </Tooltip>
                ))}
            </nav>
        </TooltipProvider>
    )
  }

  return (
      <nav className={cn("flex flex-col gap-2", isMobile ? "p-0" : "p-4")}>
        {!isMobile && (
            <div className="flex items-center pl-3 mb-2 h-10">
                <Link href="/dashboard">
                    <Logo />
                </Link>
            </div>
        )}
        {navItems.map(item => (
            <Link 
                key={item.href}
                href={item.href}
                className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                    getIsActive(item.href, pathname) && "bg-muted text-primary",
                )}
            >
                <item.icon className="h-4 w-4" />
                {item.label}
            </Link>
        ))}
      </nav>
  )
}
