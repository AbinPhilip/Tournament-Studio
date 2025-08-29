
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, ListOrdered, Shield, Cog, Settings, Trophy, Users, Building, GitBranch, MonitorPlay, HeartHandshake, UploadCloud } from "lucide-react"
import type { User, UserRole } from "@/types"
import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { collection, onSnapshot } from "firebase/firestore"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type NavItem = {
    id: string;
    href: string;
    label: string;
    icon: React.ElementType;
    target?: string;
}

const allNavItems: NavItem[] = [
    { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "tournament", href: "/dashboard/tournament", label: "Tournament Setup", icon: Cog },
    { id: "organizations", href: "/dashboard/organizations", label: "Organizations", icon: Building },
    { id: "teams", href: "/dashboard/teams", label: "Teams", icon: Users },
    { id: "sponsors", href: "/dashboard/sponsors", label: "Sponsors", icon: HeartHandshake },
    { id: "scheduler", href: "/dashboard/scheduler", label: "Scheduler", icon: ListOrdered },
    { id: "umpire", href: "/dashboard/umpire", label: "Umpire View", icon: Shield },
    { id: "draw", href: "/dashboard/draw", label: "Tournament Draw", icon: GitBranch },
    { id: "match-history", href: "/dashboard/match-history", label: "Match History", icon: Trophy },
    { id: "presenter", href: "/presenter", label: "Presenter View", icon: MonitorPlay, target: "_blank" },
    { id: "image-uploader", href: "/dashboard/image-uploader", label: "Image Uploader", icon: UploadCloud },
    { id: "settings", href: "/dashboard/settings", label: "System Settings", icon: Settings },
];

type RolePermissions = Record<UserRole, string[]>;


export function MainNav({ user, isMobile = false, isCollapsed = false }: { user: User | null, isMobile?: boolean, isCollapsed?: boolean }) {
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  
  useEffect(() => {
    const allModuleIds = allNavItems.map(m => m.id);
    const defaultPerms: RolePermissions = {
        super: allModuleIds,
        admin: allModuleIds.filter(id => id !== 'settings'), // Admin can't change permissions
        update: ['dashboard', 'umpire', 'draw', 'match-history', 'presenter'],
        inquiry: ['dashboard', 'draw', 'match-history', 'presenter'],
        individual: ['dashboard', 'draw', 'match-history', 'presenter'],
        court: [],
    };
    
    const permsCollectionRef = collection(db, 'rolePermissions');
    const unsubscribe = onSnapshot(permsCollectionRef, (snapshot) => {
        if (snapshot.empty) {
            console.warn("No role permissions found in Firestore. Using defaults.");
            setPermissions(defaultPerms);
            return;
        }
        const fetchedPerms = snapshot.docs.reduce((acc, doc) => {
            const modules = doc.data().modules || [];
            if (!modules.includes('presenter')) {
                modules.push('presenter');
            }
            if (!modules.includes('image-uploader')) {
                modules.push('image-uploader');
            }
            acc[doc.id as UserRole] = modules;
            return acc;
        }, {} as RolePermissions);
        
        // Ensure super role always has all permissions
        fetchedPerms.super = allModuleIds;
        setPermissions(fetchedPerms);

    }, (error) => {
        console.error("Failed to fetch permissions in real-time:", error);
        setPermissions(defaultPerms); // Fallback to defaults on error
    });

    return () => unsubscribe();
  }, []);

  const getIsActive = (href: string, currentPath: string) => {
    if (href === '/dashboard' || href === '/presenter') return currentPath === href;
    return currentPath.startsWith(href);
  }

  const role = user?.role;
  if (!role || role === 'court' || !permissions) return null;

  const allowedModuleIds = new Set(permissions[role] || []);
  const navItems = allNavItems.filter(item => allowedModuleIds.has(item.id));
  
  if (isCollapsed && !isMobile) {
    return (
        <TooltipProvider>
            <nav className="grid gap-1 px-2 py-4">
                {navItems.map(item => (
                    <Tooltip key={item.href} delayDuration={0}>
                        <TooltipTrigger asChild>
                            <Link 
                                href={item.href}
                                target={item.target}
                                className={cn(
                                    "flex items-center justify-center h-10 w-10 rounded-lg text-muted-foreground transition-colors hover:text-primary hover:bg-muted",
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
      <nav className="grid items-start gap-1 px-2 py-4">
        {navItems.map(item => (
            <Link 
                key={item.href}
                href={item.href}
                target={item.target}
                className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                    getIsActive(item.href, pathname) && "bg-muted text-primary",
                )}
            >
                <item.icon className="h-4 w-4" />
                {!isCollapsed && item.label}
            </Link>
        ))}
      </nav>
  )
}
