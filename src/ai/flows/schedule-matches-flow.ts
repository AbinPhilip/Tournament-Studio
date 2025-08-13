
'use server';
/**
 * @fileOverview A flow for generating a round-robin tournament schedule.
 * 
 * - scheduleMatches - Generates a match schedule.
 * - ScheduleMatchesInput - The input type for the scheduleMatches function.
 * - ScheduleMatchesOutput - The return type for the scheduleMatches function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { Team, Tournament, Match, TeamType } from '@/types';
import { Timestamp } from 'firebase/firestore';

// Define Zod schemas for validation
const TeamSchema = z.object({
    id: z.string(),
    type: z.enum(['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles']),
    player1Name: z.string(),
    player2Name: z.string().optional(),
    organizationId: z.string(),
});

const TournamentSchema = z.object({
    id: z.string(),
    location: z.string(),
    date: z.date(),
    numberOfCourts: z.number(),
    courtNames: z.array(z.object({ name: z.string() })),
});

export const ScheduleMatchesInputSchema = z.object({
  teams: z.array(TeamSchema),
  tournament: TournamentSchema,
});
export type ScheduleMatchesInput = z.infer<typeof ScheduleMatchesInputSchema>;

const MatchSchema = z.object({
    team1Id: z.string(),
    team2Id: z.string(),
    team1Name: z.string(),
    team2Name: z.string(),
    eventType: z.enum(['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles']),
    courtName: z.string(),
    startTime: z.date(),
    status: z.enum(['PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED']),
});

export const ScheduleMatchesOutputSchema = z.object({
    matches: z.array(MatchSchema),
});
export type ScheduleMatchesOutput = z.infer<typeof ScheduleMatchesOutputSchema>;


const schedulePrompt = ai.definePrompt({
    name: 'scheduleMatchesPrompt',
    input: { schema: ScheduleMatchesInputSchema },
    output: { schema: ScheduleMatchesOutputSchema },
    prompt: `
        You are a tournament scheduler for a badminton competition. Your task is to generate a round-robin schedule for all registered teams.

        Here is the tournament information:
        - Date: {{{tournament.date}}}
        - Location: {{{tournament.location}}}
        - Number of Courts: {{{tournament.numberOfCourts}}}
        - Court Names: {{#each tournament.courtNames}}{{this.name}}, {{/each}}

        Here is the list of teams, grouped by event type:
        {{#each teams}}
        - Team ID: {{this.id}}, Players: {{this.player1Name}}{{#if this.player2Name}} & {{this.player2Name}}{{/if}}, Event: {{this.type}}
        {{/each}}

        Please generate a full round-robin schedule. This means every team in an event type must play every other team in the same event type exactly once.

        Constraints and rules:
        1.  Group teams by their 'type' (e.g., 'mens_doubles', 'singles'). The schedule must only contain matches between teams of the same type.
        2.  Assign matches to courts sequentially from the list of court names.
        3.  Schedule matches starting from 9:00 AM on the tournament date.
        4.  Assume each match takes exactly 1 hour.
        5.  You can schedule multiple matches at the same time if there are enough courts. For example, with 4 courts, you can schedule 4 matches at 9:00 AM, then 4 more at 10:00 AM.
        6.  For each match, provide the IDs and names of both teams.
        7.  Set the initial status of all generated matches to 'SCHEDULED'.

        Generate the list of matches in the required JSON format.
    `,
});

const scheduleMatchesFlow = ai.defineFlow(
  {
    name: 'scheduleMatchesFlow',
    inputSchema: ScheduleMatchesInputSchema,
    outputSchema: ScheduleMatchesOutputSchema,
  },
  async (input) => {
    const { output } = await schedulePrompt(input);
    if (!output) {
      throw new Error('Failed to generate a schedule.');
    }
    // Convert date strings back to Date objects, as the AI model returns strings
    const matchesWithDates = output.matches.map(match => ({
        ...match,
        startTime: new Date(match.startTime),
    }));

    return { matches: matchesWithDates };
  }
);

// Wrapper function to be called from the application
export async function scheduleMatches(input: {
    teams: Team[],
    tournament: Omit<Tournament, 'date'> & { date: Date }
}): Promise<Omit<Match, 'id' | 'startTime'> & { startTime: Date }[]> {
    const result = await scheduleMatchesFlow(input);
    return result.matches;
}
