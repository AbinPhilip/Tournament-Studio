
"use client";

import { useState, useEffect, useMemo } from 'react';
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
import { collection, query, onSnapshot, Timestamp } from 'firebase/firestore';
import type { Match, TeamType } from '@/types';
import { Loader2, ArrowLeft, Gamepad2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { getRoundName } from '@/lib/utils';
import { EventBadge } from '@/components/ui/event-badge';


export default function CourtViewPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [matches, setMatches] = useState<Match[]>([]);
    
    const [teamCounts, setTeamCounts] = useState<Record<TeamType, number>>({
        singles: 0,
        mens_doubles: 0,
        womens_doubles: 0,
        mixed_doubles: 0,
    });


    useEffect(() => {
        setIsLoading(true);
        const matchesQuery = query(collection(db, 'matches'));
        const teamsQuery = query(collection(db, 'teams'));

        const unsubscribeMatches = onSnapshot(matchesQuery, (querySnapshot) => {
            const matchesData = querySnapshot.docs.map(doc => {
                 const data = doc.data() as Omit<Match, 'startTime'> & {startTime: Timestamp | null};
                 return { id: doc.id, ...data, startTime: data.startTime?.toDate() ?? new Date() } as Match;
            });
            matchesData.sort((a,b) => (a.courtName || 'ZZZ').localeCompare(b.courtName || 'ZZZ') || (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0));

            setMatches(matchesData);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching matches:", error);
            toast({ title: 'Error', description: 'Failed to fetch match data.', variant: 'destructive' });
            setIsLoading(false);
        });

        const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
            const counts: Record<TeamType, number> = { singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0 };
            snapshot.forEach(doc => {
                const team = doc.data() as { type: TeamType };
                if (counts[team.type] !== undefined) {
                    counts[team.type]++;
                }
            });
            setTeamCounts(counts);
        }, (error) => {
            console.error("Error fetching team counts:", error);
            toast({ title: 'Error', description: 'Failed to fetch team counts.', variant: 'destructive' });
        });

        return () => {
            unsubscribeMatches();
            unsubscribeTeams();
        };
    }, [toast]);

    const handleScorerClick = (match: Match) => {
        if (match.status === 'COMPLETED') {
            toast({ title: 'Match Completed', description: 'This match has already been scored.' });
            return;
        }
        if (!match.courtName) {
            toast({ title: 'Court Not Assigned', description: 'Please assign a court in the scheduler first.', variant: 'destructive' });
            return;
        }
        router.push(`/dashboard/umpire/${match.id}`);
    };

    const groupedMatchesByCourt = useMemo(() => {
        const assignedMatches = matches.filter(match => match.courtName);
        return assignedMatches.reduce((acc, match) => {
            const courtName = match.courtName;
            if (!acc[courtName]) {
                acc[courtName] = [];
            }
            acc[courtName].push(match);
            return acc;
        }, {} as Record<string, Match[]>);
    }, [matches]);

    const courtNames = useMemo(() => {
        return Object.keys(groupedMatchesByCourt).sort((a, b) => a.localeCompare(b));
    }, [groupedMatchesByCourt]);


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
                        <CardTitle>Umpire Court View</CardTitle>
                        <CardDescription>
                            View all matches organized by court. Click the scorer icon to begin live scoring.
                        </CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => router.push('/dashboard')}>
                        <ArrowLeft className="mr-2" />
                        Back to Dashboard
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {courtNames.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">No matches have been assigned to courts yet.</p>
                        <Button className="mt-4" onClick={() => router.push('/dashboard/scheduler')}>
                            Go to Scheduler
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
                                            <TableHead>Event</TableHead>
                                            <TableHead>Round</TableHead>
                                            <TableHead>Match</TableHead>
                                            <TableHead>Score</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {groupedMatchesByCourt[courtName].map(match => (
                                            <TableRow key={match.id} className={match.status === 'IN_PROGRESS' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                                                <TableCell><EventBadge eventType={match.eventType} /></TableCell>
                                                <TableCell className="font-medium whitespace-nowrap">{getRoundName(match.round || 0, match.eventType, teamCounts[match.eventType])}</TableCell>
                                                <TableCell className="min-w-[250px]">
                                                    <div className={match.winnerId === match.team1Id ? 'font-bold' : ''}>
                                                        <span>{match.team1Name}</span>
                                                        <p className="text-sm text-muted-foreground">{match.team1OrgName}</p>
                                                    </div>
                                                    <div className="text-muted-foreground my-1">vs</div>
                                                    <div className={match.winnerId === match.team2Id ? 'font-bold' : ''}>
                                                        <span>{match.team2Name}</span>
                                                        <p className="text-sm text-muted-foreground">{match.team2OrgName}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{match.score || ''}</TableCell>
                                                <TableCell>
                                                    <Badge variant={match.status === 'COMPLETED' ? 'default' : (match.status === 'IN_PROGRESS' || match.status === 'SCHEDULED') ? 'secondary' : 'outline'}>
                                                        {match.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleScorerClick(match)} disabled={match.status === 'COMPLETED'}>
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
