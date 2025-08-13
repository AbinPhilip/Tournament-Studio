
"use client";

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc, query, updateDoc, Timestamp, deleteDoc } from 'firebase/firestore';
import type { Tournament, Team, Match, TeamType } from '@/types';
import { Loader2, Save, Trash2, GripVertical, Users } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';

// Draggable Team Item
const DraggableTeam = ({ team, isOverlay }: { team: Team, isOverlay?: boolean }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: team.id,
        data: { type: 'team', team },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging || isOverlay ? 10 : 'auto',
        cursor: isOverlay ? 'grabbing' : 'grab',
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={`p-2 mb-2 rounded-lg border bg-card shadow-sm flex items-center gap-2 ${isOverlay ? 'ring-2 ring-primary' : ''}`}>
             <Image 
                data-ai-hint="badminton players"
                src={team.photoUrl || 'https://placehold.co/40x40.png'} 
                alt="Team photo" 
                width={40} 
                height={40} 
                className="rounded-md object-cover"
            />
            <div className="flex-grow">
                <p className="font-semibold text-sm">{team.player1Name}{team.player2Name ? ` & ${team.player2Name}` : ''}</p>
                <p className="text-xs text-muted-foreground">Lot: {team.lotNumber || 'N/A'}</p>
            </div>
            <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
    );
};

// Droppable Slot for a team in a match
const DroppableSlot = ({ id, team, onRemove, children }: { id: string, team: Team | null, onRemove?: (teamId: string) => void, children?: React.ReactNode }) => {
    const { setNodeRef, isOver } = useSortable({ id });

    const handleRemove = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (team && onRemove) {
            onRemove(team.id);
        }
    }

    return (
        <div
            ref={setNodeRef}
            className={`h-24 p-2 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground relative ${isOver ? 'border-primary bg-primary/10' : 'border-border'}`}
        >
            {team ? (
                 <div className="relative w-full">
                    <DraggableTeam team={team} />
                    {onRemove && (
                         <button onClick={handleRemove} className="absolute top-0 right-0 p-1 bg-destructive/80 text-destructive-foreground rounded-full hover:bg-destructive leading-none">
                            <Trash2 className="h-3 w-3" />
                         </button>
                    )}
                </div>
            ) : <div className="text-center text-xs">{children}</div>}
        </div>
    );
};


