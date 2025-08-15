
"use client";

import { useState, useEffect, useMemo } from 'react';
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
import { collection, getDocs, query, where, orderBy, limit, startAfter, DocumentData, endBefore, limitToLast } from 'firebase/firestore';
import type { Match, TeamType } from '@/types';
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { getRoundName } from '@/lib/utils';
import { EventBadge } from '@/components/ui/event-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const PAGE_SIZE = 10;

export default function MatchHistoryPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [matches, setMatches] = useState<Match[]>([]);
    const [teamCounts, setTeamCounts] = useState<Record<TeamType, number>>({
        singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0,
    });
    const [lastVisible, setLastVisible] = useState<DocumentData | null>(null);
    const [firstVisible, setFirstVisible] = useState<DocumentData | null>(null);
    const [isLastPage, setIsLastPage] = useState(false);
    const [isFirstPage, setIsFirstPage] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchMatches = async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
        setIsLoading(true);
        try {
            const matchesRef = collection(db, 'matches');
            let q;

            const baseQuery = query(matchesRef, where('status', '==', 'COMPLETED'), orderBy('lastUpdateTime', 'desc'));

            if (direction === 'next' && lastVisible) {
                q = query(baseQuery, startAfter(lastVisible), limit(PAGE_SIZE));
            } else if (direction === 'prev' && firstVisible) {
                q = query(matchesRef, where('status', '==', 'COMPLETED'), orderBy('lastUpdateTime', 'desc'), endBefore(firstVisible), limitToLast(PAGE_SIZE));
            } else {
                q = query(baseQuery, limit(PAGE_SIZE));
            }

            const matchesSnap = await getDocs(q);
            if (matchesSnap.empty && direction !== 'initial') {
                if (direction === 'next') setIsLastPage(true);
                 if (direction === 'prev') setIsFirstPage(true);
                setIsLoading(false);
                return;
            }
            
             if (matchesSnap.empty && direction === 'initial') {
                setMatches([]);
                setIsLastPage(true);
                setIsFirstPage(true);
                setIsLoading(false);
                return;
            }

            const matchesData = matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
            
            setMatches(matchesData);
            setFirstVisible(matchesSnap.docs[0]);
            const newLastVisible = matchesSnap.docs[matchesSnap.docs.length - 1];
            setLastVisible(newLastVisible);
            
            // Check for next page availability
            if ((direction === 'next' || direction === 'initial') && newLastVisible) {
                const nextQuery = query(baseQuery, startAfter(newLastVisible), limit(1));
                const nextSnap = await getDocs(nextQuery);
                setIsLastPage(nextSnap.empty);
            } else {
                 setIsLastPage(false);
            }

            // Update current page number
            if (direction === 'initial') {
                setCurrentPage(1);
                 // Check if it is also the first page
                const prevQuery = query(baseQuery, endBefore(matchesSnap.docs[0]), limitToLast(1));
                const prevSnap = await getDocs(prevQuery);
                setIsFirstPage(prevSnap.empty);
            }
            else if (direction === 'next') {
                setCurrentPage(p => p + 1);
                setIsFirstPage(false);
            }
            else if (direction === 'prev') {
                setCurrentPage(p => p - 1);
                setIsLastPage(false); // We moved back, so it's not the last page
                 // Check if it is now the first page
                const prevQuery = query(baseQuery, endBefore(matchesSnap.docs[0]), limitToLast(1));
                const prevSnap = await getDocs(prevQuery);
                setIsFirstPage(prevSnap.empty);
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
            fetchMatches('initial');
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
                <p className="text-muted-foreground">View all completed match results from the tournament.</p>
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
                                                 <TableRow key={match.id}>
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
                 <div className="flex justify-between items-center mt-4">
                    <Button onClick={() => fetchMatches('prev')} disabled={isFirstPage || isLoading}>
                        <ArrowLeft className="mr-2" /> Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">Page {currentPage}</span>
                    <Button onClick={() => fetchMatches('next')} disabled={isLastPage || isLoading}>
                        Next <ArrowRight className="ml-2" />
                    </Button>
                </div>
                </>
            )}
        </div>
    )
}
