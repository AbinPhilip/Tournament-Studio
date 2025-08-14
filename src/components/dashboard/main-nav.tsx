
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, ListOrdered, Shield, Cog, Settings, Trophy, Users, Building } from "lucide-react"
import type { User } from "@/types"
import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { doc, getDoc, collection, writeBatch } from "firebase/firestore"

const allNavItems = [
    { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "tournament", href: "/dashboard/tournament", label: "Tournament Setup", icon: Cog },
    { id: "organizations", href: "/dashboard/organizations", label: "Organizations", icon: Building },
    { id: "teams", href: "/dashboard/teams", label: "Teams", icon: Users },
    { id: "scheduler", href: "/dashboard/scheduler", label: "Scheduler", icon: ListOrdered },
    { id: "umpire", href: "/dashboard/umpire", label: "Umpire View", icon: Shield },
    { id: "match-history", href: "/dashboard/match-history", label: "Match History", icon: Trophy },
    { id: "settings", href: "/dashboard/settings", label: "System Settings", icon: Settings },
];


export function MainNav({ user, isMobile = false }: { user: User | null, isMobile?: boolean }) {
  const pathname = usePathname();
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null);

  useEffect(() => {
    const fetchPermissions = async () => {
        if (user?.role && user.role !== 'court') {
            try {
                const permDocRef = doc(db, 'rolePermissions', user.role);
                const permDocSnap = await getDoc(permDocRef);
                if (permDocSnap.exists()) {
                    setAllowedModules(permDocSnap.data().modules);
                } else {
                    // Fallback permissions if no document is found in Firestore
                    if (user.role === 'super' || user.role === 'admin') {
                        setAllowedModules(allNavItems.map(item => item.id));
                        return;
                    }
                    const defaultPerms: any = {
                        update: ['dashboard', 'umpire', 'match-history'],
                        inquiry: ['dashboard', 'match-history'],
                        individual: ['dashboard', 'match-history'],
                    };
                     const modules = defaultPerms[user.role] || ['dashboard'];
                    setAllowedModules(modules);
                }
            } catch (error) {
                console.error("Failed to fetch permissions, using fallback.", error);
                 if (user.role === 'super' || user.role === 'admin') {
                    setAllowedModules(allNavItems.map(item => item.id));
                } else {
                    setAllowedModules(['dashboard', 'match-history']);
                }
            }
        } else if (user?.role === 'court') {
            setAllowedModules([]); // No nav for court umpires
        }
    };
    fetchPermissions();
  }, [user]);
  
  const getIsActive = (href: string, currentPath: string) => {
    if (href === '/dashboard') {
        return currentPath === href;
    }
    return currentPath.startsWith(href);
  }

  if (allowedModules === null && user?.role !== 'court') {
    return (
        <div className={cn("flex items-center justify-center", isMobile ? "h-full" : "w-64")}>
        </div>
    );
  }

  const navItems = allNavItems.filter(item => {
    // Hide old standings link if it exists
    if (item.id === 'standings') return false; 
    
    // Remap 'court-view' to 'umpire' for permission checking
    if (item.id === 'umpire') return allowedModules?.includes('court-view') || allowedModules?.includes('umpire');
    
    // Remap 'match-history' to check for 'standings' for backward compatibility
    if (item.id === 'match-history') return allowedModules?.includes('standings') || allowedModules?.includes('match-history');
    
    return allowedModules?.includes(item.id)
  });

  return (
      <nav className="flex flex-col gap-2 p-4">
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
