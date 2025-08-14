
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
import { collection, doc, getDoc, getDocs, writeBatch, query, where, Timestamp } from 'firebase/firestore';
import type { Match, Tournament } from '@/types';


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

async function findAvailableCourt(startTime: Date, courtNames: { name: string }[]): Promise<string | null> {
    const matchesRef = collection(db, 'matches');
    const startTimestamp = Timestamp.fromDate(startTime);
    
    // Check for matches starting at the exact same time
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
    const matchRef = doc(db, 'matches', input.matchId);
    const matchSnap = await getDoc(matchRef);

    if (!matchSnap.exists()) {
        throw new Error('Match not found');
    }
    const completedMatch = matchSnap.data() as Match;
    
    const updates: Partial<Match> = {};
    
    if (input.status === 'COMPLETED') {
        let finalWinnerId = input.winnerId;
        let scoreSummary = '';
        updates.scores = input.scores || [];

        if (input.isForfeited) {
            scoreSummary = 'Forfeited';
            // If forfeited, a winnerId must be provided to know who gets the win.
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
            
            // If winnerId is not provided, calculate it from scores.
            if (!finalWinnerId) {
                finalWinnerId = team1Sets > team2Sets ? completedMatch.team1Id : completedMatch.team2Id;
            }
        }
        
        updates.score = scoreSummary;
        updates.winnerId = finalWinnerId;
        updates.status = 'COMPLETED';

    } else { // Handle 'IN_PROGRESS' updates (e.g., finalizing a set)
        updates.status = 'IN_PROGRESS';
        if (input.scores) {
          updates.scores = input.scores;
        }
    }
    
    // Omit live updates when completing a match
    const finalUpdates: any = { ...updates };
    if (updates.status !== 'COMPLETED') {
        finalUpdates['live.currentSet'] = (updates.scores?.length || 0) + 1;
    }


    batch.update(matchRef, finalUpdates);


    // 2. If match is COMPLETED, check if it was a knockout match and if we need to schedule the next round
    const currentWinnerId = updates.winnerId;
    if (updates.status !== 'COMPLETED' || !currentWinnerId) {
        await batch.commit();
        return;
    }


    const tournamentSnap = await getDocs(collection(db, 'tournaments'));
    if (tournamentSnap.empty) {
        // Don't throw error, just commit what we have. Allows testing without full tournament setup.
        await batch.commit();
        return;
    }
    const tournament = tournamentSnap.docs[0].data() as Tournament;

    if (tournament.tournamentType === 'knockout' && completedMatch.round) {
        const matchesRef = collection(db, 'matches');
        
        // Find a potential opponent from completed matches in the same round who hasn't been scheduled for the next round
        const opponentQuery = query(
            matchesRef,
            where('eventType', '==', completedMatch.eventType),
            where('round', '==', completedMatch.round),
            where('status', '==', 'COMPLETED')
        );
        const opponentSnap = await getDocs(opponentQuery);
        
        const potentialOpponents = opponentSnap.docs
            .map(doc => doc.data())
            .filter(match => match.winnerId && match.winnerId !== 'BYE' && match.winnerId !== currentWinnerId);


        const nextRoundQuery = query(matchesRef, where('round', '==', completedMatch.round + 1), where('eventType', '==', completedMatch.eventType));
        const nextRoundSnap = await getDocs(nextRoundQuery);
        const scheduledIds = new Set(nextRoundSnap.docs.flatMap(d => [d.data().team1Id, d.data().team2Id]));
        
        // Check if the current winner is already scheduled
        if (scheduledIds.has(currentWinnerId)) {
            await batch.commit();
            return;
        }
        
        const opponentDocData = potentialOpponents.find(match => !scheduledIds.has(match.winnerId));

        if (opponentDocData) {
             const opponentWinnerId = opponentDocData.winnerId;
            // We have a pair! Schedule the next match.
            const winnerTeamRef = doc(db, 'teams', currentWinnerId);
            const opponentTeamRef = doc(db, 'teams', opponentWinnerId!);
            
            const [winnerTeamSnap, opponentTeamSnap] = await Promise.all([getDoc(winnerTeamRef), getDoc(opponentTeamRef)]);
            if (!winnerTeamSnap.exists() || !opponentTeamSnap.exists()) {
                 console.warn("Could not find winning teams to schedule next round. Committing partial results.");
                 await batch.commit();
                 return;
            }
            const winnerTeam = winnerTeamSnap.data();
            const opponentTeam = opponentTeamSnap.data();

            // Find an available court and time slot
            let matchTime = completedMatch.startTime instanceof Timestamp ? completedMatch.startTime.toDate() : new Date();
            let availableCourt: string | null = null;
            let attempts = 0;
            const maxAttempts = 48 * 4; // Look for a slot in the next 48 hours in 15-minute increments
            
            while (attempts < maxAttempts) {
                matchTime.setMinutes(matchTime.getMinutes() + 15); 
                
                if (matchTime.getHours() >= 20) { // If past 8 PM
                    matchTime.setDate(matchTime.getDate() + 1);
                    matchTime.setHours(9, 0, 0, 0); // Reset to 9 AM next day
                }
                 if (matchTime.getHours() < 9) { // If before 9 AM
                    matchTime.setHours(9, 0, 0, 0);
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
                    team2Id: opponentWinnerId!,
                    team1Name: winnerTeam.player1Name + (winnerTeam.player2Name ? ` & ${winnerTeam.player2Name}` : ''),
                    team2Name: opponentTeam.player1Name + (opponentTeam.player2Name ? ` & ${opponentTeam.player2Name}` : ''),
                    eventType: completedMatch.eventType,
                    courtName: '', // Unassigned initially
                    startTime: Timestamp.fromDate(matchTime),
                    status: 'PENDING',
                    round: completedMatch.round + 1,
                };
                batch.set(newMatchRef, newMatchData);
            } else {
                 console.warn(`Could not find an available court for match in event ${completedMatch.eventType}, round ${completedMatch.round + 1}.`);
            }
        }
    }

    await batch.commit();
  }
);


export async function recordMatchResult(input: RecordMatchResultInput): Promise<void> {
    await recordMatchResultFlow(input);
}
