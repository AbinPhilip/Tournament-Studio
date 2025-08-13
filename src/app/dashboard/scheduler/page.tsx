
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc, query, updateDoc, Timestamp, where } from 'firebase/firestore';
import type { Tournament, Team, Match, TeamType } from '@/types';
import { Loader2, Save, Trash2, GripVertical, Users } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay, type DragStartEvent, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
const DroppableSlot = ({ matchId, slot, team, onDrop, eventType }: { matchId: string, slot: 'team1' | 'team2', team: Team | null, onDrop: (teamId: string, matchId: string, slot: 'team1' | 'team2') => void, eventType: TeamType }) => {
    const { setNodeRef, isOver } = useSortable({ id: `${matchId}-${slot}`, data: { type: 'slot', accepts: eventType } });

    return (
        <div
            ref={setNodeRef}
            className={`h-20 p-2 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground ${isOver ? 'border-primary bg-primary/10' : 'border-border'}`}
        >
            {team ? <DraggableTeam team={team} /> : <span className="text-xs">Drop Team Here</span>}
        </div>
    );
};


export default function SchedulerPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [tournament, setTournament] = useState<(Omit<Tournament, 'date'> & { date: Date }) | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    
    // DND states
    const [activeId, setActiveId] = useState<string | null>(null);
    const sensors = useSensors(useSensor(PointerSensor));

    const activeTeam = useMemo(() => teams.find(t => t.id === activeId), [activeId, teams]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const tournamentSnap = await getDocs(collection(db, 'tournaments'));
                if (tournamentSnap.empty) {
                    toast({ title: 'No Tournament Found', description: 'Please create a tournament first.', variant: 'destructive' });
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
                setTeams(teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));

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
        };
        fetchData();
    }, [toast]);
    
    
    const handleSaveSchedule = async () => {
        if (!tournament) return;
        
        const matchesToSave = matches.filter(m => m.status === 'PENDING');
        if (matchesToSave.length === 0) {
            toast({ title: 'No new matches to save', variant: 'destructive' });
            return;
        }

        setIsSaving(true);
        try {
            // Check if tournament status needs to be updated
            if (tournament.status === 'PENDING') {
                const tournamentRef = doc(db, 'tournaments', tournament.id);
                await updateDoc(tournamentRef, { status: 'IN_PROGRESS', startedAt: new Date() });
                setTournament(prev => prev ? { ...prev, status: 'IN_PROGRESS' } : null);
            }
            
            const batch = writeBatch(db);
            matchesToSave.forEach(match => {
                const { id, ...matchData } = match;
                // Convert dates back to Timestamps for Firestore
                const dataToSave = {
                    ...matchData,
                    startTime: Timestamp.fromDate(matchData.startTime as Date)
                }
                const matchRef = doc(db, 'matches', id);
                batch.set(matchRef, dataToSave);
            });

            await batch.commit();

            // Update local state to 'SCHEDULED'
            setMatches(prev => prev.map(m => 
                matchesToSave.find(ms => ms.id === m.id) ? { ...m, status: 'SCHEDULED' } : m
            ));

            toast({ title: 'Schedule Saved!', description: `${matchesToSave.length} matches have been saved successfully.` });
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
            const matchesCollectionRef = collection(db, 'matches');
            const querySnapshot = await getDocs(matchesCollectionRef);
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

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;
    
        const activeData = active.data.current;
        const overData = over.data.current;
    
        if (activeData?.type === 'team' && overData?.type === 'slot') {
            const team = activeData.team as Team;
            if (team.type !== overData.accepts) {
                 // Potentially show a visual indicator that it's not a valid drop target
            }
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeTeam = teams.find(t => t.id === active.id);
        if (!activeTeam) return;

        const overData = over.data.current;
        if (overData?.type !== 'slot') return;
        
        // Check if event types match
        if (activeTeam.type !== overData.accepts) {
            toast({ title: 'Invalid Matchup', description: 'Teams must be from the same event type.', variant: 'destructive' });
            return;
        }

        const [matchId, slot] = (over.id as string).split('-');
        
        setMatches(prev => {
            const newMatches = [...prev];
            const matchIndex = newMatches.findIndex(m => m.id === matchId);
            if (matchIndex === -1) return prev;

            const match = newMatches[matchIndex];
            
            // Prevent dropping on an occupied slot or dropping same team twice
            if ((slot === 'team1' && match.team1Id) || (slot === 'team2' && match.team2Id) || match.team1Id === activeTeam.id || match.team2Id === activeTeam.id) {
                 toast({ title: 'Slot Occupied', description: 'This slot is already taken or team is already in match.', variant: 'destructive' });
                 return prev;
            }

            if (slot === 'team1') {
                match.team1Id = activeTeam.id;
                match.team1Name = activeTeam.player1Name + (activeTeam.player2Name ? ` & ${activeTeam.player2Name}` : '');
            } else {
                match.team2Id = activeTeam.id;
                match.team2Name = activeTeam.player1Name + (activeTeam.player2Name ? ` & ${activeTeam.player2Name}` : '');
            }

            // Remove team from available list
            setTeams(currentTeams => currentTeams.filter(t => t.id !== active.id));
            
            return newMatches;
        });

    };
    
    const initializeSchedule = useCallback(() => {
        if (!tournament) return;
        const newMatches: Match[] = [];
        const tournamentDate = tournament.date;
        const startTime = 9; // 9 AM
        const endTime = 20; // 8 PM

        for (let i = startTime; i < endTime; i++) {
            tournament.courtNames.forEach(court => {
                const matchTime = new Date(tournamentDate);
                matchTime.setHours(i, 0, 0, 0);

                // Create a shell match for each event type. User will populate them.
                const eventTypes: TeamType[] = ['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles'];
                eventTypes.forEach(eventType => {
                     newMatches.push({
                        id: `${court.name}-${i}-${eventType}`, // A temporary, unique ID for the slot
                        team1Id: '',
                        team2Id: '',
                        team1Name: '',
                        team2Name: '',
                        eventType: eventType,
                        courtName: court.name,
                        startTime: matchTime,
                        status: 'PENDING',
                        round: 1, // Assume first round for manual scheduling
                    });
                })
            });
        }
        setMatches(newMatches);

    }, [tournament]);

    useEffect(() => {
        // If there are no existing matches from DB and we have tournament data, initialize the schedule grid
        if (matches.length === 0 && tournament && teams.length > 0) {
            initializeSchedule();
        }
    }, [matches.length, tournament, teams.length, initializeSchedule]);

    
    const unscheduledTeams = useMemo(() => {
        const scheduledTeamIds = new Set(matches.flatMap(m => [m.team1Id, m.team2Id]));
        return teams.filter(t => !scheduledTeamIds.has(t.id));
    }, [teams, matches]);
    
    const teamsByEvent = useMemo(() => {
        return unscheduledTeams.reduce((acc, team) => {
            if (!acc[team.type]) {
                acc[team.type] = [];
            }
            acc[team.type].push(team);
            return acc;
        }, {} as Record<TeamType, Team[]>);
    }, [unscheduledTeams]);
    
    const scheduleGrid = useMemo(() => {
        const grid: Record<string, Record<string, Match[]>> = {}; // { time: { courtName: [matches] } }
        if (!tournament) return grid;

        matches.forEach(match => {
            const time = (match.startTime as Date).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
            if (!grid[time]) grid[time] = {};
            if (!grid[time][match.courtName]) grid[time][match.courtName] = [];
            grid[time][match.courtName].push(match);
        });
        return grid;
    }, [matches, tournament]);
    
    const timeSlots = useMemo(() => Object.keys(scheduleGrid).sort((a,b) => new Date('1970/01/01 ' + a).getTime() - new Date('1970/01/01 ' + b).getTime()), [scheduleGrid]);


    if (isLoading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
            <div className="flex flex-col h-full">
                <CardHeader className="px-0">
                    <CardTitle>Match Scheduler</CardTitle>
                    <CardDescription>
                        Drag teams from the left panel and drop them onto court time slots on the right to create a match.
                    </CardDescription>
                </CardHeader>
                
                <div className="flex-grow flex gap-4 overflow-hidden">
                    {/* Left Panel: Teams */}
                    <Card className="w-1/3 flex flex-col">
                        <CardHeader>
                            <CardTitle>Available Teams</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow overflow-hidden">
                            <ScrollArea className="h-full">
                                {Object.entries(teamsByEvent).map(([type, eventTeams]) => (
                                    eventTeams.length > 0 && (
                                        <div key={type} className="mb-4">
                                            <h3 className="font-semibold capitalize mb-2 p-2 rounded-md bg-muted">{type.replace(/_/g, ' ')}</h3>
                                            <SortableContext items={eventTeams.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                                {eventTeams.map(team => <DraggableTeam key={team.id} team={team} />)}
                                            </SortableContext>
                                        </div>
                                    )
                                ))}
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Right Panel: Schedule */}
                    <Card className="w-2/3 flex flex-col">
                         <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                               <CardTitle>Court Schedule</CardTitle>
                               <CardDescription>{tournament?.tournamentType} | {tournament?.date.toDateString()}</CardDescription>
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
                           <div className="grid gap-x-4" style={{ gridTemplateColumns: `60px repeat(${tournament?.courtNames.length || 1}, 1fr)` }}>
                                {/* Header Row */}
                                <div />
                                {tournament?.courtNames.map(court => (
                                    <div key={court.name} className="font-bold text-center sticky top-0 bg-background py-2">{court.name}</div>
                                ))}

                                {/* Schedule Rows */}
                                {timeSlots.map(time => (
                                    <React.Fragment key={time}>
                                        <div className="font-semibold text-right pr-2 sticky left-0 bg-background">{time}</div>
                                        {tournament?.courtNames.map(court => {
                                            const matchesInSlot = scheduleGrid[time]?.[court.name] || [];
                                            const match = matchesInSlot[0] || null; // Simplified: one match per slot for now
                                            
                                            if (!match) return <div key={court.name} className="border-b border-l p-1 min-h-[120px]"></div>;

                                            const team1 = match.team1Id ? teams.find(t => t.id === match.team1Id) || null : null;
                                            const team2 = match.team2Id ? teams.find(t => t.id === match.team2Id) || null : null;
                                            
                                            return (
                                                <div key={court.name} className="border-b border-l p-1 space-y-2">
                                                    <Badge variant="outline" className="capitalize">{match.eventType.replace(/_/g, ' ')}</Badge>
                                                    <div className="space-y-1">
                                                        <SortableContext items={[`${match.id}-team1`, `${match.id}-team2`]}>
                                                            <DroppableSlot matchId={match.id} slot="team1" team={team1} onDrop={() => {}} eventType={match.eventType} />
                                                            <div className="text-center text-sm font-bold">vs</div>
                                                            <DroppableSlot matchId={match.id} slot="team2" team={team2} onDrop={() => {}} eventType={match.eventType} />
                                                        </SortableContext>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
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
