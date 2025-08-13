
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
import { collection, doc, getDoc, getDocs, writeBatch, query, where, addDoc, Timestamp } from 'firebase/firestore';
import type { Match, Tournament, TeamType } from '@/types';


const RecordMatchResultInputSchema = z.object({
  matchId: z.string(),
  score: z.string().regex(/^\d{1,2}-\d{1,2}$/),
  winnerId: z.string(),
});
export type RecordMatchResultInput = z.infer<typeof RecordMatchResultInputSchema>;

async function findAvailableCourt(startTime: Date, courtNames: { name: string }[]): Promise<string | null> {
    const matchesRef = collection(db, 'matches');
    const startTimestamp = Timestamp.fromDate(startTime);
    const q = query(matchesRef, where('startTime', '==', startTimestamp));
    const snapshot = await getDocs(q);

    const busyCourts = new Set(snapshot.docs.map(doc => doc.data().courtName));
    
    for (const court of courtNames) {
        if (!busyCourts.has(court.name)) {
            return court.name;
        }
    }
    return null; // All courts at this specific time are busy
}

const recordMatchResultFlow = ai.defineFlow(
  {
    name: 'recordMatchResultFlow',
    inputSchema: RecordMatchResultInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    const batch = writeBatch(db);

    // 1. Update the completed match
    const matchRef = doc(db, 'matches', input.matchId);
    const matchSnap = await getDoc(matchRef);
    if (!matchSnap.exists()) {
        throw new Error('Match not found');
    }
    const completedMatch = matchSnap.data() as Match;

    batch.update(matchRef, {
        score: input.score,
        winnerId: input.winnerId,
        status: 'COMPLETED',
    });

    // 2. Check if this was a knockout match and if we need to schedule the next round
    const tournamentSnap = await getDocs(collection(db, 'tournaments'));
    if (tournamentSnap.empty) {
        throw new Error('Tournament not found');
    }
    const tournament = tournamentSnap.docs[0].data() as Tournament;

    if (tournament.tournamentType === 'knockout' && completedMatch.round) {
        const matchesRef = collection(db, 'matches');
        
        // Find other completed matches in the same round to find a potential opponent
        const q = query(
            matchesRef,
            where('eventType', '==', completedMatch.eventType),
            where('round', '==', completedMatch.round),
            where('status', '==', 'COMPLETED')
        );
        
        const completedRoundMatchesSnap = await getDocs(q);
        const winnersInRound = completedRoundMatchesSnap.docs.map(d => d.data().winnerId).filter(Boolean);

        const currentWinnerId = input.winnerId;

        // Check if the current winner is already scheduled in the next round
        const nextRoundQuery = query(
            matchesRef,
            where('round', '==', completedMatch.round + 1),
            where('eventType', '==', completedMatch.eventType)
        );
        const nextRoundMatchesSnap = await getDocs(nextRoundQuery);
        const scheduledNextRoundIds = new Set(nextRoundMatchesSnap.docs.flatMap(doc => [doc.data().team1Id, doc.data().team2Id]));

        if (scheduledNextRoundIds.has(currentWinnerId)) {
            // This winner is already scheduled, no action needed.
            await batch.commit();
            return;
        }

        // Find an opponent who is also a winner and is not yet scheduled for the next round
        const opponentWinnerId = winnersInRound.find(id => id !== currentWinnerId && !scheduledNextRoundIds.has(id));

        if (opponentWinnerId) {
            // We have a pair! Schedule the next match.
            const winnerTeamRef = doc(db, 'teams', currentWinnerId);
            const opponentTeamRef = doc(db, 'teams', opponentWinnerId);
            
            const [winnerTeamSnap, opponentTeamSnap] = await Promise.all([getDoc(winnerTeamRef), getDoc(opponentTeamRef)]);
            if (!winnerTeamSnap.exists() || !opponentTeamSnap.exists()) {
                 throw new Error("Could not find winning teams to schedule next round.")
            }
            const winnerTeam = winnerTeamSnap.data();
            const opponentTeam = opponentTeamSnap.data();

            // Find an available court and time slot
            let matchTime = (completedMatch.startTime as Timestamp).toDate();
            let availableCourt: string | null = null;
            let attempts = 0;
            // Look for a slot in the next 48 hours
            while (attempts < 48) {
                matchTime.setHours(matchTime.getHours() + 1); // Check next hour
                // Reset to 9 AM next day if past 8 PM
                if (matchTime.getHours() > 20) {
                    matchTime.setDate(matchTime.getDate() + 1);
                    matchTime.setHours(9);
                }

                availableCourt = await findAvailableCourt(matchTime, tournament.courtNames);
                if (availableCourt) {
                    break;
                }
                attempts++;
            }

            if (availableCourt) {
                const newMatchRef = doc(collection(db, 'matches'));
                const newMatchData: Omit<Match, 'id'> = {
                    team1Id: currentWinnerId,
                    team2Id: opponentWinnerId,
                    team1Name: winnerTeam.player1Name + (winnerTeam.player2Name ? ` & ${winnerTeam.player2Name}` : ''),
                    team2Name: opponentTeam.player1Name + (opponentTeam.player2Name ? ` & ${opponentTeam.player2Name}` : ''),
                    eventType: completedMatch.eventType,
                    courtName: availableCourt,
                    startTime: Timestamp.fromDate(matchTime),
                    status: 'SCHEDULED',
                    round: completedMatch.round + 1,
                };
                batch.set(newMatchRef, newMatchData);
            }
        }
    }

    await batch.commit();
  }
);


export async function recordMatchResult(input: RecordMatchResultInput): Promise<void> {
    await recordMatchResultFlow(input);
}
