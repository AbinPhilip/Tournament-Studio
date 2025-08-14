
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
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import type { Match, TeamType } from '@/types';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getRoundName } from '@/lib/utils';

export default function StandingsPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [matches, setMatches] = useState<Match[]>([]);
    const [teamCounts, setTeamCounts] = useState<Record<TeamType, number>>({
        singles: 0,
        mens_doubles: 0,
        womens_doubles: 0,
        mixed_doubles: 0,
    });

    useEffect(() => {
        const fetchStandings = async () => {
            setIsLoading(true);
            try {
                const [matchesSnap, teamsSnap] = await Promise.all([
                     getDocs(query(
                        collection(db, 'matches'),
                        where('status', '==', 'COMPLETED'))
                    ),
                    getDocs(collection(db, 'teams'))
                ]);

                const matchesData = matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
                
                // Sort the data in the client
                matchesData.sort((a, b) => {
                    if (a.eventType < b.eventType) return -1;
                    if (a.eventType > b.eventType) return 1;
                    return (b.round || 0) - (a.round || 0);
                });

                setMatches(matchesData);
                
                const counts: Record<TeamType, number> = { singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0 };
                teamsSnap.forEach(doc => {
                    const team = doc.data() as { type: TeamType };
                    if (counts[team.type] !== undefined) {
                        counts[team.type]++;
                    }
                });
                setTeamCounts(counts);

            } catch (error) {
                console.error("Error fetching standings:", error);
                toast({ title: 'Error', description: 'Failed to fetch match history.', variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchStandings();
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


    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="space-y-8">
             <div>
                <h1 className="text-3xl font-bold mb-2">Tournament Standings</h1>
                <p className="text-muted-foreground">View all completed match results from the tournament.</p>
            </div>
            
            {matches.length === 0 && !isLoading ? (
                 <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">No completed matches yet.</p>
                    </CardContent>
                </Card>
            ) : (
                eventOrder.map(eventType => {
                    const eventMatches = groupedMatches[eventType];
                    if (!eventMatches || eventMatches.length === 0) return null;

                    return (
                        <Card key={eventType}>
                            <CardHeader>
                                <CardTitle className="capitalize">{eventType.replace(/_/g, ' ')}</CardTitle>
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
                                            const winner = match.winnerId === match.team1Id ? match.team1Name : match.team2Name;
                                            const loser = match.winnerId === match.team1Id ? match.team2Name : match.team1Name;

                                            return (
                                                 <TableRow key={match.id}>
                                                    <TableCell className="font-medium">{getRoundName(match.round || 0, eventType, teamCounts[eventType])}</TableCell>
                                                    <TableCell>
                                                        <Badge>{winner}</Badge>
                                                    </TableCell>
                                                    <TableCell>{loser}</TableCell>
                                                    <TableCell>{match.score || 'N/A'}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )
                })
            )}

        </div>
    )
}
