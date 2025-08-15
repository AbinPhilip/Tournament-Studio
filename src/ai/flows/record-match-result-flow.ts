
'use server';
/**
 * @fileOverview A flow for recording a match result and scheduling the next knockout round if applicable.
 *
 * - recordMatchResult - Records a score, sets a winner, and may trigger the next round.
 * - RecordMatchResultInput - The input type for the recordMatchResult function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, writeBatch, query, where, Timestamp, updateDoc } from 'firebase/firestore';
import type { Match, Tournament, Organization, Team, TeamType } from '@/types';


const RecordMatchResultInputSchema = z.object({
  matchId: z.string(),
  scores: z.array(z.object({
      team1: z.coerce.number().int().min(0),
      team2: z.coerce.number().int().min(0),
  })).optional(),
  winnerId: z.string().optional(),
  isForfeited: z.boolean().optional(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED']).optional(),
});
export type RecordMatchResultInput = z.infer<typeof RecordMatchResultInputSchema>;


const getTotalRounds = (teamCount: number) => {
    if (teamCount < 2) return 0;
    return Math.ceil(Math.log2(teamCount));
};

const recordMatchResultFlow = ai.defineFlow(
  {
    name: 'recordMatchResultFlow',
    inputSchema: RecordMatchResultInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    const batch = writeBatch(db);
    const matchRef = doc(db, 'matches', input.matchId);
    const matchSnap = await getDoc(matchRef);

    if (!matchSnap.exists()) {
        throw new Error('Match not found');
    }
    const completedMatch = matchSnap.data() as Match;
    
    const updates: Partial<Match> & { 'live.currentSet'?: number, 'live.team1Points'?: number, 'live.team2Points'?: number } = {};
    
    if (input.status === 'COMPLETED') {
        let finalWinnerId = input.winnerId;
        let scoreSummary = '';
        updates.scores = input.scores || [];

        if (input.isForfeited) {
            scoreSummary = 'Forfeited';
            if (input.winnerId) {
                 updates.forfeitedById = input.winnerId === completedMatch.team1Id ? completedMatch.team2Id : completedMatch.team1Id;
            }
        } else if (updates.scores.length > 0) {
            let team1Sets = 0;
            let team2Sets = 0;
            updates.scores.forEach(set => {
                if(set.team1 > set.team2) team1Sets++;
                else team2Sets++;
            });
            scoreSummary = `${team1Sets}-${team2Sets}`;
            
            if (!finalWinnerId) {
                finalWinnerId = team1Sets > team2Sets ? completedMatch.team1Id : completedMatch.team2Id;
            }
        }
        
        updates.score = scoreSummary;
        updates.winnerId = finalWinnerId || completedMatch.team2Id;
        updates.status = 'COMPLETED';
        updates.live = null; // Clear live data on completion

        // Calculate and store point differential
        if (updates.scores && updates.scores.length > 0 && !input.isForfeited && updates.winnerId) {
            const totalScoreWinner = updates.scores.reduce((sum, set) => sum + (updates.winnerId === completedMatch.team1Id ? set.team1 : set.team2), 0);
            const totalScoreLoser = updates.scores.reduce((sum, set) => sum + (updates.winnerId === completedMatch.team1Id ? set.team2 : set.team1), 0);
            updates.pointDifferential = totalScoreWinner - totalScoreLoser;
        } else {
            updates.pointDifferential = 0;
        }

    } else { // Handle 'IN_PROGRESS' updates (e.g., finalizing a set)
        updates.status = 'IN_PROGRESS';
        if (input.scores) {
          updates.scores = input.scores;
        }
    }
    
    const finalUpdates: any = { ...updates };
    if (updates.status !== 'COMPLETED' && updates.scores) {
      finalUpdates['live.currentSet'] = updates.scores.length + 1;
      finalUpdates['live.team1Points'] = 0;
      finalUpdates['live.team2Points'] = 0;
    } else if (updates.status === 'COMPLETED') {
        // Use a non-batched update here to ensure live is cleared before batch commit
        await updateDoc(matchRef, { live: null, lastUpdateTime: Timestamp.now() });
        delete finalUpdates.live;
    }

    batch.update(matchRef, { ...finalUpdates, lastUpdateTime: Timestamp.now() });

    // 2. If match is COMPLETED, check if it was a knockout match and if we need to schedule the next round
    const currentWinnerId = updates.winnerId;
    if (updates.status !== 'COMPLETED' || !currentWinnerId) {
        await batch.commit();
        return;
    }


    const tournamentSnap = await getDocs(collection(db, 'tournaments'));
    if (tournamentSnap.empty) {
        await batch.commit();
        return;
    }
    const tournament = tournamentSnap.docs[0].data() as Tournament;

    if (tournament.tournamentType === 'knockout' && completedMatch.round) {
        const matchesRef = collection(db, 'matches');
        
        // Query for all matches in the same round and event
        const currentRoundQuery = query(
            matchesRef,
            where('eventType', '==', completedMatch.eventType),
            where('round', '==', completedMatch.round)
        );
        const currentRoundSnap = await getDocs(currentRoundQuery);
        
        const roundMatchesMap = new Map(currentRoundSnap.docs.map(doc => [doc.id, doc.data() as Match]));
        roundMatchesMap.set(input.matchId, { ...completedMatch, ...updates, lastUpdateTime: Timestamp.now() } as Match);

        const allMatchesInRoundCompleted = Array.from(roundMatchesMap.values()).every(
            match => match.status === 'COMPLETED'
        );

        if (!allMatchesInRoundCompleted) {
            await batch.commit();
            return;
        }

        // All matches in the round are complete, proceed to schedule next round.
        
        const allTeamsSnap = await getDocs(collection(db, "teams"));
        const teamCounts = allTeamsSnap.docs.reduce((acc, doc) => {
            const team = doc.data() as Team;
            if (!acc[team.type]) acc[team.type] = 0;
            acc[team.type]++;
            return acc;
        }, {} as Record<TeamType, number>);

        const totalRounds = getTotalRounds(teamCounts[completedMatch.eventType] || 0);
        const isFinalRound = completedMatch.round === totalRounds;
        const isSemiFinalRound = completedMatch.round === totalRounds - 1;
        
        if (completedMatch.round >= totalRounds) {
            await batch.commit();
            return; // It was the final round, nothing more to schedule.
        }

        // Hold scheduling for semi-finals and finals
        if (isSemiFinalRound || isFinalRound) {
            const allMatchesSnap = await getDocs(matchesRef);
            const allMatches = allMatchesSnap.docs.map(d => d.data() as Match);

            // Check if all non-final/semi-final rounds in all event types are complete
            const allPrelimsDone = allMatches.every(m => {
                const eventTeamCount = teamCounts[m.eventType] || 0;
                const eventTotalRounds = getTotalRounds(eventTeamCount);
                const mIsSemiOrFinal = m.round === eventTotalRounds || m.round === eventTotalRounds - 1;
                return m.status === 'COMPLETED' || mIsSemiOrFinal;
            });

            if (!allPrelimsDone) {
                await batch.commit(); // Not all prelims are done, so wait.
                return;
            }
        }
        
        const roundMatches = Array.from(roundMatchesMap.values());
        
        // Get winners and calculate point differentials for sorting
        const winnersWithScores = roundMatches
            .filter(match => match.winnerId && match.winnerId !== 'BYE')
            .map(match => {
                const winnerId = match.winnerId!;
                let pointDiff = 0;

                if (match.team2Id === 'BYE' && match.round === 1) {
                    pointDiff = 0; 
                } else if (match.pointDifferential) {
                    pointDiff = match.pointDifferential;
                } else if (match.scores && match.scores.length > 0) {
                    const totalScoreWinner = match.scores.reduce((sum, set) => sum + (winnerId === match.team1Id ? set.team1 : set.team2), 0);
                    const totalScoreLoser = match.scores.reduce((sum, set) => sum + (winnerId === match.team1Id ? set.team2 : set.team1), 0);
                    pointDiff = totalScoreWinner - totalScoreLoser;
                }
                return { winnerId, pointDiff };
            });

        winnersWithScores.sort((a, b) => b.pointDiff - a.pointDiff);
        
        let winnersToSchedule = winnersWithScores;
        
        // If there's an odd number of winners, the top scorer gets a bye
        if (winnersToSchedule.length % 2 !== 0 && winnersToSchedule.length > 1) {
            
            // Find teams that have already had a BYE in this event
            const byeHistoryQuery = query(matchesRef, where('eventType', '==', completedMatch.eventType), where('team2Id', '==', 'BYE'));
            const byeHistorySnap = await getDocs(byeHistoryQuery);
            const teamsWithPastByes = new Set(byeHistorySnap.docs.map(doc => doc.data().team1Id));

            // Find the highest-ranked winner who hasn't had a BYE yet
            const byeWinnerIndex = winnersToSchedule.findIndex(w => !teamsWithPastByes.has(w.winnerId));

            if (byeWinnerIndex !== -1) {
                const [byeWinner] = winnersToSchedule.splice(byeWinnerIndex, 1); // Remove the eligible winner
                const byeWinnerId = byeWinner.winnerId;

                const byeWinnerTeamSnap = await getDoc(doc(db, 'teams', byeWinnerId));
                if (byeWinnerTeamSnap.exists()) {
                    const byeWinnerTeam = byeWinnerTeamSnap.data() as Team;
                    const orgsCollection = await getDocs(collection(db, 'organizations'));
                    const orgNameMap = new Map(orgsCollection.docs.map(doc => [doc.id, doc.data().name]));

                    const byeMatchRef = doc(collection(db, 'matches'));
                    const byeMatchData: Omit<Match, 'id'> = {
                        team1Id: byeWinnerId,
                        team2Id: 'BYE',
                        team1Name: byeWinnerTeam.player1Name + (byeWinnerTeam.player2Name ? ` & ${byeWinnerTeam.player2Name}` : ''),
                        team2Name: 'BYE',
                        team1OrgName: orgNameMap.get(byeWinnerTeam.organizationId) || '',
                        team2OrgName: 'BYE',
                        eventType: completedMatch.eventType,
                        courtName: '', 
                        startTime: Timestamp.now(),
                        lastUpdateTime: Timestamp.now(),
                        status: 'COMPLETED',
                        winnerId: byeWinnerId,
                        round: completedMatch.round + 1,
                        score: 'BYE'
                    };
                    batch.set(byeMatchRef, byeMatchData);
                }
            }
        }

        const nextRoundQuery = query(matchesRef, where('round', '==', completedMatch.round + 1), where('eventType', '==', completedMatch.eventType));
        const nextRoundSnap = await getDocs(nextRoundQuery);
        const scheduledIds = new Set(nextRoundSnap.docs.flatMap(d => [d.data().team1Id, d.data().team2Id]));

        const finalWinnersToSchedule = winnersToSchedule.filter(w => !scheduledIds.has(w.winnerId));

        // Implement seeded pairing: 1 vs n, 2 vs n-1, etc.
        let left = 0;
        let right = finalWinnersToSchedule.length - 1;

        while (left < right) {
             const team1Id = finalWinnersToSchedule[left].winnerId;
             const team2Id = finalWinnersToSchedule[right].winnerId;

            const team1Snap = await getDoc(doc(db, 'teams', team1Id));
            const team2Snap = await getDoc(doc(db, 'teams', team2Id));

            if (!team1Snap.exists() || !team2Snap.exists()) {
                 console.warn("Could not find one or both winning teams to schedule next round.");
                 left++;
                 right--;
                 continue;
            }
            const team1 = team1Snap.data() as Team;
            const team2 = team2Snap.data() as Team;

            const orgsCollection = await getDocs(collection(db, 'organizations'));
            const orgNameMap = new Map(orgsCollection.docs.map(doc => [doc.id, doc.data().name]));
            
            // Create the new match fixture without assigning court or time.
            const newMatchRef = doc(collection(db, 'matches'));
            const newMatchData: Omit<Match, 'id'> = {
                team1Id: team1Id,
                team2Id: team2Id,
                team1Name: team1.player1Name + (team1.player2Name ? ` & ${team1.player2Name}` : ''),
                team2Name: team2.player1Name + (team2.player2Name ? ` & ${team2.player2Name}` : ''),
                team1OrgName: orgNameMap.get(team1.organizationId) || '',
                team2OrgName: orgNameMap.get(team2.organizationId) || '',
                eventType: completedMatch.eventType,
                courtName: '', // Left blank for manual assignment
                startTime: Timestamp.now(), // Placeholder time
                status: 'PENDING', // Set to PENDING for manual scheduling
                round: completedMatch.round + 1,
            };
            batch.set(newMatchRef, newMatchData);
            
            left++;
            right--;
        }
    }

    await batch.commit();
  }
);


export async function recordMatchResult(input: RecordMatchResultInput): Promise<void> {
    await recordMatchResultFlow(input);
}
