
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, Unsubscribe, Timestamp, updateDoc } from 'firebase/firestore';
import type { Match } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle, Minus, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


export default function LiveScorerPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const matchId = params.matchId as string;

    const [match, setMatch] = useState<Match | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Local state for UI responsiveness
    const [team1Points, setTeam1Points] = useState(0);
    const [team2Points, setTeam2Points] = useState(0);
    const [currentScores, setCurrentScores] = useState<{ team1: number, team2: number }[]>([]);

    useEffect(() => {
        if (!matchId) return;
        
        const matchRef = doc(db, 'matches', matchId);
        const unsubscribe = onSnapshot(matchRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as Omit<Match, 'startTime'> & {startTime: Timestamp};
                const matchData = { id: docSnap.id, ...data, startTime: data.startTime.toDate() } as Match;
                
                // Initialize or update live data
                if (matchData.status === 'SCHEDULED' || (matchData.status === 'IN_PROGRESS' && !matchData.live)) {
                     const initialLiveState = {
                        team1Points: 0,
                        team2Points: 0,
                        currentSet: (matchData.scores?.length || 0) + 1,
                    };
                    updateDoc(matchRef, { status: 'IN_PROGRESS', live: initialLiveState });
                    matchData.status = 'IN_PROGRESS';
                    matchData.live = initialLiveState;
                }

                setMatch(matchData);
                // Sync local state with Firestore
                setTeam1Points(matchData.live?.team1Points ?? 0);
                setTeam2Points(matchData.live?.team2Points ?? 0);
                setCurrentScores(matchData.scores ?? []);
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
    
    const handlePointChange = useCallback((team: 'team1' | 'team2', delta: 1 | -1) => {
        const newPoints = (team === 'team1' ? team1Points : team2Points) + delta;
        if (newPoints < 0) return;

        if (team === 'team1') {
            setTeam1Points(newPoints);
        } else {
            setTeam2Points(newPoints);
        }
    }, [team1Points, team2Points]);

    
    const handleFinalizeSet = useCallback(async () => {
        if (!match) return;
        setIsSubmitting(true);
        const newScores = [...currentScores, { team1: team1Points, team2: team2Points }];
        try {
            await recordMatchResult({
                matchId: match.id,
                scores: newScores,
                status: 'IN_PROGRESS',
                team1Points: 0,
                team2Points: 0,
            });
            // Reset points for next set
            setTeam1Points(0);
            setTeam2Points(0);
            toast({ title: "Set Finalized", description: `Set ${newScores.length} result has been recorded.` });
        } catch(e) {
            console.error("Set finalization error:", e);
            toast({ title: "Error", description: "Could not finalize the set.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    }, [match, team1Points, team2Points, currentScores, toast]);


    const handleFinalizeMatch = useCallback(async (isForfeited = false, winnerId?: string) => {
         if (!match) return;
         setIsSubmitting(true);
         try {
            // Include final set scores if any
            let finalScores = [...currentScores];
            if (team1Points > 0 || team2Points > 0) {
                finalScores.push({ team1: team1Points, team2: team2Points });
            }

            await recordMatchResult({
                matchId: match.id,
                scores: finalScores,
                winnerId,
                isForfeited,
                status: 'COMPLETED',
            });
             toast({ title: "Match Finalized!", description: "The final result has been recorded." });
             router.push('/dashboard/umpire');
         } catch(e) {
             console.error("Finalization error:", e);
             toast({ title: "Error", description: "Could not finalize match.", variant: "destructive" });
         } finally {
             setIsSubmitting(false);
         }
    }, [match, router, toast, currentScores, team1Points, team2Points]);
    
    const canFinalizeSet = useMemo(() => {
        return (team1Points >= 21 || team2Points >= 21) && Math.abs(team1Points - team2Points) >= 2;
    }, [team1Points, team2Points]);
    
    const team1SetsWon = useMemo(() => currentScores.filter(s => s.team1 > s.team2).length, [currentScores]);
    const team2SetsWon = useMemo(() => currentScores.filter(s => s.team2 > s.team1).length, [currentScores]);

    if (isLoading || !match) {
        return <div className="flex h-screen w-full items-center justify-center"><div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" /></div>;
    }
    
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
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                     <TeamScorer 
                        teamName={match.team1Name}
                        orgName={match.team1OrgName}
                        points={team1Points}
                        setsWon={team1SetsWon}
                        onPointChange={(delta) => handlePointChange('team1', delta)}
                        disabled={isSubmitting}
                     />
                     <TeamScorer 
                        teamName={match.team2Name}
                        orgName={match.team2OrgName}
                        points={team2Points}
                        setsWon={team2SetsWon}
                        onPointChange={(delta) => handlePointChange('team2', delta)}
                        disabled={isSubmitting}
                     />
                  </div>
                  
                  <Separator />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button variant="outline" onClick={handleFinalizeSet} disabled={isSubmitting || !canFinalizeSet}>
                            <CheckCircle className="mr-2"/> Finalize Set
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isSubmitting}>Finalize Match</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Finalize Match</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Select the winner or declare a forfeit. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="space-y-4 py-4">
                                     <Button onClick={() => handleFinalizeMatch(false, team1Points > team2Points ? match.team1Id : match.team2Id)} className="w-full bg-green-600 hover:bg-green-700" disabled={isSubmitting || (!canFinalizeSet && currentScores.length < 1)}>
                                        Declare Winner by Points
                                    </Button>
                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or Declare Forfeit</span></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button variant="destructive" onClick={() => handleFinalizeMatch(true, match.team2Id)} className="h-auto py-2 text-wrap" disabled={isSubmitting}>
                                            {match.team1Name} Forfeits
                                        </Button>
                                        <Button variant="destructive" onClick={() => handleFinalizeMatch(true, match.team1Id)} className="h-auto py-2 text-wrap" disabled={isSubmitting}>
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

                    {currentScores.length > 0 && (
                        <div className="border-t pt-4">
                            <h3 className="font-semibold mb-2">Completed Sets</h3>
                            <div className="space-y-1 text-sm text-muted-foreground">
                                {currentScores.map((score, index) => (
                                    <p key={index}>Set {index + 1}: {score.team1} - {score.team2}</p>
                                ))}
                            </div>
                        </div>
                    )}
              </CardContent>
          </Card>
      </div>
    );
}


interface TeamScorerProps {
  teamName: string;
  orgName?: string;
  points: number;
  setsWon: number;
  onPointChange: (delta: 1 | -1) => void;
  disabled?: boolean;
}

function TeamScorer({ teamName, orgName, points, setsWon, onPointChange, disabled }: TeamScorerProps) {
    return (
        <div className={cn("p-4 sm:p-6 rounded-lg border-2 border-muted")}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xl md:text-2xl font-semibold break-words">{teamName}</h3>
                    <p className="text-sm text-muted-foreground">{orgName}</p>
                </div>
                <Badge variant="secondary" className="text-lg">{setsWon}</Badge>
            </div>
            
            <div className="flex items-center justify-center gap-4 my-4">
                <Button variant="outline" size="icon" onClick={() => onPointChange(-1)} disabled={disabled || points === 0}>
                    <Minus />
                </Button>
                <div className="text-6xl font-bold w-24 text-center">{points}</div>
                <Button variant="outline" size="icon" onClick={() => onPointChange(1)} disabled={disabled}>
                    <Plus />
                </Button>
            </div>
        </div>
    );
}
