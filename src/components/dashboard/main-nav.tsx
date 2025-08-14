
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, ListOrdered, Shield, Cog, Settings, Trophy } from "lucide-react"
import type { User } from "@/types"

export function MainNav({ user }: { user: User | null }) {
  const pathname = usePathname()
  
  const adminNavItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/tournament", label: "Tournament Setup", icon: Cog },
    { href: "/dashboard/scheduler", label: "Scheduler", icon: ListOrdered },
    { href: "/dashboard/umpire", label: "Umpire View", icon: Shield },
    { href: "/dashboard/standings", label: "Standings", icon: Trophy },
    { href: "/dashboard/settings", label: "System Settings", icon: Settings },
  ]
  
  const userNavItems = [
     { href: "/dashboard", label: "My Dashboard", icon: LayoutDashboard },
     { href: "/dashboard/standings", label: "Standings", icon: Trophy },
  ]
  
  const navItems = user?.role === 'admin' || user?.role === 'super' ? adminNavItems : userNavItems;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-background lg:flex">
      <nav className="flex flex-col gap-2 p-4">
        {navItems.map(item => (
            <Link 
                key={item.href}
                href={item.href}
                className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                    pathname === item.href && "bg-muted text-primary"
                )}
            >
                <item.icon className="h-4 w-4" />
                {item.label}
            </Link>
        ))}
      </nav>
    </aside>
  )
}
