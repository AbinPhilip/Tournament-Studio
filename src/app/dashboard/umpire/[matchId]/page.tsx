
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import type { Match } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Send, Repeat, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { updateLiveScore } from '@/ai/flows/update-live-score-flow';
import { recordMatchResult } from '@/ai/flows/record-match-result-flow';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// Main component
export default function LiveScorerPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const matchId = params.matchId as string;

    const [match, setMatch] = useState<Match | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Subscribe to live match updates
    useEffect(() => {
        if (!matchId) return;
        const matchRef = doc(db, 'matches', matchId);
        const unsubscribe = onSnapshot(matchRef, (doc) => {
            if (doc.exists()) {
                const matchData = { id: doc.id, ...doc.data() } as Match;
                 // Initialize live data if it doesn't exist
                if (!matchData.live) {
                    matchData.live = {
                        team1Points: 0,
                        team2Points: 0,
                        servingTeamId: matchData.team1Id,
                        currentSet: (matchData.scores?.length || 0) + 1,
                    };
                }
                setMatch(matchData);
            } else {
                toast({ title: "Error", description: "Match not found.", variant: 'destructive' });
                router.push('/dashboard/umpire');
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [matchId, router, toast]);

    const handlePointChange = async (team: 'team1' | 'team2', delta: 1 | -1) => {
        if (!match?.live || isSubmitting) return;
        const newPoints = team === 'team1' ? match.live.team1Points + delta : match.live.team2Points + delta;
        if (newPoints < 0) return;

        setIsSubmitting(true);
        try {
            await updateLiveScore({
                matchId,
                team1Points: team === 'team1' ? newPoints : match.live.team1Points,
                team2Points: team === 'team2' ? newPoints : match.live.team2Points,
                servingTeamId: match.live.servingTeamId,
            });
        } catch (error) {
            toast({ title: "Error", description: "Failed to update score.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleServiceChange = async () => {
        if (!match?.live || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await updateLiveScore({
                matchId,
                team1Points: match.live.team1Points,
                team2Points: match.live.team2Points,
                servingTeamId: match.live.servingTeamId === match.team1Id ? match.team2Id : match.team1Id,
            });
        } catch (error) {
            toast({ title: "Error", description: "Failed to change service.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFinalizeSet = async () => {
        if (!match?.live) return;
        setIsSubmitting(true);
        try {
            const newScores = [...(match.scores || [])];
            newScores.push({ team1: match.live.team1Points, team2: match.live.team2Points });
            
            await recordMatchResult({
                matchId: match.id,
                scores: newScores,
                status: 'IN_PROGRESS', // Keep it in progress
            });

            // Reset live data for the next set
            await updateLiveScore({
                matchId,
                team1Points: 0,
                team2Points: 0,
                servingTeamId: match.team1Id, // Reset service to team 1 for simplicity
            });

            toast({ title: "Set Finalized", description: `Set ${match.live.currentSet} score has been recorded.` });

        } catch (error) {
            toast({ title: "Error", description: "Could not finalize set.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleFinalizeMatch = async (winnerId: string, isForfeited = false) => {
         if (!match) return;
         setIsSubmitting(true);
         try {
            let finalScores = [...(match.scores || [])];
            // Add the current set's score if it hasn't been added yet
            if (match.live && (match.live.team1Points > 0 || match.live.team2Points > 0)) {
                 finalScores.push({ team1: match.live.team1Points, team2: match.live.team2Points });
            }

            await recordMatchResult({
                matchId: match.id,
                scores: finalScores,
                winnerId: winnerId,
                isForfeited,
                status: 'COMPLETED',
            });
             toast({ title: "Match Finalized!", description: "The final result has been recorded." });
             router.push('/dashboard/umpire');
         } catch(e) {
             toast({ title: "Error", description: "Could not finalize match.", variant: "destructive" });
         } finally {
             setIsSubmitting(false);
         }
    };
    
    // Game logic calculations
    const { isDeuce, team1MatchPoint, team2MatchPoint } = useMemo(() => {
        if (!match?.live) return { isDeuce: false, team1MatchPoint: false, team2MatchPoint: false };
        const { team1Points, team2Points } = match.live;
        const deuce = team1Points >= 20 && team1Points === team2Points;
        const matchPoint = (points: number, otherPoints: number) => {
            if (points < 20) return false;
            if (points === 29 && otherPoints === 29) return true;
            if (points >= 20 && otherPoints >= 20) return points === otherPoints + 1;
            return points === 20; // Reaching 21 first
        };
        return {
            isDeuce: deuce,
            team1MatchPoint: matchPoint(team1Points, team2Points),
            team2MatchPoint: matchPoint(team2Points, team1Points)
        };
    }, [match]);
    
    const canFinalizeSet = useMemo(() => {
        if (!match?.live) return false;
        const { team1Points, team2Points } = match.live;
        const p1 = Math.max(team1Points, team2Points);
        const p2 = Math.min(team1Points, team2Points);

        if (p1 >= 30) return true; // Game ends at 30
        if (p1 >= 21 && (p1 - p2 >= 2)) return true; // Win by 2 points
        return false;
    }, [match]);

    if (isLoading || !match) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-16 w-16 animate-spin" /></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start flex-wrap gap-4">
                        <div>
                            <CardTitle className="text-2xl md:text-3xl">Live Scorer</CardTitle>
                            <CardDescription>Court: {match.courtName}</CardDescription>
                        </div>
                         <Button variant="outline" onClick={() => router.push('/dashboard/umpire')}>
                            <ArrowLeft /> Back to Umpire View
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                   {/* Scoreboard */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 items-center text-center">
                       <TeamScorePanel 
                            teamName={match.team1Name} 
                            points={match.live?.team1Points || 0}
                            isServing={match.live?.servingTeamId === match.team1Id}
                            onPointChange={(delta) => handlePointChange('team1', delta)}
                            isMatchPoint={team1MatchPoint}
                       />
                       <TeamScorePanel 
                            teamName={match.team2Name} 
                            points={match.live?.team2Points || 0}
                            isServing={match.live?.servingTeamId === match.team2Id}
                            onPointChange={(delta) => handlePointChange('team2', delta)}
                            isMatchPoint={team2MatchPoint}
                       />
                    </div>
                    
                    {/* Game State Indicator */}
                    {(isDeuce || team1MatchPoint || team2MatchPoint) &&
                        <div className="text-center font-bold text-2xl text-accent animate-pulse">
                            {isDeuce ? "DEUCE" : "MATCH POINT"}
                        </div>
                    }

                    {/* Previous Sets */}
                    {match.scores && match.scores.length > 0 && (
                        <div>
                            <h3 className="font-semibold text-lg mb-2">Previous Sets</h3>
                            <div className="flex gap-4 text-muted-foreground">
                                {match.scores.map((s, i) => <span key={i}>Set {i+1}: {s.team1} - {s.team2}</span>)}
                            </div>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="border-t pt-6 flex flex-wrap gap-4 justify-center">
                        <Button variant="secondary" onClick={handleServiceChange} disabled={isSubmitting}>
                            <Repeat className="mr-2"/> Change Service
                        </Button>
                        <Button variant="default" onClick={handleFinalizeSet} disabled={!canFinalizeSet || isSubmitting}>
                            <Send className="mr-2"/> Finalize Set {match.live?.currentSet}
                        </Button>

                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isSubmitting}>Finalize Match</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Finalize Match?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Select the winner or declare a forfeit. This action is final and will record the match result.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="sm:justify-center gap-4">
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <Button onClick={() => handleFinalizeMatch(match.team1Id, true)}>Forfeit by {match.team2Name}</Button>
                                <Button onClick={() => handleFinalizeMatch(match.team2Id, true)}>Forfeit by {match.team1Name}</Button>
                                <AlertDialogAction asChild>
                                    <Button onClick={() => handleFinalizeMatch(match.live && match.live.team1Points > match.live.team2Points ? match.team1Id : match.team2Id)} className="bg-green-600 hover:bg-green-700">
                                         <CheckCircle className="mr-2"/> Declare Winner
                                    </Button>
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                    </div>
                </CardContent>
            </Card>
        </div>
    );
}


// Helper component for team panel
function TeamScorePanel({ teamName, points, isServing, onPointChange, isMatchPoint }: { teamName: string, points: number, isServing: boolean, onPointChange: (delta: 1 | -1) => void, isMatchPoint: boolean }) {
    return (
        <div className={`p-6 rounded-lg border-4 ${isServing ? 'border-primary shadow-lg' : 'border-transparent'}`}>
            <h3 className="text-xl font-semibold mb-4 truncate">{teamName}</h3>
            <p className={`text-7xl font-bold mb-4 ${isMatchPoint ? 'text-accent' : ''}`}>{points}</p>
            <div className="flex justify-center gap-2">
                <Button onClick={() => onPointChange(1)} size="lg">+</Button>
                <Button onClick={() => onPointChange(-1)} size="lg" variant="outline">-</Button>
            </div>
            {isServing && <div className="mt-4 text-sm font-semibold text-primary">SERVING</div>}
        </div>
    );
}
