
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
import type { Team, Tournament, Match, Organization } from '@/types';

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

const OrganizationSchema = z.object({
    id: z.string(),
    name: z.string(),
    location: z.string(),
});

const EventTeamCountSchema = z.object({
    eventType: z.enum(['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles']),
    count: z.number(),
});

const ScheduleMatchesInputSchema = z.object({
  teams: z.array(TeamSchema),
  tournament: TournamentSchema,
  teamsCountPerEvent: z.array(EventTeamCountSchema),
  organizations: z.array(OrganizationSchema),
});
export type ScheduleMatchesInput = z.infer<typeof ScheduleMatchesInputSchema>;

const MatchSchema = z.object({
    team1Id: z.string(),
    team2Id: z.string(),
    team1Name: z.string(),
    team2Name: z.string(),
    team1OrgName: z.string(),
    team2OrgName: z.string(),
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
        You are a highly intelligent tournament scheduler for a badminton competition. Your task is to generate a complete and fair schedule based on the "picking of lots" principle for randomness. You should only generate the pairings. Do NOT assign courts or times. You MUST include the organization name for each team in the match data.

        Here is the tournament information:
        - Tournament Type: {{{tournament.tournamentType}}}

        Here is the list of all registered teams, which you must group by their 'type' for scheduling. Use their lotNumber for pairing.
        {{#each teams}}
        - Team ID: {{this.id}}, Players: {{this.player1Name}}{{#if this.player2Name}} & {{this.player2Name}}{{/if}}, Event: {{this.type}}, OrgID: {{this.organizationId}}, Lot #: {{this.lotNumber}}
        {{/each}}
        
        Here is the list of all organizations. Use this to find the organization name from an organizationId.
        {{#each organizations}}
        - Org ID: {{this.id}}, Name: {{this.name}}
        {{/each}}

        Here is the count of teams per event category:
        {{#each teamsCountPerEvent}}
        - Event: {{this.eventType}}, Count: {{this.count}}
        {{/each}}

        General Rules:
        1.  **Group by Event:** All scheduling must happen independently for each event type (e.g., 'mens_doubles', 'singles'). Matches must only be between teams of the same type.
        2.  **Initial Status:** Set the initial 'status' of all generated matches to 'PENDING'.
        3.  **Organization Names**: You MUST look up the organization ID from the team data and provide the full organization name for team1OrgName and team2OrgName in the output.
        4.  **Use Lot Numbers**: All pairings must be determined by the provided 'lotNumber' for each team. Do not shuffle or randomize. Pair lot #1 vs lot #2, #3 vs #4, etc.

        --- SCHEDULING ALGORITHM BY TOURNAMENT TYPE ---

        **A. If 'tournamentType' is 'knockout':**

        Follow this "picking of lots" procedure for EACH event type category:
        1.  **Identify Teams:** Get the list of all N players/teams for the category.
        2.  **Calculate Byes:** A "bye" is a pass to the next round. A bye is needed if N is not a power of 2.
            *   Find the next highest power of 2 (P). (e.g., if N=13, P=16).
            *   Number of byes = P - N. (if N=13, byes = 3).
        3.  **Assign Byes and Matches:**
            *   The teams with the lowest lot numbers from 1 up to the number of byes (P-N) receive a bye. Do NOT generate a match for them. They are considered winners of round 1.
            *   The remaining teams are paired up sequentially based on their lot numbers. For example, the team with the next lot number plays the one after it, and so on.
        4.  **Set Round Number:** For all generated matches, set the 'round' field to 1.

        **B. If 'tournamentType' is 'round-robin':**
        
        Follow this procedure for EACH event type category:
        1.  **Generate All Pairings:** Create a list of all possible unique pairings based on lot number.
        2.  **Order by Lot Number**: Ensure the generated matches are ordered logically based on the lot numbers (e.g., pairings involving lower lot numbers appear first).

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
    // The AI prompt is now responsible for including the org names.
    // This flow simply calls the AI and returns the result.
    const { output } = await schedulePrompt(input);
    if (!output) {
      throw new Error('Failed to generate a schedule.');
    }
    
    // Create a map for quick org name lookup
    const orgNameMap = new Map(input.organizations.map(org => [org.id, org.name]));
    const teamMap = new Map(input.teams.map(team => [team.id, team]));

    // Post-process to ensure correctness of org names, just in case AI missed it
    const augmentedMatches = output.matches.map(match => {
        const team1 = teamMap.get(match.team1Id);
        const team2 = teamMap.get(match.team2Id);
        return {
            ...match,
            team1OrgName: team1 ? orgNameMap.get(team1.organizationId) || 'N/A' : 'N/A',
            team2OrgName: team2 ? orgNameMap.get(team2.organizationId) || 'N/A' : 'N/A',
        };
    });

    return { matches: augmentedMatches };
  }
);


export async function scheduleMatches(input: ScheduleMatchesInput): Promise<Omit<Match, 'id'>[]> {
    const result = await scheduleMatchesFlow(input);
    return result.matches;
}
