
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
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical, ArrowLeft, Loader2, Users, XCircle } from 'lucide-react';
import type { Match, Tournament } from '@/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch, query, Timestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
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
} from "@/components/ui/alert-dialog"

const MatchCard = ({ match, isOverlay }: { match: Match; isOverlay?: boolean }) => {
    return (
        <Card className={cn('p-4 mb-2 touch-none', isOverlay ? 'shadow-lg' : 'shadow-sm')}>
            <div className="flex items-center justify-between">
                <div className="flex-grow">
                    <p className="font-semibold text-sm">{match.team1Name} vs {match.team2Name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{match.eventType.replace(/_/g, ' ')}</p>
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

const CourtColumn = ({ courtName, matches, isOccupied }: { courtName: string; matches: Match[], isOccupied: boolean }) => {
    const { setNodeRef } = useSortable({ id: courtName, data: { type: 'court' } });
  
    return (
        <Card ref={setNodeRef} className={cn("flex-1 min-w-[300px] transition-colors", isOccupied ? 'bg-red-100 dark:bg-red-900/50' : 'bg-green-100 dark:bg-green-900/50')}>
            <CardHeader>
                <CardTitle className="text-lg capitalize">{courtName}</CardTitle>
            </CardHeader>
            <SortableContext id={courtName} items={matches.map(m => ({id: m.id}))} strategy={verticalListSortingStrategy}>
              <CardContent className="min-h-[100px] p-2">
                  {matches.length > 0 ? (
                      matches.map(m => <SortableMatchCard key={m.id} match={m} />)
                  ) : (
                      <div className="flex items-center justify-center h-full border-2 border-dashed border-muted-foreground/20 rounded-md p-4">
                          <p className="text-muted-foreground text-sm">Drop match here</p>
                      </div>
                  )}
              </CardContent>
            </SortableContext>
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

    const fetchAndSetData = async () => {
        setIsLoading(true);
        try {
            const [tournamentSnap, matchesSnap] = await Promise.all([
                getDocs(collection(db, 'tournaments')),
                getDocs(query(collection(db, 'matches'))),
            ]);

            if (!tournamentSnap.empty) {
                const tourneyData = tournamentSnap.docs[0].data() as Omit<Tournament, 'id'|'date'> & { date: Timestamp };
                const date = tourneyData.date instanceof Timestamp ? tourneyData.date.toDate() : new Date();
                setTournament({id: tournamentSnap.docs[0].id, ...tourneyData, date });
            } else {
                 toast({ title: 'No Tournament Found', description: 'Please configure a tournament first.', variant: 'destructive'});
                 router.push('/dashboard/tournament');
                 return; // Stop execution if no tournament
            }

            const allMatches = matchesSnap.docs.map(doc => {
              const data = doc.data();
              const startTime = data.startTime instanceof Timestamp ? data.startTime.toDate() : data.startTime;
              return { id: doc.id, ...data, startTime } as Match;
            });
            setMatches(allMatches);

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

    const { unassignedMatches, courtAssignments } = useMemo(() => {
        const unassigned: Match[] = [];
        const assignments: Record<string, Match[]> = {};
        
        if (tournament) {
            tournament.courtNames.forEach(c => assignments[c.name] = []);
        }

        matches.forEach(match => {
            if (match.status === 'PENDING' || !match.courtName) {
                unassigned.push(match);
            } else if ((match.status === 'SCHEDULED' || match.status === 'IN_PROGRESS') && match.courtName) {
                if (assignments[match.courtName]) {
                    assignments[match.courtName].push(match);
                } else {
                    // If court somehow doesn't exist in tournament, treat as unassigned
                    unassigned.push(match);
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
    
        if (!over || !active.id) return;
    
        const activeMatchId = active.id as string;
        const droppedMatch = matches.find(m => m.id === activeMatchId);
        if (!droppedMatch) return;
    
        const targetContainerId = over.id as string;
    
        const isCourtDrop = tournament?.courtNames.some(c => c.name === targetContainerId);
        const isUnassignedDrop = targetContainerId === 'unassigned-column';
    
        // Check if dropping onto an occupied court
        if (isCourtDrop && courtAssignments[targetContainerId]?.length > 0) {
            // Allow if dragging within the same court (reordering, though not supported, won't trigger error)
            // or if the dropped match is the one already in that court
            const isSelfDrop = courtAssignments[targetContainerId][0]?.id === activeMatchId;
            if (!isSelfDrop) {
                toast({
                    title: 'Court Occupied',
                    description: `Court ${targetContainerId} already has a match.`,
                    variant: 'destructive',
                });
                return; // Prevent drop
            }
        }
    
        setMatches(prevMatches => {
            return prevMatches.map(match => {
                if (match.id !== activeMatchId) return match;
    
                if (isCourtDrop) {
                    return {
                        ...match,
                        courtName: targetContainerId,
                        status: 'SCHEDULED',
                        startTime: Timestamp.now().toDate()
                    };
                }
    
                if (isUnassignedDrop) {
                    const { courtName, startTime, ...rest } = match;
                    return { ...rest, status: 'PENDING', courtName: '', startTime: new Date() };
                }
    
                return match; // Return unchanged if not a valid drop target
            });
        });
    };
    
    const handleSaveSchedule = async () => {
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            matches.forEach(match => {
                const matchRef = doc(db, 'matches', match.id);
                const dataToUpdate: Partial<Match> & {startTime?: Timestamp} = {
                    status: match.status,
                    courtName: match.courtName || '', // Use empty string for unassigned
                };
                 if (match.status === 'SCHEDULED' && match.startTime) {
                    dataToUpdate.startTime = Timestamp.fromDate(new Date(match.startTime));
                 } else if (match.status === 'PENDING') {
                    dataToUpdate.startTime = undefined; // Firestore SDK should handle removing field
                    dataToUpdate.courtName = '';
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
    
    const handleClearSchedule = async () => {
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
            toast({ title: 'Schedule Cleared', description: 'All matches have been deleted and tournament status is PENDING.' });
            setMatches([]);
        } catch (error) {
            toast({ title: 'Error', description: 'Could not clear schedule.', variant: 'destructive' });
        }
    };

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
                <div className="flex justify-between items-start flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Assign Matches to Courts</h1>
                        <p className="text-muted-foreground">Drag unassigned matches to an available court to start them.</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                         <Button variant="outline" onClick={() => router.push('/dashboard/tournament')}>
                            <ArrowLeft /> Back to Setup
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">
                                    <XCircle className="mr-2" /> Clear All
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete all generated matches and reset the tournament status. You will have to regenerate them from the tournament page.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClearSchedule}>Clear Schedule</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

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
                        <SortableContext id="unassigned-column" items={unassignedMatches.map(m => ({id: m.id}))} strategy={verticalListSortingStrategy}>
                          <CardContent>
                                {unassignedMatches.length > 0 ? (
                                    unassignedMatches.map(match => (
                                        <SortableMatchCard key={match.id} match={match} />
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground py-4 text-center">No more matches to schedule.</p>
                                )}
                          </CardContent>
                        </SortableContext>
                    </Card>

                    {/* Court Columns */}
                    <div className="flex-grow grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {tournament?.courtNames.map(court => {
                            const courtMatches = courtAssignments[court.name] || [];
                            const isOccupied = courtMatches.length > 0;
                            return (
                             <CourtColumn
                                key={court.name}
                                courtName={court.name}
                                matches={courtMatches}
                                isOccupied={isOccupied}
                            />
                            )
                        })}
                    </div>
                </div>
            </div>
            <DragOverlay>
                {activeMatch ? <MatchCard match={activeMatch} isOverlay /> : null}
            </DragOverlay>
        </DndContext>
    );
}
