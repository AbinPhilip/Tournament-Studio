
'use server';
/**
 * @fileOverview A flow for updating the live score of a match.
 *
 * - updateLiveScore - Updates points and serving team for a match.
 * - UpdateLiveScoreInput - The input type for the updateLiveScore function.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Match } from '@/types';

const UpdateLiveScoreInputSchema = z.object({
  matchId: z.string(),
  team1Points: z.number().int().min(0),
  team2Points: z.number().int().min(0),
  servingTeamId: z.string(),
});

export type UpdateLiveScoreInput = z.infer<typeof UpdateLiveScoreInputSchema>;

const updateLiveScoreFlow = ai.defineFlow(
  {
    name: 'updateLiveScoreFlow',
    inputSchema: UpdateLiveScoreInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    const matchRef = doc(db, 'matches', input.matchId);
    
    // Check if match status needs to be updated to IN_PROGRESS
    const matchSnap = await getDoc(matchRef);
    if (!matchSnap.exists()) {
        throw new Error("Match not found");
    }
    const matchData = matchSnap.data() as Match;

    const updates: any = {
      'live.team1Points': input.team1Points,
      'live.team2Points': input.team2Points,
      'live.servingTeamId': input.servingTeamId,
    };
    
    // If the match is just starting, update its status.
    if (matchData.status === 'SCHEDULED') {
        updates.status = 'IN_PROGRESS';
    }

    await updateDoc(matchRef, updates);
  }
);

export async function updateLiveScore(input: UpdateLiveScoreInput): Promise<void> {
  await updateLiveScoreFlow(input);
}
