
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, Unsubscribe, Timestamp, updateDoc } from 'firebase/firestore';
import type { Match } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Repeat, CheckCircle, Smartphone, AlertTriangle } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import { Separator } from '@/components/ui/separator';
import { LoadingShuttlecock } from '@/components/ui/loading-shuttlecock';

export default function LiveScorerPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const matchId = params.matchId as string;

    const [match, setMatch] = useState<Match | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFinalizeDialogOpen, setIsFinalizeDialogOpen] = useState(false);
    const [isTieConfirmOpen, setIsTieConfirmOpen] = useState(false);
    
    useEffect(() => {
        if (!matchId) return;
        
        const matchRef = doc(db, 'matches', matchId);
        const unsubscribe = onSnapshot(matchRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as Omit<Match, 'startTime'> & {startTime: Timestamp};
                const matchData = { id: docSnap.id, ...data, startTime: data.startTime.toDate() } as Match;
                
                // If match is just starting, initialize live data
                if (matchData.status === 'SCHEDULED' && !matchData.live) {
                    const initialLiveState = {
                        team1Points: 0,
                        team2Points: 0,
                        servingTeamId: matchData.team1Id, // Default server
                        currentSet: (matchData.scores?.length || 0) + 1,
                    };
                    // Update firestore and local state
                    updateDoc(matchRef, { live: initialLiveState, status: 'IN_PROGRESS' });
                    matchData.live = initialLiveState;
                    matchData.status = 'IN_PROGRESS';
                }

                setMatch(matchData);
            } else {
                toast({ title: "Error", description: "Match not found.", variant: 'destructive' });
                router.push('/dashboard/umpire');
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Snapshot error:", error);
            toast({ title: "Error", description: "Could not load match data.", variant: "destructive"});
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [matchId, router, toast]);

    const handlePointChange = useCallback(async (team: 'team1' | 'team2', delta: 1 | -1) => {
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
    }, [match, matchId, isSubmitting, toast]);
    
    const handleServiceChange = useCallback(async () => {
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
    }, [match, matchId, isSubmitting, toast]);

    const handleFinalizeSet = useCallback(async () => {
        if (!match?.live) return;
        setIsSubmitting(true);
        try {
            const newScores = [...(match.scores || [])];
            newScores.push({ team1: match.live.team1Points, team2: match.live.team2Points });
            
            await recordMatchResult({
                matchId: match.id,
                scores: newScores,
                status: 'IN_PROGRESS',
            });
            toast({ title: "Set Finalized", description: `Set ${match.live.currentSet} score has been recorded.` });
        } catch (error) {
            toast({ title: "Error", description: "Could not finalize set.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    }, [match, toast]);
    
    const handleFinalizeMatch = useCallback(async (winnerId?: string, isForfeited = false) => {
         if (!match) return;
         setIsSubmitting(true);
         try {
            let finalScores = [...(match.scores || [])];
            // Add the current set's score if it hasn't been added and it's not a forfeit
            if (!isForfeited && match.live && (match.live.team1Points > 0 || match.live.team2Points > 0)) {
                 finalScores.push({ team1: match.live.team1Points, team2: match.live.team2Points });
            }

            await recordMatchResult({
                matchId: match.id,
                scores: finalScores,
                winnerId: winnerId, // Let backend calculate if not provided for non-forfeit
                isForfeited,
                status: 'COMPLETED',
            });
             toast({ title: "Match Finalized!", description: "The final result has been recorded." });
             router.push('/dashboard');
         } catch(e) {
             console.error("Finalization error:", e);
             toast({ title: "Error", description: "Could not finalize match.", variant: "destructive" });
         } finally {
             setIsSubmitting(false);
             setIsFinalizeDialogOpen(false);
         }
    }, [match, router, toast]);

    const handleFinalizeClick = () => {
        if (!match) return;

        // Calculate what the final set score would be
        let potentialT1Sets = team1SetsWon;
        let potentialT2Sets = team2SetsWon;

        if (match.live && (match.live.team1Points > 0 || match.live.team2Points > 0)) {
            if (match.live.team1Points > match.live.team2Points) {
                potentialT1Sets++;
            } else if (match.live.team2Points > match.live.team1Points) {
                potentialT2Sets++;
            }
        }
        
        if (potentialT1Sets === potentialT2Sets) {
            toast({
                title: "Cannot Finalize Match",
                description: "The sets are tied. A clear winner is required to finalize the match.",
                variant: "destructive"
            });
            return;
        }

        if (match.live) {
            const { team1Points, team2Points } = match.live;
            if (team1Points === team2Points && team1Points > 0) {
                setIsTieConfirmOpen(true);
                return; // Wait for user confirmation
            }
        }
        
        setIsFinalizeDialogOpen(true);
    };
    
    const { team1SetsWon, team2SetsWon } = useMemo(() => {
        if (!match || !match.scores) return { team1SetsWon: 0, team2SetsWon: 0 };
        return match.scores.reduce((acc, set) => {
            if (set.team1 > set.team2) acc.team1SetsWon++;
            else if (set.team2 > set.team1) acc.team2SetsWon++;
            return acc;
        }, { team1SetsWon: 0, team2SetsWon: 0 });
    }, [match]);

    if (isLoading || !match) {
        return <div className="flex h-screen w-full items-center justify-center"><LoadingShuttlecock /></div>;
    }
    
    const { team1Points = 0, team2Points = 0, servingTeamId, currentSet = 1 } = match.live || {};
    
    return (
      <div className="container mx-auto p-2 sm:p-4 md:p-8">
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
              <CardContent className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start text-center">
                     <TeamScorePanel 
                          teamName={match.team1Name} 
                          points={team1Points}
                          setsWon={team1SetsWon}
                          isServing={servingTeamId === match.team1Id}
                          onPointChange={(delta) => handlePointChange('team1', delta)}
                     />
                     <TeamScorePanel 
                          teamName={match.team2Name} 
                          points={team2Points}
                          setsWon={team2SetsWon}
                          isServing={servingTeamId === match.team2Id}
                          onPointChange={(delta) => handlePointChange('team2', delta)}
                     />
                  </div>
                  
                  <Separator />
                  
                   <div className="text-center space-y-2">
                      <h3 className="font-semibold text-lg">Set {currentSet} Score</h3>
                      <p className="text-4xl md:text-5xl font-bold">{team1Points} - {team2Points}</p>
                   </div>
                  
                  {match.scores && match.scores.length > 0 && (
                      <div className="text-center">
                          <h3 className="font-semibold text-lg mb-2">Previous Sets</h3>
                          <div className="flex flex-wrap gap-2 justify-center text-muted-foreground">
                              {match.scores.map((s, i) => <span key={i} className="text-sm">Set {i+1}: <span className="font-bold">{s.team1} - {s.team2}</span></span>)}
                          </div>
                           <p className="text-xl font-bold mt-2">Match Score: {team1SetsWon} - {team2SetsWon}</p>
                      </div>
                  )}

                  <div className="border-t pt-6 space-y-4">
                      <div className="flex flex-col sm:flex-row gap-4 justify-center">
                           <Button variant="secondary" onClick={handleServiceChange} disabled={isSubmitting} className="flex-grow">
                              <Repeat className="mr-2"/> Change Service
                          </Button>
                          <Button variant="default" onClick={handleFinalizeSet} disabled={isSubmitting} className="flex-grow">
                              <Send className="mr-2"/> Finalize Set {currentSet}
                          </Button>
                      </div>
                      
                        <Button variant="destructive" className="w-full" disabled={isSubmitting} onClick={handleFinalizeClick}>
                            Finalize Match
                        </Button>
                  </div>
              </CardContent>
          </Card>
            
          <AlertDialog open={isTieConfirmOpen} onOpenChange={setIsTieConfirmOpen}>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-yellow-500"/> Confirm Tied Score</AlertDialogTitle>
                      <AlertDialogDescription>
                          The current set score is tied at {match.live?.team1Points} - {match.live?.team2Points}. Are you sure you want to proceed to finalize the match? This is unusual.
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => { setIsTieConfirmOpen(false); setIsFinalizeDialogOpen(true); }}>
                          Yes, proceed
                      </AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>


          <AlertDialog open={isFinalizeDialogOpen} onOpenChange={setIsFinalizeDialogOpen}>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Finalize Match</AlertDialogTitle>
                      <AlertDialogDescription>
                          Click confirm to finalize the match. The winner will be calculated automatically from the scores. You can also declare a forfeit below.
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-4 py-4">
                      <Button 
                          onClick={() => handleFinalizeMatch()} 
                          className="w-full bg-green-600 hover:bg-green-700"
                          disabled={isSubmitting}
                        >
                           {isSubmitting ? <div className="animate-spin h-5 w-5 border-2 border-background border-t-transparent rounded-full" /> : <CheckCircle className="mr-2"/>}
                            Confirm and Finalize Match
                      </Button>
                      
                      <div className="relative">
                          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                          <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or Declare Forfeit</span></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                           <Button variant="destructive" onClick={() => handleFinalizeMatch(match.team2Id, true)} className="h-auto py-2 text-wrap" disabled={isSubmitting}>
                                {match.team1Name} Forfeits
                            </Button>
                            <Button variant="destructive" onClick={() => handleFinalizeMatch(match.team1Id, true)} className="h-auto py-2 text-wrap" disabled={isSubmitting}>
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
    );
}


function TeamScorePanel({ teamName, points, setsWon, isServing, onPointChange }: { teamName: string, points: number, setsWon: number, isServing: boolean, onPointChange: (delta: 1 | -1) => void }) {
    return (
        <div className={`p-4 sm:p-6 rounded-lg border-4 transition-all ${isServing ? 'border-primary shadow-lg' : 'border-muted'}`}>
            <div className="text-xl md:text-2xl font-semibold mb-2 min-h-[56px] flex items-center justify-center break-words">
                {teamName}
            </div>
            <p className="text-sm font-bold text-muted-foreground mb-2">Sets Won: {setsWon}</p>
            <p className="text-6xl md:text-7xl font-bold mb-4">{points}</p>
            <div className="flex justify-center gap-2">
                <Button onClick={() => onPointChange(1)} size="lg" className="w-16 h-16 text-2xl">+</Button>
                <Button onClick={() => onPointChange(-1)} size="lg" variant="outline" className="w-16 h-16 text-2xl">-</Button>
            </div>
            <div className="h-6 mt-4">
              {isServing && <div className="text-sm font-semibold text-primary animate-pulse">SERVING</div>}
            </div>
        </div>
    );
}
