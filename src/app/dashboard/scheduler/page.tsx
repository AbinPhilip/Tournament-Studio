
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc, query, deleteDoc } from 'firebase/firestore';
import type { Tournament, Team, Match, TeamType } from '@/types';
import { Loader2, CalendarPlus, Trash2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { scheduleMatches } from '@/ai/flows/schedule-matches-flow';
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

export default function SchedulerPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const tournamentSnap = await getDocs(collection(db, 'tournaments'));
                if (tournamentSnap.empty) {
                    toast({ title: 'No Tournament Found', description: 'Please create a tournament first.', variant: 'destructive' });
                    router.push('/dashboard/tournament');
                    return;
                }
                const tourneyDoc = tournamentSnap.docs[0];
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { date, ...tourneyData } = tourneyDoc.data();
                setTournament({ id: tourneyDoc.id, ...tourneyData } as Tournament);

                const teamsSnap = await getDocs(collection(db, 'teams'));
                setTeams(teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));

                const matchesSnap = await getDocs(collection(db, 'matches'));
                const matchesData = matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match))
                    .sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis());
                setMatches(matchesData);

            } catch (error) {
                console.error("Error fetching data:", error);
                toast({ title: 'Error', description: 'Failed to fetch tournament data.', variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [toast, router]);

    const handleGenerateSchedule = async () => {
        if (!tournament || teams.length === 0) {
            toast({ title: 'Cannot Generate Schedule', description: 'Missing tournament data or registered teams.', variant: 'destructive'});
            return;
        }
        
        if (matches.length > 0) {
            toast({ title: 'Existing Schedule Found', description: 'Please clear the current schedule before generating a new one.', variant: 'destructive' });
            return;
        }

        setIsGenerating(true);
        try {
            const generatedMatches = await scheduleMatches({ teams, tournament });
            
            if (!generatedMatches || generatedMatches.length === 0) {
                toast({ title: 'Schedule Generation Failed', description: 'The AI could not generate a schedule. Please try again.', variant: 'destructive' });
                setIsGenerating(false);
                return;
            }

            const batch = writeBatch(db);
            const matchesCollection = collection(db, 'matches');

            const newMatches: Match[] = [];

            generatedMatches.forEach(matchData => {
                const newDocRef = doc(matchesCollection);
                const startTimeTimestamp = Timestamp.fromDate(matchData.startTime);
                const newMatch: Match = {
                    id: newDocRef.id,
                    ...matchData,
                    startTime: startTimeTimestamp,
                };
                batch.set(newDocRef, { ...matchData, startTime: startTimeTimestamp });
                newMatches.push(newMatch);
            });

            await batch.commit();
            
            newMatches.sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis());
            setMatches(newMatches);

            toast({ title: 'Schedule Generated!', description: `${newMatches.length} matches have been scheduled.` });

        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'An error occurred while generating the schedule.', variant: 'destructive' });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleClearSchedule = async () => {
        setIsLoading(true);
        try {
            const batch = writeBatch(db);
            const matchesCollectionRef = collection(db, 'matches');
            const querySnapshot = await getDocs(matchesCollectionRef);
            querySnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            setMatches([]);
            toast({ title: 'Schedule Cleared', description: 'All matches have been deleted.' });
        } catch (error) {
            console.error("Error clearing schedule:", error);
            toast({ title: 'Error', description: 'Failed to clear schedule.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

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
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Match Scheduler</CardTitle>
                        <CardDescription>
                            Generate and view the tournament match schedule. Current format: <span className="font-semibold capitalize">{tournament?.tournamentType?.replace('-', ' ')}</span>
                        </CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => router.push('/dashboard')}>
                        <ArrowLeft className="mr-2" />
                        Back to Dashboard
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-wrap gap-4 p-4 border rounded-lg bg-muted/50">
                    <Button onClick={handleGenerateSchedule} disabled={isGenerating || matches.length > 0}>
                        {isGenerating ? (
                            <Loader2 className="mr-2 animate-spin" />
                        ) : (
                            <CalendarPlus className="mr-2" />
                        )}
                        Generate Schedule
                    </Button>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={matches.length === 0}>
                                <Trash2 className="mr-2" />
                                Clear Schedule
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete all scheduled matches.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClearSchedule} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
                
                {matches.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">No matches scheduled. Click "Generate Schedule" to begin.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {eventOrder.map(eventType => groupedMatches[eventType] && (
                            <div key={eventType}>
                                <h3 className="text-xl font-bold mb-4 capitalize">{eventType.replace(/_/g, ' ')}</h3>
                                <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Start Time</TableHead>
                                            <TableHead>Court</TableHead>
                                            <TableHead>Team 1</TableHead>
                                            <TableHead>Team 2</TableHead>
                                            <TableHead>Status</TableHead>
                                             {tournament?.tournamentType === 'knockout' && <TableHead>Round</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {groupedMatches[eventType].map(match => (
                                            <TableRow key={match.id}>
                                                <TableCell className="font-medium">{format(match.startTime.toDate(), 'p')}</TableCell>
                                                <TableCell>{match.courtName}</TableCell>
                                                <TableCell>{match.team1Name}</TableCell>
                                                <TableCell>{match.team2Name}</TableCell>
                                                <TableCell>
                                                    <Badge variant={match.status === 'COMPLETED' ? 'default' : 'secondary'}>
                                                        {match.status}
                                                    </Badge>
                                                </TableCell>
                                                {tournament?.tournamentType === 'knockout' && <TableCell>{match.round}</TableCell>}
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
