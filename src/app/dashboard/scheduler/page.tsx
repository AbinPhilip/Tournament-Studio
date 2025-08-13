
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GripVertical, ArrowLeft, Loader2, Users } from 'lucide-react';
import type { Match, Tournament } from '@/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch, query, where, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

const MatchCard = ({ match, isOverlay }: { match: Match; isOverlay?: boolean }) => {
    return (
        <Card className={`p-4 mb-2 touch-none ${isOverlay ? 'shadow-lg' : 'shadow-sm'}`}>
            <div className="flex items-center justify-between">
                <div className="flex-grow">
                    <p className="font-semibold text-sm">{match.team1Name} vs {match.team2Name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{match.eventType.replace('_', ' ')}</p>
                </div>
                <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
        </Card>
    );
};

const SortableMatchCard = ({ match }: { match: Match }) => {    
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: match.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <MatchCard match={match} />
    </div>
  );
};

const CourtColumn = ({ courtName, matches }: { courtName: string; matches: Match[] }) => {
    const { setNodeRef } = useSortable({ id: courtName });
  
    return (
        <Card ref={setNodeRef} className="flex-1 min-w-[300px] bg-muted/50">
            <CardHeader>
                <CardTitle className="text-lg capitalize">{courtName}</CardTitle>
            </CardHeader>
            <CardContent className="min-h-[100px] p-2">
                {matches.length > 0 ? (
                    matches.map(m => <MatchCard key={m.id} match={m} />)
                ) : (
                    <div className="flex items-center justify-center h-full border-2 border-dashed border-muted-foreground/20 rounded-md p-4">
                        <p className="text-muted-foreground text-sm">Drop match here</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


export default function SchedulerPage() {
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(useSensor(PointerSensor));

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [tournamentSnap, matchesSnap] = await Promise.all([
                    getDocs(collection(db, 'tournaments')),
                    getDocs(collection(db, 'matches')),
                ]);

                if (!tournamentSnap.empty) {
                    const tourneyData = tournamentSnap.docs[0].data() as Omit<Tournament, 'id'|'date'> & { date: Timestamp };
                    setTournament({id: tournamentSnap.docs[0].id, ...tourneyData, date: tourneyData.date.toDate()});
                } else {
                     toast({ title: 'No Tournament Found', description: 'Please configure a tournament first.', variant: 'destructive'});
                     router.push('/dashboard/tournament');
                }

                setMatches(matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match)));
            } catch (error) {
                console.error("Error fetching data:", error);
                toast({ title: 'Error', description: 'Failed to fetch tournament data.', variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [toast, router]);

    const { unassignedMatches, courtAssignments } = useMemo(() => {
        const unassigned: Match[] = [];
        const assignments: Record<string, Match[]> = {};
        
        if (tournament) {
            tournament.courtNames.forEach(c => assignments[c.name] = []);
        }

        matches.forEach(match => {
            if (match.status === 'PENDING') {
                unassigned.push(match);
            } else if (match.status === 'SCHEDULED' && match.courtName) {
                if (assignments[match.courtName]) {
                    assignments[match.courtName].push(match);
                }
            }
        });
        unassigned.sort((a,b) => (a.round || 0) - (b.round || 0));

        return { unassignedMatches: unassigned, courtAssignments: assignments };
    }, [matches, tournament]);
    
    const activeMatch = useMemo(() => matches.find(m => m.id === activeId), [activeId, matches]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;
        
        const activeMatchId = active.id as string;
        const targetContainerId = over.id as string;

        // Ensure we are dropping onto a court or back to the unassigned list
        const isCourtDrop = tournament?.courtNames.some(c => c.name === targetContainerId);
        if (!isCourtDrop && targetContainerId !== 'unassigned') return;
        
        // Find the match being dragged
        const draggedMatch = matches.find(m => m.id === activeMatchId);
        if (!draggedMatch) return;
        
        // Prevent dropping on a court that is already occupied
        if (isCourtDrop && courtAssignments[targetContainerId].length > 0) {
            toast({ title: 'Court Occupied', description: `Court ${targetContainerId} already has a match.`, variant: 'destructive' });
            return;
        }

        setMatches(prev => prev.map(m => {
            if (m.id === activeMatchId) {
                if (isCourtDrop) {
                     return { ...m, courtName: targetContainerId, status: 'SCHEDULED', startTime: new Date() };
                } else { // Dropped back to unassigned
                     return { ...m, courtName: undefined, status: 'PENDING', startTime: undefined };
                }
            }
            return m;
        }));
    };
    
    const handleSaveSchedule = async () => {
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            matches.forEach(match => {
                const matchRef = doc(db, 'matches', match.id);
                const dataToUpdate: Partial<Match> = {
                    status: match.status,
                    courtName: match.courtName || undefined,
                };
                if (match.startTime && match.status === 'SCHEDULED') {
                    dataToUpdate.startTime = Timestamp.fromDate(match.startTime as Date);
                } else {
                    dataToUpdate.startTime = undefined;
                }
                batch.update(matchRef, dataToUpdate as any);
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

    if (isLoading) {
        return (
             <div className="space-y-4 p-8">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-4 pt-4">
                    <Skeleton className="h-96 w-1/4" />
                    <Skeleton className="h-96 flex-grow" />
                </div>
            </div>
        )
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="space-y-4 p-4 md:p-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Assign Matches</h1>
                        <p className="text-muted-foreground">Drag unassigned matches to an available court to start them.</p>
                    </div>
                    <div className="flex gap-2">
                         <Button variant="outline" onClick={() => router.push('/dashboard')}>
                            <ArrowLeft /> Back
                        </Button>
                        <Button onClick={handleSaveSchedule} disabled={isSaving}>
                            {isSaving ? <Loader2 className="animate-spin" /> : <Users />}
                            Go to Umpire View
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-8">
                    {/* Unassigned Matches */}
                    <Card className="w-full md:w-1/3 lg:w-1/4">
                        <CardHeader>
                            <CardTitle>Unassigned Matches</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <SortableContext id="unassigned" items={unassignedMatches.map(m => ({id: m.id}))} strategy={verticalListSortingStrategy}>
                                {unassignedMatches.length > 0 ? (
                                    unassignedMatches.map(match => (
                                        <SortableMatchCard key={match.id} match={match} />
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground py-4 text-center">No more matches to schedule.</p>
                                )}
                            </SortableContext>
                        </CardContent>
                    </Card>

                    {/* Court Columns */}
                    <div className="flex-grow grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {tournament?.courtNames.map(court => (
                             <SortableContext key={court.name} id={court.name} items={courtAssignments[court.name]?.map(m => ({id: m.id})) || []}>
                                <CourtColumn
                                    courtName={court.name}
                                    matches={courtAssignments[court.name] || []}
                                />
                             </SortableContext>
                        ))}
                    </div>
                </div>
            </div>
            <DragOverlay>
                {activeMatch ? <MatchCard match={activeMatch} isOverlay /> : null}
            </DragOverlay>
        </DndContext>
    );
}
