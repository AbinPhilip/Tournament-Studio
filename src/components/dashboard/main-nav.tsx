
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, ListOrdered, Shield, Cog, Settings, Trophy, Loader2 } from "lucide-react"
import type { User } from "@/types"
import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"

const allNavItems = [
    { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "tournament", href: "/dashboard/tournament", label: "Tournament Setup", icon: Cog },
    { id: "scheduler", href: "/dashboard/scheduler", label: "Scheduler", icon: ListOrdered },
    { id: "court-view", href: "/dashboard/court-view", label: "Court View", icon: Shield },
    { id: "standings", href: "/dashboard/standings", label: "Standings", icon: Trophy },
    { id: "settings", href: "/dashboard/settings", label: "System Settings", icon: Settings },
];


export function MainNav({ user, isMobile = false }: { user: User | null, isMobile?: boolean }) {
  const pathname = usePathname();
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null);

  useEffect(() => {
    const fetchPermissions = async () => {
        if (user?.role) {
            try {
                const permDocRef = doc(db, 'rolePermissions', user.role);
                const permDocSnap = await getDoc(permDocRef);
                if (permDocSnap.exists()) {
                    setAllowedModules(permDocSnap.data().modules);
                } else {
                    // Fallback for safety, super admins see all, others see basics
                    if (user.role === 'super' || user.role === 'admin') {
                        setAllowedModules(allNavItems.map(item => item.id));
                    } else {
                        setAllowedModules(['dashboard', 'standings']);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch permissions, using fallback.", error);
                 if (user.role === 'super' || user.role === 'admin') {
                    setAllowedModules(allNavItems.map(item => item.id));
                } else {
                    setAllowedModules(['dashboard', 'standings']);
                }
            }
        }
    };
    fetchPermissions();
  }, [user]);

  if (allowedModules === null) {
    return (
        <div className={cn("flex items-center justify-center", isMobile ? "h-full" : "w-64")}>
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  const navItems = allNavItems.filter(item => allowedModules.includes(item.id));

  return (
      <nav className="flex flex-col gap-2 p-4">
        {navItems.map(item => (
            <Link 
                key={item.href}
                href={item.href}
                className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                    pathname.startsWith(item.href) && item.href !== '/dashboard' && "bg-muted text-primary",
                    pathname === '/dashboard' && item.href === '/dashboard' && "bg-muted text-primary"
                )}
            >
                <item.icon className="h-4 w-4" />
                {item.label}
            </Link>
        ))}
      </nav>
  )
}
