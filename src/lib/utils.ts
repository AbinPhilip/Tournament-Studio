
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { TeamType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Function to get the total number of rounds for a knockout tournament
const getTotalRounds = (teamCount: number) => {
    if (teamCount < 2) return 0;
    // For knockout, the number of rounds is the smallest power of 2 greater than or equal to teamCount.
    return Math.ceil(Math.log2(teamCount));
};

export const getRoundName = (round: number, eventType: TeamType, teamCount: number) => {
    if (teamCount === 0) return `Round ${round}`;
    const totalRounds = getTotalRounds(teamCount);
    if (totalRounds === 0) return `Round ${round}`;

    if (round === totalRounds) return 'Final';
    if (round === totalRounds - 1) return 'Semi-Finals';
    if (round === totalRounds - 2) return 'Quarter-Finals';
    
    // For early rounds in larger tournaments
    if (totalRounds > 4 && round === totalRounds - 3) return 'Round of 16';
    
    return `Round ${round}`;
};
