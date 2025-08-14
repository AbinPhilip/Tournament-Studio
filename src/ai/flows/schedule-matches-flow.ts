
'use server';
/**
 * @fileOverview A flow for generating a tournament schedule based on a "picking of lots" algorithm.
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
    lotNumber: z.number().optional(),
});

const TournamentSchema = z.object({
    id: z.string(),
    location: z.string(),
    numberOfCourts: z.number(),
    courtNames: z.array(z.object({ name: z.string() })),
    tournamentType: z.enum(['round-robin', 'knockout']),
    date: z.string(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
    startedAt: z.string().optional(),
});

const EventTeamCountSchema = z.object({
    eventType: z.enum(['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles']),
    count: z.number(),
});

const ScheduleMatchesInputSchema = z.object({
  teams: z.array(TeamSchema),
  tournament: TournamentSchema,
  teamsCountPerEvent: z.array(EventTeamCountSchema),
});
export type ScheduleMatchesInput = z.infer<typeof ScheduleMatchesInputSchema>;

const MatchSchema = z.object({
    team1Id: z.string(),
    team2Id: z.string(),
    team1Name: z.string(),
    team2Name: z.string(),
    eventType: z.enum(['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles']),
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
        You are a highly intelligent tournament scheduler for a badminton competition. Your task is to generate a complete and fair schedule based on the "picking of lots" principle for randomness. You should only generate the pairings. Do NOT assign courts or times.

        Here is the tournament information:
        - Tournament Type: {{{tournament.tournamentType}}}

        Here is the list of all registered teams, which you must group by their 'type' for scheduling:
        {{#each teams}}
        - Team ID: {{this.id}}, Players: {{this.player1Name}}{{#if this.player2Name}} & {{this.player2Name}}{{/if}}, Event: {{this.type}}
        {{/each}}

        Here is the count of teams per event category:
        {{#each teamsCountPerEvent}}
        - Event: {{this.eventType}}, Count: {{this.count}}
        {{/each}}

        General Rules:
        1.  **Group by Event:** All scheduling must happen independently for each event type (e.g., 'mens_doubles', 'singles'). Matches must only be between teams of the same type.
        2.  **Initial Status:** Set the initial 'status' of all generated matches to 'PENDING'.

        --- SCHEDULING ALGORITHM BY TOURNAMENT TYPE ---

        **A. If 'tournamentType' is 'knockout':**

        Follow this "picking of lots" procedure for EACH event type category:
        1.  **Identify Teams:** Get the list of all N players/teams for the category using the 'teamsCountPerEvent' data.
        2.  **Calculate Byes:** A "bye" is a pass to the next round. A bye is needed if N is not a power of 2.
            *   Find the next highest power of 2 (P). (e.g., if N=13, P=16).
            *   Number of byes = P - N. (if N=13, byes = 3).
        3.  **Perform the Draw (Picking Lots):**
            *   Create a list of all N team IDs for the category.
            *   **Shuffle this list randomly.** This is the critical step for a random draw.
        4.  **Assign Byes and Matches:**
            *   The first (P - N) teams in your shuffled list receive a bye. Do NOT generate a match for them. They are considered winners of round 1 and will play in round 2.
            *   The remaining teams are paired up sequentially for the first round. For example, the next team in the shuffled list plays the one after it, and so on.
        5.  **Set Round Number:** For all generated matches, set the 'round' field to 1.

        **B. If 'tournamentType' is 'round-robin':**
        
        Follow this procedure for EACH event type category:
        1.  **Generate All Pairings:** First, create a list of all possible unique pairings. For N teams, this will be N * (N-1) / 2 matches.
        2.  **Perform the Draw (Picking Lots):**
            *   Take this complete list of generated matches.
            *   **Shuffle this list of matches randomly.** This randomizes the order of play.
        3.  **Assign Courts and Times:** Do NOT assign courts or times.

        Now, generate the complete list of matches in the required JSON format according to these rules.
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
    return output;
  }
);

// Wrapper function to be called from the application
export async function scheduleMatches(input: {
    teams: Team[],
    tournament: Omit<Tournament, 'date' | 'startedAt' | 'status'> & { id: string; date: string; status?: string; startedAt?:string; },
    teamsCountPerEvent: { eventType: string, count: number }[],
}): Promise<Omit<Match, 'id'>[]> {
    const result = await scheduleMatchesFlow(input);
    return result.matches;
}
