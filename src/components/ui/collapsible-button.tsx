
"use client"

import { Button } from "@/components/ui/button"
import { PanelLeftClose, PanelRightClose } from "lucide-react"
import { cn } from "@/lib/utils"

export function CollapsibleButton({ isCollapsed, onToggle }: { isCollapsed: boolean, onToggle: () => void }) {
    return (
        <Button onClick={onToggle} variant="ghost" size="icon" className={cn("transition-all", isCollapsed ? 'rotate-180' : 'rotate-0')}>
            <PanelLeftClose />
            <span className="sr-only">Toggle Sidebar</span>
        </Button>
    )
}
