
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import type { Match, TeamType } from '@/types';
import { Loader2, ArrowLeft, Pencil, PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { recordMatchResult } from '@/ai/flows/record-match-result-flow';


const scoreFormSchema = z.object({
  winnerId: z.string({ required_error: "Please select a winner." }),
  isForfeited: z.boolean().default(false),
  scores: z.array(z.object({
    team1: z.coerce.number().int().min(0, "Score must be positive").max(100),
    team2: z.coerce.number().int().min(0, "Score must be positive").max(100),
  })).optional(),
}).refine(data => {
    // If not forfeited, scores must be provided
    if (!data.isForfeited && (!data.scores || data.scores.length === 0)) {
        return false;
    }
    return true;
}, {
    message: "At least one set score is required unless the match is forfeited.",
    path: ["scores"],
});


// Function to get the total number of rounds for a knockout tournament
const getTotalRounds = (teamCount: number) => {
    if (teamCount < 2) return 0;
    return Math.ceil(Math.log2(teamCount));
};

export default function UmpirePage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [matches, setMatches] = useState<Match[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [teamCounts, setTeamCounts] = useState<Record<TeamType, number>>({
        singles: 0,
        mens_doubles: 0,
        womens_doubles: 0,
        mixed_doubles: 0,
    });

    const form = useForm<z.infer<typeof scoreFormSchema>>({
        resolver: zodResolver(scoreFormSchema),
        defaultValues: {
            isForfeited: false,
            scores: [{team1: 0, team2: 0}],
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "scores"
    });
    
    const getRoundName = useCallback((round: number, eventType: TeamType) => {
        const teamCount = teamCounts[eventType];
        if (teamCount === 0) return `Round ${round}`;
        const totalRounds = getTotalRounds(teamCount);
        if (totalRounds === 0) return `Round ${round}`;
    
        if (round === totalRounds) return 'Final';
        if (round === totalRounds - 1) return 'Semi-Finals';
        if (round === totalRounds - 2) return 'Quarter-Finals';
        
        return `Round ${round}`;

    }, [teamCounts]);


    const fetchMatchesAndCounts = useCallback(async () => {
        setIsLoading(true);
        try {
            const [matchesSnap, teamsSnap] = await Promise.all([
                getDocs(query(collection(db, 'matches'), orderBy('startTime', 'desc'))),
                getDocs(collection(db, 'teams')),
            ]);

            const matchesData = matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Omit<Match, 'startTime'> & {startTime: Timestamp})).map(m => ({...m, startTime: m.startTime?.toDate()}));
            setMatches(matchesData as Match[]);

            const counts = { singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0 };
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
    }, [toast]);
    
    useEffect(() => {
        fetchMatchesAndCounts();
    }, [fetchMatchesAndCounts]);
    
    useEffect(() => {
        if (selectedMatch) {
            form.reset({
                winnerId: selectedMatch.winnerId || undefined,
                isForfeited: !!selectedMatch.forfeitedById,
                scores: selectedMatch.scores && selectedMatch.scores.length > 0 ? selectedMatch.scores : [{team1: 0, team2: 0}],
            });
            setIsDialogOpen(true);
        }
    }, [selectedMatch, form]);

    const handleEditClick = (match: Match) => {
        if (match.status === 'COMPLETED') {
            toast({ title: 'Match Completed', description: 'This match score cannot be edited.' });
            return;
        }
        setSelectedMatch(match);
    };

    const onSubmit = async (values: z.infer<typeof scoreFormSchema>) => {
        if (!selectedMatch) return;
        setIsSubmitting(true);
        try {
            await recordMatchResult({
                matchId: selectedMatch.id,
                scores: values.scores,
                winnerId: values.winnerId,
                isForfeited: values.isForfeited
            });

            toast({
                title: 'Score Recorded!',
                description: `The result for match ${selectedMatch.team1Name} vs ${selectedMatch.team2Name} has been saved.`
            });

            setIsDialogOpen(false);
            setSelectedMatch(null);
            await fetchMatchesAndCounts(); // Refresh the matches list to show new state and potential new matches
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Failed to record match result.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const groupedMatchesByCourt = useMemo(() => {
        return matches.reduce((acc, match) => {
            const courtName = match.courtName || "Unassigned";
            if (!acc[courtName]) {
                acc[courtName] = [];
            }
            acc[courtName].push(match);
            return acc;
        }, {} as Record<string, Match[]>);
    }, [matches]);

    const courtNames = useMemo(() => Object.keys(groupedMatchesByCourt).sort(), [groupedMatchesByCourt]);

    const watchIsForfeited = form.watch('isForfeited');


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
                        <CardTitle>Umpire View</CardTitle>
                        <CardDescription>
                            View matches by court and record scores.
                        </CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => router.push('/dashboard')}>
                        <ArrowLeft className="mr-2" />
                        Back to Dashboard
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {matches.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">No matches scheduled.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {courtNames.map(courtName => (
                            <div key={courtName}>
                                <h3 className="text-xl font-bold mb-4 capitalize">
                                    {courtName}
                                </h3>
                                <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Round</TableHead>
                                            <TableHead>Event</TableHead>
                                            <TableHead>Team 1</TableHead>
                                            <TableHead>Team 2</TableHead>
                                            <TableHead>Score</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {groupedMatchesByCourt[courtName].map(match => (
                                            <TableRow key={match.id} className={match.status === 'IN_PROGRESS' ? 'bg-yellow-50' : ''}>
                                                <TableCell className="font-medium">{match.round ? getRoundName(match.round, match.eventType) : 'N/A'}</TableCell>
                                                <TableCell className="capitalize">{match.eventType.replace(/_/g, ' ')}</TableCell>
                                                <TableCell className={match.winnerId === match.team1Id ? 'font-bold' : ''}>{match.team1Name}</TableCell>
                                                <TableCell className={match.winnerId === match.team2Id ? 'font-bold' : ''}>{match.team2Name}</TableCell>
                                                <TableCell>{match.score || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={match.status === 'COMPLETED' ? 'default' : (match.status === 'IN_PROGRESS' || match.status === 'SCHEDULED') ? 'secondary' : 'outline'}>
                                                        {match.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEditClick(match)} disabled={match.status === 'COMPLETED'}>
                                                        <Pencil className="h-4 w-4"/>
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

             <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
                 if (!isOpen) {
                     setSelectedMatch(null);
                 }
                 setIsDialogOpen(isOpen);
             }}>
                <DialogContent>
                <DialogHeader>
                    <DialogTitle>Record Score</DialogTitle>
                    <DialogDescription>
                        Enter the final score for: <span className="font-semibold">{selectedMatch?.team1Name} vs {selectedMatch?.team2Name}</span>.
                        Manually selecting a winner is the final authority, especially for tie-breakers.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        
                        <FormField
                            control={form.control}
                            name="isForfeited"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl>
                                    <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>
                                    Match was forfeited
                                    </FormLabel>
                                    <FormMessage />
                                </div>
                                </FormItem>
                            )}
                        />

                        {!watchIsForfeited && (
                            <div className="space-y-4">
                                {fields.map((item, index) => (
                                    <div key={item.id} className="flex items-center gap-2">
                                        <FormLabel className="w-16">Set {index + 1}:</FormLabel>
                                        <FormField
                                            control={form.control}
                                            name={`scores.${index}.team1`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl><Input type="number" placeholder={selectedMatch?.team1Name} {...field} /></FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <span>-</span>
                                        <FormField
                                            control={form.control}
                                            name={`scores.${index}.team2`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl><Input type="number" placeholder={selectedMatch?.team2Name} {...field} /></FormControl>
                                                </FormItem>
                                            )}
                                        />
                                         <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>X</Button>
                                    </div>
                                ))}
                                 <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => append({ team1: 0, team2: 0 })}
                                >
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Set
                                </Button>
                                 <FormMessage>{form.formState.errors.scores?.message}</FormMessage>
                            </div>
                        )}
                        
                         <FormField
                            control={form.control}
                            name="winnerId"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                <FormLabel>Select Winner (Final Decision)</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="flex flex-col space-y-1"
                                    >
                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl>
                                        <RadioGroupItem value={selectedMatch?.team1Id || ''} />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                            {selectedMatch?.team1Name}
                                        </FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl>
                                        <RadioGroupItem value={selectedMatch?.team2Id || ''} />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                           {selectedMatch?.team2Name}
                                        </FormLabel>
                                    </FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />

                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Result
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
