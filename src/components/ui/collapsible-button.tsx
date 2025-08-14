
"use client"

import { Button } from "@/components/ui/button"
import { PanelLeftClose, PanelRightClose } from "lucide-react"

export function CollapsibleButton({ isCollapsed, onToggle }: { isCollapsed: boolean, onToggle: () => void }) {
    return (
        <Button onClick={onToggle} variant="outline" size="icon" className="w-full">
            {isCollapsed ? <PanelRightClose /> : <PanelLeftClose />}
            <span className="sr-only">Toggle Sidebar</span>
        </Button>
    )
}
