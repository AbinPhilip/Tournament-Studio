
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
    date: z.string(), // Pass date as ISO string
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
    startedAt: z.string().optional(), // Pass date as ISO string
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

// Add organizationName to the team schema for the prompt
const TeamWithOrgNameSchema = TeamSchema.extend({
    organizationName: z.string(),
});

const ScheduleMatchesInputSchema = z.object({
  teams: z.array(TeamSchema),
  tournament: TournamentSchema,
  teamsCountPerEvent: z.array(EventTeamCountSchema),
  organizations: z.array(OrganizationSchema),
});
export type ScheduleMatchesInput = z.infer<typeof ScheduleMatchesInputSchema>;

// The internal prompt input will use the augmented team data.
const PromptInputSchema = ScheduleMatchesInputSchema.extend({
    teams: z.array(TeamWithOrgNameSchema),
});


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
    winnerId: z.string().optional(),
});

const ScheduleMatchesOutputSchema = z.object({
    matches: z.array(MatchSchema),
});
export type ScheduleMatchesOutput = z.infer<typeof ScheduleMatchesOutputSchema>;


const schedulePrompt = ai.definePrompt({
    name: 'scheduleMatchesPrompt',
    input: { schema: PromptInputSchema }, // Use the augmented schema
    output: { schema: ScheduleMatchesOutputSchema },
    prompt: `
        You are a highly intelligent tournament scheduler for a badminton competition. Your task is to generate a complete and fair schedule based on the "picking of lots" principle for randomness. You should only generate the pairings. Do NOT assign courts or times. You MUST include the organization name for each team in the match data.

        Here is the tournament information:
        - Tournament Type: {{{tournament.tournamentType}}}

        Here is the list of all registered teams, which you must group by their 'type' for scheduling. Use their lotNumber for pairing. The organization name is provided directly in each team object.
        {{#each teams}}
        - Team ID: {{this.id}}, Players: {{this.player1Name}}{{#if this.player2Name}} & {{this.player2Name}}{{/if}}, Event: {{this.type}}, Org: {{this.organizationName}}, Lot #: {{this.lotNumber}}
        {{/each}}

        Here is the count of teams per event category:
        {{#each teamsCountPerEvent}}
        - Event: {{this.eventType}}, Count: {{this.count}}
        {{/each}}

        General Rules:
        1.  **Group by Event:** All scheduling must happen independently for each event type (e.g., 'mens_doubles', 'singles'). Matches must only be between teams of the same type.
        2.  **Organization Names**: You MUST use the 'organizationName' field provided for each team to populate team1OrgName and team2OrgName in the output.
        3.  **Use Lot Numbers**: All pairings must be determined by the provided 'lotNumber' for each team. Do not shuffle or randomize. Pair lot #1 vs lot #2, #3 vs #4, etc.

        --- SCHEDULING ALGORITHM BY TOURNAMENT TYPE ---

        **A. If 'tournamentType' is 'knockout':**

        Follow this "picking of lots" procedure for EACH event type category:
        1.  **Sort Teams:** First, take all teams for the event and sort them in ascending order based on their 'lotNumber'.
        2.  **Calculate Byes:** A "bye" is a pass to the next round. A bye is needed if the total number of teams (N) is not a power of 2.
            *   Find the next highest power of 2 (P). (e.g., if N=13, P=16).
            *   Number of byes = P - N. (if N=13, byes = 3).
        3.  **Assign Byes and Matches for Round 1:**
            *   The teams with the *lowest* lot numbers (from the sorted list) receive a bye. For each of these teams, you MUST generate a match object.
            *   In this "bye" match, set 'team1Id' to the team's ID and 'team2Id' to the literal string "BYE".
            *   Set 'team2Name' and 'team2OrgName' to "BYE".
            *   Set the match 'status' to 'COMPLETED' and the 'winnerId' to the 'team1Id'.
            *   The remaining teams (those that did not get a bye) are paired up sequentially based on their position in the sorted list. For example, the team with the next lowest lot number plays the one after it, and so on.
            *   For these regular matches, set the initial 'status' of all generated matches to 'PENDING'.
        4.  **Set Round Number:** For ALL matches generated in this process (including bye matches), set the 'round' field to 1.

        **B. If 'tournamentType' is 'round-robin':**
        
        Follow this procedure for EACH event type category:
        1.  **Generate All Pairings:** Create a list of all possible unique pairings based on lot number.
        2.  **Set Initial Status:** Set the initial 'status' of all generated matches to 'PENDING'.
        3.  **Order by Lot Number**: Ensure the generated matches are ordered logically based on the lot numbers (e.g., pairings involving lower lot numbers appear first).

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
    // PRE-PROCESSING STEP: Embed organization name into each team object.
    const orgNameMap = new Map(input.organizations.map(org => [org.id, org.name]));
    
    const teamsWithOrgNames = input.teams.map(team => ({
      ...team,
      organizationName: orgNameMap.get(team.organizationId) || 'N/A',
    }));

    // Create the input for the prompt with the augmented team data.
    const promptInput = {
        ...input,
        teams: teamsWithOrgNames,
    };
    
    const { output } = await schedulePrompt(promptInput);
    
    if (!output) {
      throw new Error('Failed to generate a schedule.');
    }
    return output;
  }
);


export async function scheduleMatches(input: ScheduleMatchesInput): Promise<Omit<Match, 'id'>[]> {
    const result = await scheduleMatchesFlow(input);
    return result.matches;
}
