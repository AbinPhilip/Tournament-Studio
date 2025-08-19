

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit, startAfter, DocumentData } from 'firebase/firestore';
import type { Match, TeamType } from '@/types';
import { Loader2, ArrowRight } from 'lucide-react';
import { getRoundName } from '@/lib/utils';
import { EventBadge } from '@/components/ui/event-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';


const PAGE_SIZE = 10;

export default function MatchHistoryPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [matches, setMatches] = useState<Match[]>([]);
    const [teamCounts, setTeamCounts] = useState<Record<TeamType, number>>({
        singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0,
    });
    const [lastVisible, setLastVisible] = useState<DocumentData | null>(null);
    const [isLastPage, setIsLastPage] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

    const fetchMatches = async (nextPage = false) => {
        setIsLoading(true);
        try {
            const matchesRef = collection(db, 'matches');
            const baseQuery = query(matchesRef, where('status', '==', 'COMPLETED'), orderBy('lastUpdateTime', 'desc'));
            
            let q;
            if (nextPage && lastVisible) {
                q = query(baseQuery, startAfter(lastVisible), limit(PAGE_SIZE));
            } else {
                q = query(baseQuery, limit(PAGE_SIZE));
            }

            const matchesSnap = await getDocs(q);

            if (matchesSnap.empty) {
                if (nextPage) {
                    setIsLastPage(true);
                } else {
                    setMatches([]);
                }
                setIsLoading(false);
                return;
            }

            const newMatches = matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
            
            setMatches(prev => nextPage ? [...prev, ...newMatches] : newMatches);
            
            const newLastVisible = matchesSnap.docs[matchesSnap.docs.length - 1];
            setLastVisible(newLastVisible);

            if (matchesSnap.docs.length < PAGE_SIZE) {
                setIsLastPage(true);
            } else {
                 // Check if there's a next page
                const nextQuery = query(baseQuery, startAfter(newLastVisible), limit(1));
                const nextSnap = await getDocs(nextQuery);
                setIsLastPage(nextSnap.empty);
            }

            if (nextPage) {
                setCurrentPage(p => p + 1);
            } else {
                setCurrentPage(1);
            }

        } catch (error) {
            console.error("Error fetching standings:", error);
            toast({ title: 'Error', description: 'Failed to fetch match history.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };
    

    useEffect(() => {
        const fetchInitialData = async () => {
             const teamsSnap = await getDocs(collection(db, 'teams'));
             const counts: Record<TeamType, number> = { singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0 };
                teamsSnap.forEach(doc => {
                    const team = doc.data() as { type: TeamType };
                    if (counts[team.type] !== undefined) {
                        counts[team.type]++;
                    }
                });
            setTeamCounts(counts);
            fetchMatches(false);
        };
        fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast]);

    const groupedMatches = useMemo(() => {
        return matches.reduce((acc, match) => {
            const eventType = match.eventType;
            if (!acc[eventType]) {
                acc[eventType] = [];
            }
            acc[eventType].push(match);
            return acc;
        }, {} as Record<TeamType, Match[]>);
    }, [matches]);

    const eventOrder: TeamType[] = ['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles'];


    if (isLoading && matches.length === 0) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="space-y-8">
             <div>
                <h1 className="text-3xl font-bold mb-2">Match History</h1>
                <p className="text-muted-foreground">View all completed match results from the tournament. Click a row for details.</p>
            </div>
            
            {matches.length === 0 && !isLoading ? (
                 <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">No completed matches yet.</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                {eventOrder.map(eventType => {
                    const eventMatches = groupedMatches[eventType];
                    if (!eventMatches || eventMatches.length === 0) return null;

                    return (
                        <Card key={eventType}>
                            <CardHeader>
                                <CardTitle><EventBadge eventType={eventType} /></CardTitle>
                                <CardDescription>Completed matches for this event.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Round</TableHead>
                                            <TableHead>Victor</TableHead>
                                            <TableHead>Runner-up</TableHead>
                                            <TableHead>Score</TableHead>
                                            <TableHead>Point Diff.</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {eventMatches.map(match => {
                                            const winnerIsTeam1 = match.winnerId === match.team1Id;
                                            const winnerName = winnerIsTeam1 ? match.team1Name : match.team2Name;
                                            const winnerOrg = winnerIsTeam1 ? match.team1OrgName : match.team2OrgName;
                                            const loserName = winnerIsTeam1 ? match.team2Name : match.team1Name;
                                            const loserOrg = winnerIsTeam1 ? match.team2OrgName : match.team1OrgName;
                                            const diff = match.pointDifferential;

                                            return (
                                                 <TableRow key={match.id} onClick={() => setSelectedMatch(match)} className="cursor-pointer">
                                                    <TableCell className="font-medium">{getRoundName(match.round || 0, eventType, teamCounts[eventType])}</TableCell>
                                                    <TableCell>
                                                        <div>
                                                          <span className="font-bold">{winnerName}</span>
                                                          <p className="text-sm text-muted-foreground">{winnerOrg}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div>
                                                            <span>{loserName}</span>
                                                            <p className="text-sm text-muted-foreground">{loserOrg}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell><Badge variant="secondary" className="text-base">{match.score || ''}</Badge></TableCell>
                                                    <TableCell>
                                                        {diff !== undefined && diff > 0 && (
                                                            <span className="font-bold text-green-600">+{diff}</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )
                })}
                 <div className="flex justify-center items-center mt-4">
                    <Button onClick={() => fetchMatches(true)} disabled={isLastPage || isLoading}>
                        {isLoading ? <Loader2 className="mr-2 animate-spin" /> : 'Load More'}
                        {!isLoading && !isLastPage && <ArrowRight className="ml-2" />}
                    </Button>
                </div>
                </>
            )}

            {selectedMatch && (
                <Dialog open={!!selectedMatch} onOpenChange={(isOpen) => !isOpen && setSelectedMatch(null)}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Match Scorecard</DialogTitle>
                            <DialogDescription>
                                Final result for {getRoundName(selectedMatch.round || 0, selectedMatch.eventType, teamCounts[selectedMatch.eventType])} of the <span className="capitalize font-semibold">{selectedMatch.eventType.replace(/_/g, ' ')}</span> event.
                            </DialogDescription>
                        </DialogHeader>
                        <Scorecard match={selectedMatch} />
                        <DialogFooter>
                            <Button type="button" variant="secondary" onClick={() => setSelectedMatch(null)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}

function Scorecard({ match }: { match: Match }) {
  const { team1SetsWon, team2SetsWon } = useMemo(() => {
    if (!match || !match.scores) return { team1SetsWon: 0, team2SetsWon: 0 };
    return match.scores.reduce((acc, set) => {
        if (set.team1 > set.team2) acc.team1SetsWon++;
        else if (set.team2 > set.team1) acc.team2SetsWon++;
        return acc;
    }, { team1SetsWon: 0, team2SetsWon: 0 });
  }, [match]);
  
  const winnerIsTeam1 = match.winnerId === match.team1Id;

  return (
    <div className="space-y-6 py-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
            <TeamDisplay name={match.team1Name} org={match.team1OrgName || ''} isWinner={winnerIsTeam1} />
            <div className="text-4xl font-bold text-muted-foreground">vs</div>
            <TeamDisplay name={match.team2Name} org={match.team2OrgName || ''} isWinner={!winnerIsTeam1} />
        </div>

        <Separator />

        <div className="text-center">
            <h4 className="text-lg font-semibold">Final Score</h4>
            <div className="flex items-baseline justify-center gap-4 text-4xl font-bold">
                <span className={cn(winnerIsTeam1 && "text-primary")}>{team1SetsWon}</span>
                <span className="text-muted-foreground">-</span>
                <span className={cn(!winnerIsTeam1 && "text-primary")}>{team2SetsWon}</span>
            </div>
            {match.pointDifferential !== undefined && match.pointDifferential !== 0 && (
                <p className="text-sm text-muted-foreground">
                    Point Differential: <span className="font-bold text-green-600">+{match.pointDifferential}</span>
                </p>
            )}
        </div>

        {match.scores && match.scores.length > 0 && (
            <div className="space-y-2">
                <h4 className="text-center font-semibold">Set Breakdown</h4>
                <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-center border rounded-md p-4 max-w-sm mx-auto">
                    {match.scores.map((set, index) => (
                        <React.Fragment key={index}>
                            <div className={cn("font-medium", set.team1 > set.team2 && "font-extrabold")}>{set.team1}</div>
                            <div className="text-sm text-muted-foreground">Set {index + 1}</div>
                            <div className={cn("font-medium", set.team2 > set.team1 && "font-extrabold")}>{set.team2}</div>
                        </React.Fragment>
                    ))}
                </div>
            </div>
        )}
    </div>
  )
}

function TeamDisplay({ name, org, isWinner }: { name: string; org: string; isWinner: boolean; }) {
    return (
        <div className={cn("p-4 rounded-lg", isWinner && "bg-primary/10 border-primary border")}>
            <h3 className={cn("text-xl font-bold", isWinner && "text-primary")}>{name}</h3>
            <p className="text-sm text-muted-foreground">{org}</p>
        </div>
    )
}
