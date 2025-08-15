
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

            // Note: Removed `where('status', '==', 'COMPLETED')` from queries to avoid composite index requirement.
            // Filtering is now done on the client-side after fetching.
            if (direction === 'next' && lastVisible) {
                q = query(matchesRef, orderBy('lastUpdateTime', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE));
            } else if (direction === 'prev' && firstVisible) {
                q = query(matchesRef, orderBy('lastUpdateTime', 'desc'), endBefore(firstVisible), limitToLast(PAGE_SIZE));
            } else {
                q = query(matchesRef, orderBy('lastUpdateTime', 'desc'), limit(PAGE_SIZE));
            }

            const matchesSnap = await getDocs(q);
            if (matchesSnap.empty) {
                if (direction === 'next') setIsLastPage(true);
                setMatches([]);
                setIsLoading(false);
                return;
            }

            const matchesData = matchesSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Match))
                .filter(m => m.status === 'COMPLETED'); // Filter on client
            
            setMatches(matchesData);
            setFirstVisible(matchesSnap.docs[0]);
            const newLastVisible = matchesSnap.docs[matchesSnap.docs.length - 1];
            setLastVisible(newLastVisible);
            
            if ((direction === 'next' || direction === 'initial') && newLastVisible) {
                const nextQuery = query(matchesRef, orderBy('lastUpdateTime', 'desc'), startAfter(newLastVisible), limit(1));
                const nextSnap = await getDocs(nextQuery);
                setIsLastPage(nextSnap.empty);
            } else {
                 setIsLastPage(false);
            }
             
            if (direction === 'initial') setCurrentPage(1);
            else if (direction === 'next') setCurrentPage(p => p + 1);
            else if (direction === 'prev') setCurrentPage(p => p - 1);

        } catch (error) {
            console.error("Error fetching standings:", error);
            toast({ title: 'Error', description: 'Failed to fetch match history.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };
    
     useEffect(() => {
        setIsFirstPage(currentPage === 1);
     }, [currentPage])

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
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {eventMatches.map(match => {
                                            const winnerIsTeam1 = match.winnerId === match.team1Id;
                                            const winnerName = winnerIsTeam1 ? match.team1Name : match.team2Name;
                                            const winnerOrg = winnerIsTeam1 ? match.team1OrgName : match.team2OrgName;
                                            const loserName = winnerIsTeam1 ? match.team2Name : match.team1Name;
                                            const loserOrg = winnerIsTeam1 ? match.team2OrgName : match.team1OrgName;

                                            return (
                                                 <TableRow key={match.id}>
                                                    <TableCell className="font-medium">{getRoundName(match.round || 0, eventType, teamCounts[eventType])}</TableCell>
                                                    <TableCell>
                                                        <div>
                                                          <span>{winnerName}</span>
                                                          <p className="text-sm text-muted-foreground">{winnerOrg}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div>
                                                            <span>{loserName}</span>
                                                            <p className="text-sm text-muted-foreground">{loserOrg}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{match.score || ''}</TableCell>
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
