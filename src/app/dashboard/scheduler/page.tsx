
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Play, XCircle } from 'lucide-react';
import type { Match, Tournament, Team, TeamType } from '@/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch, query, Timestamp, where } from 'firebase/firestore';
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

export default function SchedulerPage() {
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

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
                const date = tourneyData.date instanceof Timestamp ? tourneyData.date.toDate() : new Date();
                setTournament({id: tournamentSnap.docs[0].id, ...tourneyData, date });
            } else {
                 toast({ title: 'No Tournament Found', description: 'Please configure a tournament first.', variant: 'destructive'});
                 router.push('/dashboard/tournament');
                 return;
            }

            const allMatches = matchesSnap.docs.map(doc => {
              const data = doc.data();
              const startTime = data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date();
              return { id: doc.id, ...data, startTime } as Match;
            });
            setMatches(allMatches);
            
            setTeams(teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data()} as Team)));

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ title: 'Error', description: 'Failed to fetch tournament data.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchAndSetData();
    }, []);

    const { unassignedMatches, busyCourts } = useMemo(() => {
        const unassigned = matches.filter(m => m.status === 'PENDING');
        const busy = new Set(matches
            .filter(m => m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS')
            .map(m => m.courtName)
            .filter(Boolean)
        );
        return { unassignedMatches: unassigned, busyCourts: busy };
    }, [matches]);

    const handleCourtChange = (matchId: string, courtName: string) => {
        setMatches(currentMatches => currentMatches.map(m => {
            if (m.id === matchId) {
                return { 
                    ...m, 
                    courtName: courtName,
                    status: courtName ? 'SCHEDULED' : 'PENDING',
                    // Set a new start time when scheduled, revert if unscheduled
                    startTime: courtName ? new Date() : m.startTime,
                };
            }
            return m;
        }));
    };

    const handleSaveSchedule = async () => {
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            const matchesToUpdate = matches.filter(m => m.status === 'SCHEDULED' && m.courtName);

            if (matchesToUpdate.length === 0) {
                toast({ title: 'No changes to save', description: 'No matches have been assigned to courts.' });
                setIsSaving(false);
                return;
            }

            matchesToUpdate.forEach(match => {
                const matchRef = doc(db, 'matches', match.id);
                batch.update(matchRef, {
                    status: 'SCHEDULED',
                    courtName: match.courtName,
                    startTime: match.startTime // This will now be a valid Date object
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
        try {
            const batch = writeBatch(db);
            const matchesQuery = await getDocs(collection(db, 'matches'));
            matchesQuery.forEach(doc => {
                batch.delete(doc.ref);
            });

            if (tournament) {
                const tourneyRef = doc(db, 'tournaments', tournament.id);
                batch.update(tourneyRef, { status: 'PENDING' });
            }

            await batch.commit();
            toast({ title: 'Tournament Reset', description: 'All matches have been deleted and tournament status is now PENDING. You can now re-generate pairings.' });
            setMatches([]);
            router.push('/dashboard/tournament');
        } catch (error) {
            toast({ title: 'Error', description: 'Could not reset the tournament.', variant: 'destructive' });
        }
    };

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
                                This will permanently delete all generated matches and reset the tournament status to PENDING. This allows you to regenerate the pairings from the tournament page.
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

            <Card>
                <CardHeader>
                    <CardTitle>Unassigned Matches</CardTitle>
                    <CardDescription>Matches that need to be scheduled.</CardDescription>
                </CardHeader>
                <CardContent>
                    {unassignedMatches.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Event</TableHead>
                                    <TableHead>Match</TableHead>
                                    <TableHead>Assign Court</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {unassignedMatches.map((match) => (
                                    <TableRow key={match.id}>
                                        <TableCell className="capitalize">{match.eventType.replace(/_/g, ' ')}</TableCell>
                                        <TableCell>
                                            <div>
                                                <span>{match.team1Name}</span>
                                                <p className="font-bold">{match.team1OrgName}</p>
                                            </div>
                                            <p className="text-muted-foreground my-1">vs</p>
                                            <div>
                                                <span>{match.team2Name}</span>
                                                <p className="font-bold">{match.team2OrgName}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                             <Select onValueChange={(value) => handleCourtChange(match.id, value)}>
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue placeholder="Select Court" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {tournament?.courtNames.filter(c => !busyCourts.has(c.name)).map(court => (
                                                        <SelectItem key={court.name} value={court.name}>
                                                            {court.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                ))}
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

    