
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Play, XCircle, TimerOff } from 'lucide-react';
import type { Match, Team, TeamType, Tournament } from '@/types';
import { db } from '@/lib/firebase';
import { collection, doc, writeBatch, query, Timestamp, onSnapshot } from 'firebase/firestore';
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
    const [assignedMatches, setAssignedMatches] = useState<Record<string, string>>({}); // { matchId: courtName }
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [teamCounts, setTeamCounts] = useState<Record<TeamType, number>>({
        singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0,
    });
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        setIsLoading(true);
        const tourneyUnsub = onSnapshot(collection(db, 'tournaments'), (snapshot) => {
             if (!snapshot.empty) {
                const tourneyData = snapshot.docs[0].data() as Omit<Tournament, 'id'|'date'> & { date: Timestamp };
                const date = tourneyData.date.toDate();
                setTournament({id: snapshot.docs[0].id, ...tourneyData, date });
            } else {
                 toast({ title: 'No Tournament Found', description: 'Please configure a tournament first.', variant: 'destructive'});
                 router.push('/dashboard/tournament');
            }
        });

        const matchesUnsub = onSnapshot(collection(db, 'matches'), (snapshot) => {
             const allMatches = snapshot.docs.map(doc => {
                  const data = doc.data();
                  return { 
                      id: doc.id, ...data, 
                      startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(),
                      lastUpdateTime: data.lastUpdateTime instanceof Timestamp ? data.lastUpdateTime.toDate() : null
                  } as Match;
             });
             setMatches(allMatches);
             setIsLoading(false);
        });

        const teamsUnsub = onSnapshot(collection(db, 'teams'), (snapshot) => {
             const counts: Record<TeamType, number> = { singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0 };
             snapshot.forEach(doc => {
                const team = doc.data() as Team;
                if (counts[team.type] !== undefined) counts[team.type]++;
            });
            setTeamCounts(counts);
        });

        return () => {
            tourneyUnsub();
            matchesUnsub();
            teamsUnsub();
        }
    }, [toast, router]);

    const { unassignedMatches, busyCourts, restingTeams } = useMemo(() => {
        const unassigned = matches.filter(m => m.status === 'PENDING' && !assignedMatches[m.id]);
        
        const now = Date.now();
        const teamLastPlayed = new Map<string, number>();
        matches.forEach(m => {
            if (m.status === 'COMPLETED' && m.lastUpdateTime) {
                const completedTime = m.lastUpdateTime!.getTime();
                teamLastPlayed.set(m.team1Id, completedTime);
                if (m.team2Id) teamLastPlayed.set(m.team2Id, completedTime);
            }
        });

        const resting: Match[] = [];
        const ready: Match[] = [];

        unassigned.forEach(m => {
            const team1LastPlayed = teamLastPlayed.get(m.team1Id);
            const team2LastPlayed = m.team2Id ? teamLastPlayed.get(m.team2Id) : undefined;
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

            if (aStage !== bStage) return aStage - bStage;
            if (aRound !== bRound) return aRound - bRound;
            return a.eventType.localeCompare(b.eventType);
        });

        const inProgressOrScheduled = new Set(matches
            .filter(m => (m.status === 'IN_PROGRESS' || m.status === 'SCHEDULED') && m.courtName)
            .map(m => m.courtName)
            .filter((name): name is string => !!name)
        );

        return { unassignedMatches: ready, busyCourts: inProgressOrScheduled, restingTeams: resting };
    }, [matches, teamCounts, assignedMatches]);

    const handleCourtChange = useCallback((matchId: string, courtName: string) => {
        setAssignedMatches(current => {
            const newAssignments = { ...current };
            // Unassign any other match that was assigned to this court
            Object.keys(newAssignments).forEach(key => {
                if (newAssignments[key] === courtName) {
                    delete newAssignments[key];
                }
            });
            // Assign the new match
            newAssignments[matchId] = courtName;
            return newAssignments;
        });
    }, []);
    
    const handleOverride = useCallback((matchId: string) => {
        const matchToMove = restingTeams.find(m => m.id === matchId);
        if (!matchToMove) return;

        // By setting the lastUpdateTime to be far in the past, we trick the memoization
        // into moving it to the ready queue on the next re-render.
        setMatches(current => current.map(m => m.id === matchId ? {...m, lastUpdateTime: new Date(0)} : m));
        toast({ title: 'Override Applied', description: `Match is now available for scheduling.`});
    }, [restingTeams, toast]);


    const handleSaveSchedule = async () => {
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            
            if (Object.keys(assignedMatches).length === 0) {
                toast({ title: 'No changes to save', description: 'No matches have been assigned to courts.' });
                return;
            }

            Object.entries(assignedMatches).forEach(([matchId, courtName]) => {
                const matchRef = doc(db, 'matches', matchId);
                batch.update(matchRef, {
                    status: 'SCHEDULED',
                    courtName: courtName,
                    startTime: Timestamp.now() 
                });
            });

            await batch.commit();
            toast({ title: 'Schedule Saved', description: 'Match assignments have been updated.'});
            setAssignedMatches({}); // Clear local assignments after saving
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
            const matchesQuery = await collection(db, 'matches');
            const matchesSnapshot = await getDocs(matchesQuery);
            matchesSnapshot.forEach(doc => batch.delete(doc.ref));

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
    
    const currentlyAssignedCourts = useMemo(() => new Set(Object.values(assignedMatches)), [assignedMatches]);
    const availableCourts = useMemo(() => {
        return tournament?.courtNames.filter(c => !busyCourts.has(c.name) && !currentlyAssignedCourts.has(c.name)) || [];
    }, [tournament, busyCourts, currentlyAssignedCourts]);
    

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
                     {isAdmin && (
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
                     )}
                    <Button onClick={handleSaveSchedule} disabled={isSaving || Object.keys(assignedMatches).length === 0}>
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
                                    const currentAssignment = assignedMatches[match.id];
                                    return (
                                        <TableRow key={match.id} className={currentAssignment ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
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
                                                 <Select onValueChange={(value) => handleCourtChange(match.id, value)} value={currentAssignment || ''}>
                                                    <SelectTrigger className="w-[180px]">
                                                        <SelectValue placeholder="Select Court" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {currentAssignment && <SelectItem value={currentAssignment}>{currentAssignment}</SelectItem>}
                                                        {availableCourts.map(court => (
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
