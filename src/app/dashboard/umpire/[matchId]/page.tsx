
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
    
    useEffect(() => {
        if (!matchId) return;
        
        const matchRef = doc(db, 'matches', matchId);
        const unsubscribe = onSnapshot(matchRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as Omit<Match, 'startTime'> & {startTime: Timestamp};
                const matchData = { id: docSnap.id, ...data, startTime: data.startTime.toDate() } as Match;
                
                // If match is just starting, initialize live data and set to in progress
                if (matchData.status === 'SCHEDULED') {
                    updateDoc(matchRef, { status: 'IN_PROGRESS' });
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

    const handleFinalizeMatch = useCallback(async (isForfeited = false, winnerId?: string) => {
         if (!match) return;
         setIsSubmitting(true);
         try {
            await recordMatchResult({
                matchId: match.id,
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
             setIsFinalizeDialogOpen(false);
         }
    }, [match, router, toast]);

    if (isLoading || !match) {
        return <div className="flex h-screen w-full items-center justify-center"><div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" /></div>;
    }
    
    return (
      <div className="container mx-auto p-2 sm:p-4 md:p-8">
          <Card>
              <CardHeader>
                  <div className="flex justify-between items-start flex-wrap gap-4">
                      <div>
                          <CardTitle className="text-2xl md:text-3xl">Finalize Match</CardTitle>
                          <CardDescription>Court: {match.courtName}</CardDescription>
                      </div>
                       <Button variant="outline" onClick={() => router.push('/dashboard/umpire')}>
                          <ArrowLeft /> Back to Umpire View
                      </Button>
                  </div>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start text-center">
                     <TeamDisplay 
                          teamName={match.team1Name} 
                          orgName={match.team1OrgName}
                     />
                     <div className="flex items-center justify-center h-full text-2xl font-bold text-muted-foreground">VS</div>
                     <TeamDisplay 
                          teamName={match.team2Name} 
                          orgName={match.team2OrgName}
                     />
                  </div>
                  
                  <Separator />
                  
                  <div className="border-t pt-6 space-y-4">
                        <Button variant="destructive" className="w-full" disabled={isSubmitting} onClick={() => setIsFinalizeDialogOpen(true)}>
                            Finalize Match
                        </Button>
                  </div>
              </CardContent>
          </Card>

          <AlertDialog open={isFinalizeDialogOpen} onOpenChange={setIsFinalizeDialogOpen}>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Finalize Match</AlertDialogTitle>
                      <AlertDialogDescription>
                          Click confirm to finalize the match. The winner will be calculated automatically based on lot number. You can also declare a forfeit below.
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-4 py-4">
                      <Button 
                          onClick={() => handleFinalizeMatch(false)} 
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
    );
}


function TeamDisplay({ teamName, orgName }: { teamName: string, orgName?: string }) {
    return (
        <div className={`p-4 sm:p-6 rounded-lg border-2 border-muted`}>
            <div className="text-xl md:text-2xl font-semibold mb-2 min-h-[56px] flex items-center justify-center break-words">
                {teamName}
            </div>
             <p className="text-sm text-muted-foreground">{orgName}</p>
        </div>
    );
}

