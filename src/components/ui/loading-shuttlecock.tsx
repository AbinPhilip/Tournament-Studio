
"use client";

import { cn } from "@/lib/utils";

const ShuttlecockIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        {...props}
    >
        <path d="m6 10 7-7 7 7" />
        <path d="m13 3 7 7" />
        <path d="M12 12v10" />
        <path d="M12 12 6 6" />
        <path d="m6 10 6 6 6-6" />
    </svg>
)

export function LoadingShuttlecock({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center justify-center", className)} {...props}>
      <ShuttlecockIcon className="h-12 w-12 text-primary animate-wobble" />
    </div>
  );
}