export default function SchedulerPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [tournament, setTournament] = useState<(Omit<Tournament, 'date'> & { date: Date }) | null>(null);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    
    // DND states
    const [activeId, setActiveId] = useState<string | null>(null);
    const sensors = useSensors(useSensor(PointerSensor));

    const activeTeam = useMemo(() => allTeams.find(t => t.id === activeId), [activeId, allTeams]);

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            const tournamentSnap = await getDocs(collection(db, 'tournaments'));
            if (tournamentSnap.empty) {
                toast({ title: 'No Tournament Found', description: 'Please create a tournament first.', variant: 'destructive' });
                setIsLoading(false);
                return;
            }
            const tourneyDoc = tournamentSnap.docs[0];
            const tourneyData = tourneyDoc.data() as Omit<Tournament, 'id'|'date'> & { date: Timestamp };
            setTournament({ 
                id: tourneyDoc.id, 
                ...tourneyData,
                date: tourneyData.date.toDate() 
            });

            const teamsSnap = await getDocs(collection(db, 'teams'));
            setAllTeams(teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));

            const matchesSnap = await getDocs(collection(db, 'matches'));
            const matchesData = matchesSnap.docs.map(doc => {
                const match = doc.data() as Omit<Match, 'id' | 'startTime'> & { startTime: Timestamp };
                return { id: doc.id, ...match, startTime: match.startTime.toDate() }
            }).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
            setMatches(matchesData as Match[]);

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ title: 'Error', description: 'Failed to fetch tournament data.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const unscheduledTeams = useMemo(() => {
        const scheduledTeamIds = new Set(matches.flatMap(m => [m.team1Id, m.team2Id].filter(Boolean)));
        return allTeams.filter(t => !scheduledTeamIds.has(t.id));
    }, [allTeams, matches]);
    
    const handleSaveSchedule = async () => {
        if (!tournament) return;
        
        const validMatchesToSave = matches.filter(m => m.team1Id && m.team2Id && m.status === 'PENDING');
        if (validMatchesToSave.length === 0) {
            toast({ title: 'No new valid matches to save', description: 'Create a match by dropping two teams onto a court.', variant: 'destructive' });
            return;
        }

        setIsSaving(true);
        try {
            if (tournament.status === 'PENDING') {
                const tournamentRef = doc(db, 'tournaments', tournament.id);
                await updateDoc(tournamentRef, { status: 'IN_PROGRESS', startedAt: new Date() });
                setTournament(prev => prev ? { ...prev, status: 'IN_PROGRESS' } : null);
            }
            
            const batch = writeBatch(db);
            validMatchesToSave.forEach(match => {
                const { id, ...matchData } = match;
                const dataToSave = {
                    ...matchData,
                    startTime: Timestamp.fromDate(matchData.startTime as Date),
                    status: 'SCHEDULED'
                } as any;
                
                const matchRef = doc(db, 'matches', id);
                batch.set(matchRef, dataToSave);
            });

            await batch.commit();
            setMatches(prev => prev.map(m => validMatchesToSave.find(ms => ms.id === m.id) ? { ...m, status: 'SCHEDULED' } : m));
            toast({ title: 'Schedule Saved!', description: `${validMatchesToSave.length} matches have been saved successfully.` });
        } catch (error) {
            console.error(error);
            toast({ title: 'Error Saving Schedule', description: 'An error occurred while saving.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleClearSchedule = async () => {
        setIsLoading(true);
        try {
            const batch = writeBatch(db);
            const querySnapshot = await getDocs(collection(db, 'matches'));
            querySnapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            
            if (tournament) {
                const tournamentRef = doc(db, 'tournaments', tournament.id);
                await updateDoc(tournamentRef, { status: 'PENDING' });
                setTournament(prev => prev ? { ...prev, status: 'PENDING' } : null);
            }

            setMatches([]);
            toast({ title: 'Schedule Cleared', description: 'All matches have been deleted.' });
        } catch (error) {
            console.error("Error clearing schedule:", error);
            toast({ title: 'Error', description: 'Failed to clear schedule.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;
        
        const activeTeam = allTeams.find(t => t.id === active.id);
        if (!activeTeam) return;

        const overId = over.id as string;
        const [courtName, slot] = overId.split('-');

        setMatches(prevMatches => {
            const newMatches = [...prevMatches];
            // Find an existing match on this court or create a new one.
            let matchOnCourt = newMatches.find(m => m.courtName === courtName);
            
            if (!matchOnCourt) {
                matchOnCourt = {
                    id: courtName, // Use court name as a temporary ID
                    team1Id: '', team2Id: '',
                    team1Name: '', team2Name: '',
                    eventType: activeTeam.type, // Set event type based on first team
                    courtName: courtName,
                    startTime: new Date(), // Match is "now"
                    status: 'PENDING',
                    round: 1
                };
                newMatches.push(matchOnCourt);
            }

            const match = matchOnCourt;

            // Validate drop
            if (match.eventType !== activeTeam.type) {
                toast({ title: 'Invalid Matchup', description: 'Teams must be from the same event type.', variant: 'destructive' });
                return prevMatches;
            }
            if ((slot === 'team1' && match.team1Id) || (slot === 'team2' && match.team2Id)) {
                toast({ title: 'Slot Occupied', description: 'This slot is already taken.', variant: 'destructive' });
                return prevMatches;
            }
            if (match.team1Id === activeTeam.id || match.team2Id === activeTeam.id) {
                toast({ title: 'Team Already in Match', description: 'This team is already in this match.', variant: 'destructive' });
                return prevMatches;
            }
            
            // Update match
            if (slot === 'team1') {
                match.team1Id = activeTeam.id;
                match.team1Name = activeTeam.player1Name + (activeTeam.player2Name ? ` & ${activeTeam.player2Name}` : '');
            } else {
                match.team2Id = activeTeam.id;
                match.team2Name = activeTeam.player1Name + (activeTeam.player2Name ? ` & ${activeTeam.player2Name}` : '');
            }

            return newMatches;
        });
    };

    const handleRemoveTeamFromCourt = (teamIdToRemove: string, courtName: string) => {
        setMatches(prevMatches => {
            const match = prevMatches.find(m => m.courtName === courtName);
            if (!match) return prevMatches;

            if (match.status === 'SCHEDULED') {
                toast({ title: 'Cannot Modify', description: 'This match is already saved. Clear the schedule to make changes.', variant: 'destructive'});
                return prevMatches;
            }
            
            if (match.team1Id === teamIdToRemove) {
                match.team1Id = '';
                match.team1Name = '';
            } else if (match.team2Id === teamIdToRemove) {
                match.team2Id = '';
                match.team2Name = '';
            }

            // If match is now empty, remove it entirely
            if (!match.team1Id && !match.team2Id) {
                return prevMatches.filter(m => m.courtName !== courtName);
            }

            return [...prevMatches];
        });
    }

    const teamsByEvent = useMemo(() => {
        return unscheduledTeams.reduce((acc, team) => {
            if (!acc[team.type]) {
                acc[team.type] = [];
            }
            acc[team.type].push(team);
            return acc;
        }, {} as Record<TeamType, Team[]>);
    }, [unscheduledTeams]);
    
    const matchesByCourt = useMemo(() => {
        return matches.reduce((acc, match) => {
            acc[match.courtName] = match;
            return acc;
        }, {} as Record<string, Match>);
    }, [matches]);


    if (isLoading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
    
    if (!tournament) {
         return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <CardTitle>No Tournament Found</CardTitle>
                <CardDescription>Please configure the tournament before using the scheduler.</CardDescription>
            </div>
        )
    }

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex flex-col h-full">
                <CardHeader className="px-0">
                    <CardTitle>Live Match Scheduler</CardTitle>
                    <CardDescription>
                        Drag teams from the left and drop them onto a court on the right to start a match immediately.
                    </CardDescription>
                </CardHeader>
                
                <div className="flex-grow flex flex-col lg:flex-row gap-4 overflow-hidden">
                    {/* Left Panel: Teams */}
                    <Card className="lg:w-1/3 flex flex-col">
                        <CardHeader>
                            <CardTitle>Available Teams</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow overflow-hidden">
                            <ScrollArea className="h-full pr-4">
                                {Object.keys(teamsByEvent).length > 0 ? Object.entries(teamsByEvent).map(([type, eventTeams]) => (
                                    eventTeams.length > 0 && (
                                        <div key={type} className="mb-4">
                                            <h3 className="font-semibold capitalize mb-2 p-2 rounded-md bg-muted">{type.replace(/_/g, ' ')}</h3>
                                            <SortableContext items={eventTeams.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                                {eventTeams.map(team => <DraggableTeam key={team.id} team={team} />)}
                                            </SortableContext>
                                        </div>
                                    )
                                )) : <p className="text-sm text-muted-foreground">No available teams to schedule.</p>}
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Right Panel: Schedule */}
                    <Card className="lg:w-2/3 flex flex-col">
                         <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                               <CardTitle>Courts</CardTitle>
                               <CardDescription>{tournament?.tournamentType} | Ready for immediate play</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleSaveSchedule} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="animate-spin" /> : <Save />} Save Schedule
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive"><Trash2 /> Clear Schedule</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>This will delete all matches (saved and unsaved) and reset the tournament status. This action cannot be undone.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleClearSchedule} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-grow overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {tournament.courtNames.map(court => {
                                    const match = matchesByCourt[court.name];
                                    const team1 = match?.team1Id ? allTeams.find(t => t.id === match.team1Id) : null;
                                    const team2 = match?.team2Id ? allTeams.find(t => t.id === match.team2Id) : null;
                                    
                                    const handleRemoveTeam1 = () => handleRemoveTeamFromCourt(team1!.id, court.name);
                                    const handleRemoveTeam2 = () => handleRemoveTeamFromCourt(team2!.id, court.name);

                                    return (
                                        <Card key={court.name}>
                                            <CardHeader>
                                                <CardTitle className="flex justify-between items-center">
                                                   <span>{court.name}</span> 
                                                   {match && <Badge variant={match.status === 'SCHEDULED' ? 'default' : 'secondary'} className="capitalize text-xs">{match.eventType.replace(/_/g, ' ')}</Badge>}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                 {match?.status === 'SCHEDULED' && (
                                                    <div className="text-center text-sm p-4 bg-green-100 text-green-800 rounded-md">
                                                        Match is scheduled and live!
                                                    </div>
                                                 )}
                                                 {match?.status === 'COMPLETED' && (
                                                    <div className="text-center text-sm p-4 bg-blue-100 text-blue-800 rounded-md">
                                                        Match completed. Court is free.
                                                    </div>
                                                 )}
                                                 {!match || match?.status === 'PENDING' ? (
                                                    <SortableContext items={[`${court.name}-team1`, `${court.name}-team2`]}>
                                                        <div className="space-y-2">
                                                            <DroppableSlot id={`${court.name}-team1`} team={team1 || null} onRemove={handleRemoveTeam1}>
                                                                Drop Team 1 Here
                                                            </DroppableSlot>
                                                            <div className="text-center font-bold">VS</div>
                                                            <DroppableSlot id={`${court.name}-team2`} team={team2 || null} onRemove={handleRemoveTeam2}>
                                                                Drop Team 2 Here
                                                            </DroppableSlot>
                                                        </div>
                                                     </SortableContext>
                                                 ) : null}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
             <DragOverlay>
                {activeId && activeTeam ? <DraggableTeam team={activeTeam} isOverlay /> : null}
            </DragOverlay>
        </DndContext>
    );
}


    