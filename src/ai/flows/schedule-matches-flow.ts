
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
import type { Team, Tournament, Match, Organization, TeamType } from '@/types';

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
    name: z.string(),
    hostName: z.string().optional(),
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
    location: z.string().optional(),
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
    winnerId: z.string().optional(),
});

const ScheduleMatchesOutputSchema = z.object({
    matches: z.array(MatchSchema),
});
export type ScheduleMatchesOutput = z.infer<typeof ScheduleMatchesOutputSchema>;



const scheduleMatchesFlow = ai.defineFlow(
  {
    name: 'scheduleMatchesFlow',
    inputSchema: ScheduleMatchesInputSchema,
    outputSchema: ScheduleMatchesOutputSchema,
  },
  async (input): Promise<ScheduleMatchesOutput> => {
    
    const orgNameMap = new Map(input.organizations.map(org => [org.id, org.name]));
    const allMatches: Omit<Match, 'id'>[] = [];
    const eventTypes: TeamType[] = ['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles'];

    for (const eventType of eventTypes) {
        const eventTeams = input.teams
            .filter(t => t.type === eventType)
            .sort((a, b) => (a.lotNumber ?? Infinity) - (b.lotNumber ?? Infinity));
        
        const teamCount = eventTeams.length;
        if (teamCount < 2) continue; // Skip if not enough teams for a match
        
        if (input.tournament.tournamentType === 'knockout') {
            const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(teamCount)));
            const byes = nextPowerOf2 - teamCount;

            // Teams with the lowest lot numbers get byes.
            const teamsWithByes = eventTeams.slice(0, byes);
            const teamsInMatches = eventTeams.slice(byes);


            // Create "BYE" matches for the teams that get a pass to the next round.
            for (const team of teamsWithByes) {
                allMatches.push({
                    team1Id: team.id,
                    team2Id: 'BYE',
                    team1Name: team.player1Name + (team.player2Name ? ` & ${team.player2Name}` : ''),
                    team2Name: 'BYE',
                    team1OrgName: orgNameMap.get(team.organizationId) || '',
                    team2OrgName: 'BYE',
                    eventType: eventType,
                    status: 'COMPLETED',
                    winnerId: team.id,
                    round: 1,
                    score: 'BYE'
                });
            }
            
            // Create regular Round 1 matches for the remaining teams, pairing them sequentially.
            for (let i = 0; i < teamsInMatches.length; i += 2) {
                 if (i + 1 < teamsInMatches.length) {
                    const team1 = teamsInMatches[i];
                    const team2 = teamsInMatches[i + 1];
                     allMatches.push({
                        team1Id: team1.id,
                        team2Id: team2.id,
                        team1Name: team1.player1Name + (team1.player2Name ? ` & ${team1.player2Name}` : ''),
                        team2Name: team2.player1Name + (team2.player2Name ? ` & ${team2.player2Name}` : ''),
                        team1OrgName: orgNameMap.get(team1.organizationId) || '',
                        team2OrgName: orgNameMap.get(team2.organizationId) || '',
                        eventType: eventType,
                        status: 'PENDING',
                        round: 1
                    });
                 }
            }
        } else { // Round Robin
             for (let i = 0; i < teamCount; i++) {
                for (let j = i + 1; j < teamCount; j++) {
                    const team1 = eventTeams[i];
                    const team2 = eventTeams[j];
                    allMatches.push({
                        team1Id: team1.id,
                        team2Id: team2.id,
                        team1Name: team1.player1Name + (team1.player2Name ? ` & ${team1.player2Name}` : ''),
                        team2Name: team2.player1Name + (team2.player2Name ? ` & ${team2.player2Name}` : ''),
                        team1OrgName: orgNameMap.get(team1.organizationId) || '',
                        team2OrgName: orgNameMap.get(team2.organizationId) || '',
                        eventType: eventType,
                        status: 'PENDING',
                        // round is not typically used in round-robin like this, but can be set to 1
                        round: 1 
                    });
                }
            }
        }
    }

    return { matches: allMatches as Match[] };
  }
);


export async function scheduleMatches(input: ScheduleMatchesInput): Promise<Omit<Match, 'id'>[]> {
    const result = await scheduleMatchesFlow(input);
    return result.matches;
}
