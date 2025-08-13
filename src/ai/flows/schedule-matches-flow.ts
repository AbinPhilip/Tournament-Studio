
'use server';
/**
 * @fileOverview A flow for generating a tournament schedule.
 * 
 * - scheduleMatches - Generates a match schedule based on tournament type.
 * - ScheduleMatchesInput - The input type for the scheduleMatches function.
 * - ScheduleMatchesOutput - The return type for the scheduleMatches function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { Team, Tournament, Match } from '@/types';

// Define Zod schemas for validation
const TeamSchema = z.object({
    id: z.string(),
    type: z.enum(['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles']),
    player1Name: z.string(),
    player2Name: z.string().optional(),
    organizationId: z.string(),
    genderP1: z.enum(['male', 'female']).optional(),
    genderP2: z.enum(['male', 'female']).optional(),
    photoUrl: z.string().optional(),
});

const TournamentSchema = z.object({
    id: z.string(),
    location: z.string(),
    numberOfCourts: z.number(),
    courtNames: z.array(z.object({ name: z.string() })),
    tournamentType: z.enum(['round-robin', 'knockout']),
    date: z.date({ coerce: true }),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
    startedAt: z.date({ coerce: true }).optional(),
});

const ScheduleMatchesInputSchema = z.object({
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
    round: z.number().optional(),
});

const ScheduleMatchesOutputSchema = z.object({
    matches: z.array(MatchSchema),
});
export type ScheduleMatchesOutput = z.infer<typeof ScheduleMatchesOutputSchema>;


const schedulePrompt = ai.definePrompt({
    name: 'scheduleMatchesPrompt',
    input: { schema: ScheduleMatchesInputSchema },
    output: { schema: ScheduleMatchesOutputSchema },
    prompt: `
        You are a tournament scheduler for a badminton competition. Your task is to generate a schedule for all registered teams based on the tournament type.

        Here is the tournament information:
        - Tournament Type: {{{tournament.tournamentType}}}
        - Location: {{{tournament.location}}}
        - Number of Courts: {{{tournament.numberOfCourts}}}
        - Court Names: {{#each tournament.courtNames}}{{this.name}}, {{/each}}

        Here is the list of teams, grouped by event type:
        {{#each teams}}
        - Team ID: {{this.id}}, Players: {{this.player1Name}}{{#if this.player2Name}} & {{this.player2Name}}{{/if}}, Event: {{this.type}}
        {{/each}}

        Constraints and rules:
        1.  Group teams by their 'type' (e.g., 'mens_doubles', 'singles'). The schedule must only contain matches between teams of the same type.
        2.  Assign matches to courts sequentially from the list of court names.
        3.  Schedule ALL matches for the same day. Start scheduling from 9:00 AM on the tournament date. If all courts are used for a time slot, the next set of matches should be scheduled for the next hour (e.g., 10:00 AM).
        4.  Assume each match takes exactly 1 hour.
        5.  You can schedule multiple matches at the same time if there are enough courts. For example, with 4 courts, you can schedule 4 matches at 9:00 AM, then 4 more at 10:00 AM.
        6.  For each match, provide the IDs and names of both teams.
        7.  Set the initial status of all generated matches to 'SCHEDULED'.

        Scheduling Logic by Tournament Type:
        - If 'tournamentType' is 'round-robin': Generate a full round-robin schedule. This means every team in an event type must play every other team in the same event type exactly once.
        - If 'tournamentType' is 'knockout': Generate ONLY the first round of a single-elimination knockout bracket. Randomly pair the teams. If there is an odd number of teams in an event type, one team gets a "bye" and automatically advances to the next round (do not generate a match for the team with the bye). For all generated matches, set the 'round' field to 1.

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
    // Convert date strings from AI back to Date objects
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
}): Promise<(Omit<Match, 'id' | 'startTime'> & { startTime: Date })[]> {
    const result = await scheduleMatchesFlow(input);
    return result.matches;
}
