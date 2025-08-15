
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Play, XCircle, TimerOff, ShieldCheck } from 'lucide-react';
import type { Match, Team, TeamType, Tournament } from '@/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch, query, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { EventBadge } from '@/components/ui/event-badge';
import { getRoundName } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

const MIN_REST_TIME_MS = 10 * 60 * 1000; // 10 minutes

const CountdownTimer = ({ endTime }: { endTime: number }) => {
    const [timeLeft, setTimeLeft] = useState(endTime - Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            const newTimeLeft = endTime - Date.now();
            if (newTimeLeft <= 0) {
                setTimeLeft(0);
                clearInterval(interval);
            } else {
                setTimeLeft(newTimeLeft);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [endTime]);

    if (timeLeft <= 0) {
        return <span className="text-green-500 font-bold">Ready</span>;
    }

    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000).toString().padStart(2, '0');

    return <span>{minutes}:{seconds}</span>;
};


export default function SchedulerPage() {
    const { user } = useAuth();
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [teamCounts, setTeamCounts] = useState<Record<TeamType, number>>({
        singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0,
    });
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const fetchAndSetData = async () => {
            setIsLoading(true);
            try {
                const [tournamentSnap, matchesSnap, teamsSnap] = await Promise.all([
                    getDocs(collection(db, 'tournaments')),
                    getDocs(query(collection(db, 'matches'))),
                    getDocs(collection(db, 'teams')),
                ]);

                if (!tournamentSnap.empty) {
                    const tourneyData = tournamentSnap.docs[0].data() as Omit<Tournament, 'id'|'date'> & { date: Timestamp };
                    const date = tourneyData.date.toDate();
                    setTournament({id: tournamentSnap.docs[0].id, ...tourneyData, date });
                } else {
                     toast({ title: 'No Tournament Found', description: 'Please configure a tournament first.', variant: 'destructive'});
                     router.push('/dashboard/tournament');
                     return;
                }

                const allMatches = matchesSnap.docs.map(doc => {
                  const data = doc.data();
                  // Firestore Timestamps need to be converted to JS Date objects
                  const startTime = data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date();
                  const lastUpdateTime = data.lastUpdateTime instanceof Timestamp ? data.lastUpdateTime.toDate() : null;
                  return { id: doc.id, ...data, startTime, lastUpdateTime } as Match;
                });
                setMatches(allMatches);

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
        };
        fetchAndSetData();
    }, [toast, router]);

    const { unassignedMatches, busyCourts, restingTeams } = useMemo(() => {
        const unassigned = matches.filter(m => m.status === 'PENDING');
        
        const now = Date.now();
        const completedMatchesMap = new Map(
            matches.filter(m => m.status === 'COMPLETED' && m.lastUpdateTime)
                   .map(m => [m.id, m.lastUpdateTime!.getTime()])
        );

        const teamLastPlayed = new Map<string, number>();
        matches.forEach(m => {
            if (m.status === 'COMPLETED' && m.lastUpdateTime) {
                const completedTime = m.lastUpdateTime!.getTime();
                teamLastPlayed.set(m.team1Id, completedTime);
                teamLastPlayed.set(m.team2Id, completedTime);
            }
        });

        const resting: Match[] = [];
        const ready: Match[] = [];

        unassigned.forEach(m => {
            const team1LastPlayed = teamLastPlayed.get(m.team1Id);
            const team2LastPlayed = teamLastPlayed.get(m.team2Id);
            const lastMatchTime = Math.max(team1LastPlayed || 0, team2LastPlayed || 0);

            if (lastMatchTime > 0 && (now - lastMatchTime) < MIN_REST_TIME_MS) {
                m.restEndTime = lastMatchTime + MIN_REST_TIME_MS;
                resting.push(m);
            } else {
                ready.push(m);
            }
        });

        ready.sort((a, b) => {
            const getRoundStage = (round: number, teamCount: number) => {
                if (teamCount < 2) return 3; 
                const totalRounds = Math.ceil(Math.log2(teamCount));
                if (round === totalRounds) return 2; // Final
                if (round === totalRounds - 1) return 1; // Semi-Final
                return 0; // Preliminary round
            };

            const aRound = a.round || 0;
            const bRound = b.round || 0;
            const aTeamCount = teamCounts[a.eventType] || 0;
            const bTeamCount = teamCounts[b.eventType] || 0;

            const aStage = getRoundStage(aRound, aTeamCount);
            const bStage = getRoundStage(bRound, bTeamCount);

            if (aStage !== bStage) {
                return aStage - bStage;
            }

            if (aRound !== bRound) {
                return aRound - bRound;
            }
            return a.eventType.localeCompare(b.eventType);
        });

        const busy = new Set(matches
            .filter(m => m.status === 'IN_PROGRESS' || (m.status === 'SCHEDULED' && m.courtName))
            .map(m => m.courtName)
            .filter((name): name is string => !!name)
        );
        return { unassignedMatches: ready, busyCourts: busy, restingTeams: resting };
    }, [matches, teamCounts]);

    const handleCourtChange = (matchId: string, courtName: string) => {
        setMatches(currentMatches => {
            const newMatches = [...currentMatches];
            const matchIndex = newMatches.findIndex(m => m.id === matchId);
            if (matchIndex === -1) return currentMatches;
            
            const oldCourtName = newMatches[matchIndex].courtName;

            if(oldCourtName) {
                 const otherMatchWithOldCourt = newMatches.find(m => m.id !== matchId && m.courtName === oldCourtName);
                 if (!otherMatchWithOldCourt) { }
            }
            for (let i = 0; i < newMatches.length; i++) {
                if (newMatches[i].courtName === courtName && newMatches[i].id !== matchId) {
                    newMatches[i].courtName = '';
                    newMatches[i].status = 'PENDING';
                }
            }

            newMatches[matchIndex] = {
                ...newMatches[matchIndex],
                courtName: courtName,
                status: courtName ? 'SCHEDULED' : 'PENDING',
                startTime: courtName ? Timestamp.now().toDate() : newMatches[matchIndex].startTime,
            };

            return newMatches;
        });
    };
    
    const handleOverride = (matchId: string) => {
        const match = restingTeams.find(m => m.id === matchId);
        if (!match) return;

        // Force a state update by creating new objects.
        const newResting = restingTeams.filter(m => m.id !== matchId);
        const newUnassigned = [...unassignedMatches, match];

        // This is a client-side only state change to move the match between lists.
        // It's a bit of a trick to force re-render. We create a temporary merged list.
        const otherMatches = matches.filter(m => m.status !== 'PENDING');
        setMatches([...otherMatches, ...newResting, ...newUnassigned]);
        
        toast({ title: 'Override Applied', description: `Match is now available for scheduling.`});
    };

    const handleSaveSchedule = async () => {
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            const matchesToUpdate = matches.filter(m => m.status === 'SCHEDULED' && m.courtName);

            if (matchesToUpdate.length === 0) {
                toast({ title: 'No changes to save', description: 'No matches have been assigned to courts.' });
                return;
            }

            matchesToUpdate.forEach(match => {
                const matchRef = doc(db, 'matches', match.id);
                batch.update(matchRef, {
                    status: 'SCHEDULED',
                    courtName: match.courtName,
                    startTime: match.startTime 
                });
            });
            await batch.commit();
            toast({ title: 'Schedule Saved', description: 'Match assignments have been updated.'});
            router.push('/dashboard/umpire');
        } catch (error) {
            console.error("Failed to save schedule:", error);
            toast({ title: 'Save Error', description: 'Failed to save the schedule.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }
    
     const handleResetTournament = async () => {
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            const matchesQuery = await getDocs(collection(db, 'matches'));
            matchesQuery.forEach(doc => batch.delete(doc.ref));

            if (tournament) {
                const tourneyRef = doc(db, 'tournaments', tournament.id);
                batch.update(tourneyRef, { status: 'PENDING' });
            }

            await batch.commit();
            toast({ title: 'Tournament Reset', description: 'All matches have been deleted. You can now re-generate pairings.' });
            setMatches([]);
        } catch (error) {
            toast({ title: 'Error', description: 'Could not reset the tournament.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const assignedButNotSavedCourts = new Set(
        matches.filter(m => m.status === 'SCHEDULED' && m.courtName).map(m => m.courtName)
    );
    

    if (isLoading) {
        return (
             <div className="space-y-4 p-8">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-4 pt-4">
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        )
    }

    const isAdmin = user?.role === 'admin' || user?.role === 'super';

    return (
        <div className="space-y-8 p-4 md:p-8">
            <div className="flex justify-between items-start flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Assign Matches to Courts</h1>
                    <p className="text-muted-foreground">Select a court for each match from the dropdown to schedule it.</p>
                </div>
                 <div className="flex gap-2 flex-wrap">
                     <Button variant="outline" onClick={() => router.push('/dashboard')}>
                        <ArrowLeft /> Back to Dashboard
                    </Button>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">
                                <XCircle className="mr-2" /> Reset Tournament
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete all generated matches and reset the tournament status. This allows you to regenerate the pairings from the tournament page.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleResetTournament}>Reset Tournament</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Button onClick={handleSaveSchedule} disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin" /> : <Play />}
                        Save & Go to Umpire View
                    </Button>
                </div>
            </div>

            {restingTeams.length > 0 && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Teams on Rest Period</CardTitle>
                        <CardDescription>These teams are on a mandatory 10-minute break before their next match.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Match</TableHead>
                                    <TableHead>Time Left</TableHead>
                                    {isAdmin && <TableHead className="text-right">Action</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {restingTeams.map(match => (
                                    <TableRow key={match.id}>
                                         <TableCell>
                                            <div>
                                                <span>{match.team1Name} vs {match.team2Name}</span>
                                                <p className="text-sm text-muted-foreground">
                                                    <EventBadge eventType={match.eventType} className="mr-2" />
                                                    {getRoundName(match.round || 0, match.eventType, teamCounts[match.eventType])}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <CountdownTimer endTime={match.restEndTime!} />
                                        </TableCell>
                                        {isAdmin && (
                                            <TableCell className="text-right">
                                                <Button variant="secondary" size="sm" onClick={() => handleOverride(match.id)}>
                                                    <TimerOff className="mr-2"/> Override
                                                </Button>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                         </Table>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Unassigned Matches</CardTitle>
                    <CardDescription>Matches that are ready to be scheduled.</CardDescription>
                </CardHeader>
                <CardContent>
                    {unassignedMatches.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Event</TableHead>
                                    <TableHead>Round</TableHead>
                                    <TableHead>Match</TableHead>
                                    <TableHead>Assign Court</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {unassignedMatches.map((match) => {
                                    const availableCourtsForThisMatch = tournament?.courtNames.filter(c => 
                                        !busyCourts.has(c.name) && 
                                        (!assignedButNotSavedCourts.has(c.name) || match.courtName === c.name)
                                    ) || [];

                                    return (
                                        <TableRow key={match.id}>
                                            <TableCell><EventBadge eventType={match.eventType} /></TableCell>
                                            <TableCell className="font-medium whitespace-nowrap">{getRoundName(match.round || 0, match.eventType, teamCounts[match.eventType])}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <span>{match.team1Name}</span>
                                                    <p className="text-sm text-muted-foreground">{match.team1OrgName}</p>
                                                </div>
                                                <p className="text-muted-foreground my-1">vs</p>
                                                <div>
                                                    <span>{match.team2Name}</span>
                                                    <p className="text-sm text-muted-foreground">{match.team2OrgName}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                 <Select onValueChange={(value) => handleCourtChange(match.id, value)} value={match.courtName || ''}>
                                                    <SelectTrigger className="w-[180px]">
                                                        <SelectValue placeholder="Select Court" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {availableCourtsForThisMatch.map(court => (
                                                            <SelectItem key={court.name} value={court.name}>
                                                                {court.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    ) : (
                         <p className="text-sm text-muted-foreground py-4 text-center">All matches have been assigned to a court.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

