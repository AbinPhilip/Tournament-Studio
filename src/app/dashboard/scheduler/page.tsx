

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Play, XCircle, TimerOff, ArrowUpDown, GripVertical } from 'lucide-react';
import type { Match, Team, TeamType, Tournament } from '@/types';
import { db } from '@/lib/firebase';
import { collection, doc, writeBatch, query, Timestamp, onSnapshot, getDocs, updateDoc } from 'firebase/firestore';
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
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


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

const TimeSince = ({ startTime }: { startTime: number | null }) => {
    const [timeSince, setTimeSince] = useState(startTime ? Date.now() - startTime : null);

    useEffect(() => {
        if (!startTime) return;
        const interval = setInterval(() => {
            setTimeSince(Date.now() - startTime);
        }, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [startTime]);
    
    if (timeSince === null) {
        return <span className="text-muted-foreground">-</span>;
    }

    const minutes = Math.floor(timeSince / 60000);
    const hours = Math.floor(minutes / 60);
    const displayMinutes = minutes % 60;

    if (hours > 0) {
        return <span>{hours}h {displayMinutes}m ago</span>;
    }
    if (minutes < 1) {
        return <span>&lt;1m ago</span>
    }
    return <span>{minutes}m ago</span>;
}

const SortableMatchRow = ({ match, teamCounts, availableCourts, assignedMatches, handleCourtChange }: { match: Match; teamCounts: Record<TeamType, number>; availableCourts: { name: string }[]; assignedMatches: Record<string, string>; handleCourtChange: (matchId: string, courtName: string) => void; }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: match.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    
    const currentAssignment = assignedMatches[match.id];

    return (
        <TableRow ref={setNodeRef} style={style} {...attributes} className={currentAssignment ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
             <TableCell className="w-12">
                 <div {...listeners} className="cursor-grab p-2">
                    <GripVertical />
                 </div>
            </TableCell>
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
            <TableCell className="text-sm text-muted-foreground">
                <div><TimeSince startTime={match.team1LastPlayed ?? null} /></div>
                <div><TimeSince startTime={match.team2LastPlayed ?? null} /></div>
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
    );
};


export default function SchedulerPage() {
    const { user } = useAuth();
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [unassignedMatches, setUnassignedMatches] = useState<Match[]>([]);
    const [assignedMatches, setAssignedMatches] = useState<Record<string, string>>({}); // { matchId: courtName }
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [teamCounts, setTeamCounts] = useState<Record<TeamType, number>>({
        singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0,
    });
    const [eventFilter, setEventFilter] = useState<TeamType | 'all'>('all');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Match | 'lastPlayed'; direction: 'ascending' | 'descending' } | null>(null);
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));


    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        setIsLoading(true);
        const tourneyUnsub = onSnapshot(collection(db, 'tournaments'), (snapshot) => {
             if (!snapshot.empty) {
                const tourneyData = snapshot.docs[0].data() as Omit<Tournament, 'id'|'date'> & { date: Timestamp };
                const date = tourneyData.date.toDate();
                setTournament({id: snapshot.docs[0].id, ...tourneyData, date, restTime: tourneyData.restTime ?? 10 });
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
             const teamData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
             setTeams(teamData);
             const counts: Record<TeamType, number> = { singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0 };
             teamData.forEach(team => {
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

    const { restingTeams, pendingSummary } = useMemo(() => {
        const allPendingMatches = matches.filter(m => m.status === 'PENDING');
        const minRestTimeMs = (tournament?.restTime || 10) * 60 * 1000;
        
        const now = Date.now();
        const teamMap = new Map(teams.map(t => [t.id, t]));
        
        const playerLastPlayed = new Map<string, number>();
        matches.forEach(m => {
            if (m.status === 'COMPLETED' && m.lastUpdateTime) {
                const completedTime = m.lastUpdateTime!.getTime();
                const team1 = teamMap.get(m.team1Id);
                const team2 = teamMap.get(m.team2Id);
                
                if (team1) {
                    const p1Id = `${team1.player1Name}|${team1.organizationId}`;
                    playerLastPlayed.set(p1Id, Math.max(playerLastPlayed.get(p1Id) || 0, completedTime));
                    if (team1.player2Name) {
                         const p2Id = `${team1.player2Name}|${team1.organizationId}`;
                         playerLastPlayed.set(p2Id, Math.max(playerLastPlayed.get(p2Id) || 0, completedTime));
                    }
                }
                if (team2 && team2.id !== 'BYE') {
                    const p1Id = `${team2.player1Name}|${team2.organizationId}`;
                    playerLastPlayed.set(p1Id, Math.max(playerLastPlayed.get(p1Id) || 0, completedTime));
                    if (team2.player2Name) {
                        const p2Id = `${team2.player2Name}|${team2.organizationId}`;
                        playerLastPlayed.set(p2Id, Math.max(playerLastPlayed.get(p2Id) || 0, completedTime));
                    }
                }
            }
        });

        const resting: Match[] = [];
        const ready: Match[] = [];

        const pendingMatchesForScheduling = allPendingMatches.filter(m => !assignedMatches[m.id]);

        pendingMatchesForScheduling.forEach(match => {
            const m = {...match}; // Create a mutable copy
            if (m.isRestOverridden) {
                ready.push(m);
                return;
            }

            const team1 = teamMap.get(m.team1Id);
            const team2 = teamMap.get(m.team2Id);

            const team1Player1LastPlayed = team1 ? playerLastPlayed.get(`${team1.player1Name}|${team1.organizationId}`) : undefined;
            const team1Player2LastPlayed = team1?.player2Name ? playerLastPlayed.get(`${team1.player2Name}|${team1.organizationId}`) : undefined;
            const team2Player1LastPlayed = team2 ? playerLastPlayed.get(`${team2.player1Name}|${team2.organizationId}`) : undefined;
            const team2Player2LastPlayed = team2?.player2Name ? playerLastPlayed.get(`${team2.player2Name}|${team2.organizationId}`) : undefined;
            
            m.team1LastPlayed = Math.max(team1Player1LastPlayed || 0, team1Player2LastPlayed || 0);
            m.team2LastPlayed = Math.max(team2Player1LastPlayed || 0, team2Player2LastPlayed || 0);
            
            const lastMatchTime = Math.max(m.team1LastPlayed, m.team2LastPlayed);

            if (lastMatchTime > 0 && (now - lastMatchTime) < minRestTimeMs) {
                m.restEndTime = lastMatchTime + minRestTimeMs;
                const restingPlayers: string[] = [];
                if (team1) {
                    if (team1Player1LastPlayed && (now - team1Player1LastPlayed) < minRestTimeMs) restingPlayers.push(team1.player1Name);
                    if (team1.player2Name && team1Player2LastPlayed && (now - team1Player2LastPlayed) < minRestTimeMs) restingPlayers.push(team1.player2Name);
                }
                 if (team2) {
                    if (team2Player1LastPlayed && (now - team2Player1LastPlayed) < minRestTimeMs) restingPlayers.push(team2.player1Name);
                    if (team2.player2Name && team2Player2LastPlayed && (now - team2Player2LastPlayed) < minRestTimeMs) restingPlayers.push(team2.player2Name);
                }
                m.restingPlayers = restingPlayers;
                resting.push(m);
            } else {
                ready.push(m);
            }
        });
        
        const inProgressOrScheduled = new Set(matches
            .filter(m => (m.status === 'IN_PROGRESS' || m.status === 'SCHEDULED') && m.courtName)
            .map(m => m.courtName)
            .filter((name): name is string => !!name)
        );

        const summary = allPendingMatches.reduce((acc, match) => {
            const event = match.eventType;
            const round = match.round || 1;
            if (!acc[event]) {
                acc[event] = {};
            }
            if (!acc[event][round]) {
                acc[event][round] = 0;
            }
            acc[event][round]++;
            return acc;
        }, {} as Record<TeamType, Record<number, number>>);


        return { initialReadyMatches: ready, busyCourts: inProgressOrScheduled, restingTeams: resting, pendingSummary: summary };
    }, [matches, teams, assignedMatches, tournament]);

    useEffect(() => {
        let filteredReady = restingTeams.concat(unassignedMatches.filter(um => !restingTeams.find(rm => rm.id === um.id)));
        
        if (eventFilter !== 'all') {
            filteredReady = filteredReady.filter(m => m.eventType === eventFilter);
        }
        
        if (sortConfig) {
            filteredReady.sort((a,b) => {
                let aVal: any;
                let bVal: any;
                if (sortConfig.key === 'lastPlayed') {
                    aVal = Math.max(a.team1LastPlayed || 0, a.team2LastPlayed || 0);
                    bVal = Math.max(b.team1LastPlayed || 0, b.team2LastPlayed || 0);
                } else {
                    aVal = a[sortConfig.key as keyof Match] ?? 0;
                    bVal = b[sortConfig.key as keyof Match] ?? 0;
                }
                if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        } else {
            filteredReady.sort((a, b) => {
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

                if (aStage !== bStage) return bStage - aStage;
                if (aRound !== bRound) return aRound - bRound;
                return a.eventType.localeCompare(b.eventType);
            });
        }
        
        // Exclude resting teams from the sortable list
        const readyForScheduling = filteredReady.filter(m => !m.restEndTime || m.restEndTime <= Date.now() || m.isRestOverridden);
        setUnassignedMatches(readyForScheduling);

    }, [matches, teams, teamCounts, eventFilter, sortConfig, restingTeams]);


    const handleCourtChange = useCallback((matchId: string, courtName: string) => {
        setAssignedMatches(current => {
            const newAssignments = { ...current };
            
            const existingMatchOnCourt = Object.keys(newAssignments).find(key => newAssignments[key] === courtName);
            if (existingMatchOnCourt) {
                delete newAssignments[existingMatchOnCourt];
            }
            
            newAssignments[matchId] = courtName;
            return newAssignments;
        });
    }, []);
    
    const handleOverride = useCallback(async (matchId: string) => {
        try {
            const matchRef = doc(db, 'matches', matchId);
            await updateDoc(matchRef, { isRestOverridden: true });
            toast({ title: 'Override Applied', description: `Match is now available for scheduling.`});
        } catch (error) {
            console.error("Failed to override rest period:", error);
            toast({ title: 'Error', description: 'Could not apply override.', variant: 'destructive' });
        }
    }, [toast]);


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
            const matchesQuery = query(collection(db, 'matches'));
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
    
    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setUnassignedMatches((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const busyCourts = useMemo(() => new Set(matches
            .filter(m => (m.status === 'IN_PROGRESS' || m.status === 'SCHEDULED') && m.courtName)
            .map(m => m.courtName)
            .filter((name): name is string => !!name)
    ), [matches]);
    
    const currentlyAssignedCourts = useMemo(() => new Set(Object.values(assignedMatches)), [assignedMatches]);
    const availableCourts = useMemo(() => {
        return tournament?.courtNames.filter(c => !busyCourts.has(c.name) && !currentlyAssignedCourts.has(c.name)) || [];
    }, [tournament, busyCourts, currentlyAssignedCourts]);
    
    const requestSort = (key: keyof Match | 'lastPlayed') => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const SortableHeader = ({ sortKey, children }: { sortKey: keyof Match | 'lastPlayed', children: React.ReactNode }) => (
        <Button variant="ghost" onClick={() => requestSort(sortKey)}>
            {children}
            <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
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
    const eventOrder: TeamType[] = ['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles'];
    const availableEventFilters = Array.from(new Set(matches.filter(m => m.status === 'PENDING').map(m => m.eventType)));

    return (
        <div className="space-y-8 p-4 md:p-8">
            <div className="flex justify-between items-start flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Assign Matches to Courts</h1>
                    <p className="text-muted-foreground">Select a court for each match. Drag rows to prioritize the queue.</p>
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
                        <CardDescription>These teams are on a mandatory {tournament?.restTime || 10}-minute break before their next match.</CardDescription>
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
                                {restingTeams.map(match => {
                                    const restingPlayerSet = new Set(match.restingPlayers);
                                    const PlayerName = ({ name }: { name: string }) => (
                                        <span className={restingPlayerSet.has(name) ? 'font-bold text-destructive' : ''}>
                                            {name}
                                        </span>
                                    );

                                    return (
                                        <TableRow key={match.id}>
                                             <TableCell>
                                                <div>
                                                    <p>
                                                        <PlayerName name={match.team1Name.split(' & ')[0]} />
                                                        {match.team1Name.includes(' & ') && ' & '}
                                                        {match.team1Name.includes(' & ') && <PlayerName name={match.team1Name.split(' & ')[1]} />}
                                                        <span className="text-muted-foreground mx-2">vs</span>
                                                        <PlayerName name={match.team2Name.split(' & ')[0]} />
                                                        {match.team2Name.includes(' & ') && ' & '}
                                                        {match.team2Name.includes(' & ') && <PlayerName name={match.team2Name.split(' & ')[1]} />}
                                                    </p>
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
                                    )
                                })}
                            </TableBody>
                         </Table>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Pending Queue Summary</CardTitle>
                    <CardDescription>An overview of all matches waiting to be scheduled.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Event</TableHead>
                                <TableHead>Round</TableHead>
                                <TableHead>Pending Matches</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {eventOrder.map(event => {
                                const summaryForEvent = pendingSummary[event];
                                if (!summaryForEvent) return null;

                                const rounds = Object.entries(summaryForEvent).sort(([a], [b]) => Number(a) - Number(b));
                                
                                return (
                                    <React.Fragment key={event}>
                                        {rounds.map(([round, count], index) => (
                                            <TableRow key={`${event}-${round}`}>
                                                {index === 0 && (
                                                    <TableCell rowSpan={rounds.length} className="align-top">
                                                        <EventBadge eventType={event} />
                                                    </TableCell>
                                                )}
                                                <TableCell>{getRoundName(Number(round), event, teamCounts[event])}</TableCell>
                                                <TableCell className="font-bold">{count}</TableCell>
                                            </TableRow>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>


            <Card>
                <CardHeader>
                     <div className="flex justify-between items-center flex-wrap gap-4">
                        <div>
                            <CardTitle>Unassigned Matches</CardTitle>
                            <CardDescription>Matches that are ready to be scheduled.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                             <Select value={eventFilter} onValueChange={(value) => setEventFilter(value as TeamType | 'all')}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Filter by event" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Events</SelectItem>
                                    {availableEventFilters.map(event => (
                                        <SelectItem key={event} value={event} className="capitalize">{event.replace(/_/g, ' ')}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                     </div>
                </CardHeader>
                <CardContent>
                    {unassignedMatches.length > 0 ? (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12"></TableHead>
                                        <TableHead>Event</TableHead>
                                        <TableHead><SortableHeader sortKey="round">Round</SortableHeader></TableHead>
                                        <TableHead>Match</TableHead>
                                        <TableHead><SortableHeader sortKey="lastPlayed">Last Played</SortableHeader></TableHead>
                                        <TableHead>Assign Court</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <SortableContext items={unassignedMatches} strategy={verticalListSortingStrategy}>
                                    <TableBody>
                                        {unassignedMatches.map((match) => (
                                            <SortableMatchRow
                                                key={match.id}
                                                match={match}
                                                teamCounts={teamCounts}
                                                availableCourts={availableCourts}
                                                assignedMatches={assignedMatches}
                                                handleCourtChange={handleCourtChange}
                                            />
                                        ))}
                                    </TableBody>
                                </SortableContext>
                            </Table>
                        </DndContext>
                    ) : (
                         <p className="text-sm text-muted-foreground py-4 text-center">
                            {eventFilter === 'all'
                                ? 'All matches have been assigned to a court.'
                                : `No pending matches for ${eventFilter.replace(/_/g, ' ')}.`
                            }
                         </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

