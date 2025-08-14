
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, collection, getDocs, Unsubscribe } from 'firebase/firestore';
import type { Match, Tournament } from '@/types';
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
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Subscribe to live match updates
    useEffect(() => {
        if (!matchId) return;
        
        let unsubscribe: Unsubscribe | undefined;

        const fetchInitialData = async () => {
             try {
                const tournamentSnap = await getDocs(collection(db, 'tournaments'));
                if (!tournamentSnap.empty) {
                    setTournament(tournamentSnap.docs[0].data() as Tournament);
                }

                const matchRef = doc(db, 'matches', matchId);
                unsubscribe = onSnapshot(matchRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const matchData = { id: docSnap.id, ...docSnap.data() } as Match;
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

            } catch (error) {
                console.error("Error fetching initial data: ", error);
                toast({ title: "Error", description: "Could not load match data.", variant: "destructive"});
                setIsLoading(false);
            }
        }

        fetchInitialData();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
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
            // Add the current set's score if it hasn't been added yet and it's not a forfeit
            if (!isForfeited && match.live && (match.live.team1Points > 0 || match.live.team2Points > 0)) {
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
    
    const pointsToWinSet = tournament?.pointsPerSet || 21;
    
    // Game logic calculations
    const { isDeuce, team1MatchPoint, team2MatchPoint } = useMemo(() => {
        if (!match?.live) return { isDeuce: false, team1MatchPoint: false, team2MatchPoint: false };
        const { team1Points, team2Points } = match.live;
        const deucePoint = pointsToWinSet - 1;
        
        const deuce = team1Points >= deucePoint && team1Points === team2Points;
        const matchPoint = (points: number, otherPoints: number) => {
            if (points < deucePoint) return false;
            // The score is 29-29 in a 30-point game, or (pointsToWinSet-1) in others
            if (points === (pointsToWinSet > 21 ? 29 : deucePoint) && points === otherPoints) return true;
            if (points >= deucePoint && otherPoints >= deucePoint) return points === otherPoints + 1;
            return points === deucePoint; // Reaching win-point first
        };
        return {
            isDeuce: deuce,
            team1MatchPoint: matchPoint(team1Points, team2Points),
            team2MatchPoint: matchPoint(team2Points, team1Points)
        };
    }, [match, pointsToWinSet]);
    
    const canFinalizeSet = useMemo(() => {
        if (!match?.live) return false;
        const { team1Points, team2Points } = match.live;
        const p1 = Math.max(team1Points, team2Points);
        const p2 = Math.min(team1Points, team2Points);
        
        // For standard 21 point games, win cap is 30. We can generalize this.
        const cap = pointsToWinSet > 21 ? 30 : pointsToWinSet + 9; 

        if (p1 >= cap) return true; // Win by reaching cap
        if (p1 >= pointsToWinSet && (p1 - p2 >= 2)) return true; // Win by 2 points
        return false;
    }, [match, pointsToWinSet]);
    
    const canFinalizeMatch = useMemo(() => {
        if (!match || !tournament?.bestOf) return false;
        const setsToWin = Math.ceil(tournament.bestOf / 2);
        
        let team1Sets = 0;
        let team2Sets = 0;
        (match.scores || []).forEach(set => {
            if (set.team1 > set.team2) team1Sets++;
            else team2Sets++;
        });

        return team1Sets >= setsToWin || team2Sets >= setsToWin;
    }, [match, tournament]);


    if (isLoading || !match || !tournament) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-16 w-16 animate-spin" /></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start flex-wrap gap-4">
                        <div>
                            <CardTitle className="text-2xl md:text-3xl">Live Scorer</CardTitle>
                            <CardDescription>Court: {match.courtName} / Best of {tournament.bestOf} sets / {pointsToWinSet} points per set</CardDescription>
                        </div>
                         <Button variant="outline" onClick={() => router.push('/dashboard/umpire')}>
                            <ArrowLeft /> Back to Umpire View
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                   {/* Scoreboard */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 items-start text-center">
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
                        <div className="text-center">
                            <h3 className="font-semibold text-lg mb-2">Previous Sets</h3>
                            <div className="flex gap-4 justify-center text-muted-foreground">
                                {match.scores.map((s, i) => <span key={i} className="text-sm">Set {i+1}: <span className="font-bold">{s.team1} - {s.team2}</span></span>)}
                            </div>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="border-t pt-6 space-y-4">
                        <div className="flex flex-wrap gap-4 justify-center">
                             <Button variant="secondary" onClick={handleServiceChange} disabled={isSubmitting || canFinalizeMatch}>
                                <Repeat className="mr-2"/> Change Service
                            </Button>
                            <Button variant="default" onClick={handleFinalizeSet} disabled={!canFinalizeSet || isSubmitting || canFinalizeMatch}>
                                <Send className="mr-2"/> Finalize Set {match.live?.currentSet}
                            </Button>
                        </div>
                        
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="w-full" disabled={isSubmitting || !canFinalizeMatch}>Finalize Match</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Finalize Match</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Select the winner to record the final score or declare a forfeit. This action is final.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="space-y-4 py-4">
                                     <Button 
                                        onClick={() => handleFinalizeMatch(match.live && match.live.team1Points > match.live.team2Points ? match.team1Id : match.team2Id)} 
                                        className="w-full bg-green-600 hover:bg-green-700"
                                        disabled={!canFinalizeSet}
                                     >
                                         <CheckCircle className="mr-2"/> Declare Winner & Save Score
                                    </Button>
                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or Forfeit</span></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button variant="outline" onClick={() => handleFinalizeMatch(match.team2Id, true)}>
                                            {match.team1Name} Forfeits
                                        </Button>
                                         <Button variant="outline" onClick={() => handleFinalizeMatch(match.team1Id, true)}>
                                            {match.team2Name} Forfeits
                                        </Button>
                                    </div>
                                </div>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
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
        <div className={`p-6 rounded-lg border-4 transition-all ${isServing ? 'border-primary shadow-lg' : 'border-muted'}`}>
            <h3 className="text-xl font-semibold mb-4 truncate h-6">{teamName}</h3>
            <p className={`text-7xl font-bold mb-4 transition-colors ${isMatchPoint ? 'text-accent' : 'text-foreground'}`}>{points}</p>
            <div className="flex justify-center gap-2">
                <Button onClick={() => onPointChange(1)} size="lg" className="w-16 text-xl">+</Button>
                <Button onClick={() => onPointChange(-1)} size="lg" variant="outline" className="w-16 text-xl">-</Button>
            </div>
            <div className="h-6 mt-4">
              {isServing && <div className="text-sm font-semibold text-primary animate-pulse">SERVING</div>}
            </div>
        </div>
    );
}
