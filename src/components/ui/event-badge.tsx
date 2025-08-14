
import { Badge } from "@/components/ui/badge";
import type { TeamType } from "@/types";
import { cn } from "@/lib/utils";

type EventBadgeProps = {
  eventType: TeamType;
  className?: string;
};

export function EventBadge({ eventType, className }: EventBadgeProps) {
  const eventStyles: Record<TeamType, string> = {
    singles: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/60 dark:text-sky-200 dark:border-sky-700",
    mens_doubles: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-700",
    womens_doubles: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/60 dark:text-rose-200 dark:border-rose-700",
    mixed_doubles: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300 dark:bg-fuchsia-900/60 dark:text-fuchsia-200 dark:border-fuchsia-700",
  };
  
  const text = eventType.replace(/_/g, ' ');

  return (
    <Badge className={cn("capitalize font-semibold text-sm py-1 px-3", eventStyles[eventType], className)}>
        {text}
    </Badge>
  );
}
