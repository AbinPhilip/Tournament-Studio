
import { Badge } from "@/components/ui/badge";
import type { TeamType } from "@/types";
import { cn } from "@/lib/utils";

type EventBadgeProps = {
  eventType: TeamType;
  className?: string;
};

export function EventBadge({ eventType, className }: EventBadgeProps) {
  const eventStyles: Record<TeamType, string> = {
    singles: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800",
    mens_doubles: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800",
    womens_doubles: "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/50 dark:text-pink-300 dark:border-pink-800",
    mixed_doubles: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800",
  };
  
  const text = eventType.replace(/_/g, ' ');

  return (
    <Badge className={cn("capitalize font-semibold text-base", eventStyles[eventType], className)}>
        {text}
    </Badge>
  );
}
