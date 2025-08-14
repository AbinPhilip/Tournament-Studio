
import { Badge } from "@/components/ui/badge";
import type { TeamType } from "@/types";
import { cn } from "@/lib/utils";

type EventBadgeProps = {
  eventType: TeamType;
  className?: string;
};

export function EventBadge({ eventType, className }: EventBadgeProps) {
  const eventStyles: Record<TeamType, string> = {
    singles: "bg-blue-500 hover:bg-blue-600 border-transparent text-white",
    mens_doubles: "bg-green-600 hover:bg-green-700 border-transparent text-white",
    womens_doubles: "bg-pink-500 hover:bg-pink-600 border-transparent text-white",
    mixed_doubles: "bg-purple-600 hover:bg-purple-700 border-transparent text-white",
  };
  
  const text = eventType.replace(/_/g, ' ');

  return (
    <Badge variant="default" className={cn("capitalize font-semibold text-sm py-1 px-3", eventStyles[eventType], className)}>
        {text}
    </Badge>
  );
}
