
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
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
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import type { Match, TeamType } from '@/types';
import { Loader2, ArrowLeft, Gamepad2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { getRoundName } from '@/lib/utils';


export default function CourtViewPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [matches, setMatches] = useState<Match[]>([]);
    
    const [teamCounts, setTeamCounts] = useState<Record<TeamType, number>>({
        singles: 0,
        mens_doubles: 0,
        womens_doubles: 0,
        mixed_doubles: 0,
    });


    const fetchMatchesAndCounts = useCallback(async () => {
        setIsLoading(true);
        try {
            const [matchesSnap, teamsSnap] = await Promise.all([
                getDocs(query(collection(db, 'matches'), orderBy('startTime', 'desc'))),
                getDocs(collection(db, 'teams')),
            ]);

            const matchesData = matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Omit<Match, 'startTime'> & {startTime: Timestamp})).map(m => ({...m, startTime: m.startTime?.toDate()}));
            setMatches(matchesData as Match[]);

            const counts: Record<TeamType, number> = { singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0 };
            teamsSnap.forEach(doc => {
                const team = doc.data() as { type: TeamType };
                if (counts[team.type] !== undefined) {
                    counts[team.type]++;
                }
            });
            setTeamCounts(counts);

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ title: 'Error', description: 'Failed to fetch tournament data.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        fetchMatchesAndCounts();
    }, [fetchMatchesAndCounts]);

    const handleScorerClick = (match: Match) => {
        if (match.status === 'COMPLETED') {
            toast({ title: 'Match Completed', description: 'This match has already been scored.' });
            return;
        }
        if (!match.courtName) {
            toast({ title: 'Court Not Assigned', description: 'Please assign a court to this match in the scheduler first.', variant: 'destructive' });
            return;
        }
        router.push(`/dashboard/umpire/${match.id}`);
    };

    const groupedMatchesByCourt = useMemo(() => {
        return matches.reduce((acc, match) => {
            const courtName = match.courtName || "Unassigned";
            if (!acc[courtName]) {
                acc[courtName] = [];
            }
            acc[courtName].push(match);
            return acc;
        }, {} as Record<string, Match[]>);
    }, [matches]);

    const courtNames = useMemo(() => Object.keys(groupedMatchesByCourt).sort(), [groupedMatchesByCourt]);


    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                        <CardTitle>Court View</CardTitle>
                        <CardDescription>
                            View matches by court. Click the scorer icon to start live scoring.
                        </CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => router.push('/dashboard')}>
                        <ArrowLeft className="mr-2" />
                        Back to Dashboard
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {matches.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">No matches scheduled.</p>
                        <Button className="mt-4" onClick={() => router.push('/dashboard/tournament')}>
                            Go to Tournament Setup
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {courtNames.map(courtName => (
                            <div key={courtName}>
                                <h3 className="text-xl font-bold mb-4 capitalize">
                                    {courtName}
                                </h3>
                                <div className="border rounded-md overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Round</TableHead>
                                            <TableHead>Event</TableHead>
                                            <TableHead>Team 1</TableHead>
                                            <TableHead>Team 2</TableHead>
                                            <TableHead>Score</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {groupedMatchesByCourt[courtName].map(match => (
                                            <TableRow key={match.id} className={match.status === 'IN_PROGRESS' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                                                <TableCell className="font-medium whitespace-nowrap">{getRoundName(match.round || 0, match.eventType, teamCounts[match.eventType])}</TableCell>
                                                <TableCell className="capitalize whitespace-nowrap">{match.eventType.replace(/_/g, ' ')}</TableCell>
                                                <TableCell className={match.winnerId === match.team1Id ? 'font-bold' : ''}>{match.team1Name}</TableCell>
                                                <TableCell className={match.winnerId === match.team2Id ? 'font-bold' : ''}>{match.team2Name}</TableCell>
                                                <TableCell>{match.score || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={match.status === 'COMPLETED' ? 'default' : (match.status === 'IN_PROGRESS' || match.status === 'SCHEDULED') ? 'secondary' : 'outline'}>
                                                        {match.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleScorerClick(match)} disabled={match.status === 'COMPLETED' || courtName === 'Unassigned'}>
                                                        <Gamepad2 className="h-5 w-5"/>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
