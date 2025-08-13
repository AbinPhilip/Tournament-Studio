
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
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
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import type { Match, TeamType } from '@/types';
import { Loader2, ArrowLeft, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { recordMatchResult } from '@/ai/flows/record-match-result-flow';


const scoreFormSchema = z.object({
  score: z.string().regex(/^\d{1,2}-\d{1,2}$/, { message: "Score must be in format '10-21'" }),
  winnerId: z.string({ required_error: "Please select a winner." }),
});


export default function UmpirePage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [matches, setMatches] = useState<Match[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const form = useForm<z.infer<typeof scoreFormSchema>>({
        resolver: zodResolver(scoreFormSchema),
    });

    const fetchMatches = async () => {
        setIsLoading(true);
        try {
            const matchesQuery = query(collection(db, 'matches'), orderBy('courtName'), orderBy('startTime'));
            const matchesSnap = await getDocs(matchesQuery);
            const matchesData = matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
            setMatches(matchesData);
        } catch (error) {
            console.error("Error fetching matches:", error);
            toast({ title: 'Error', description: 'Failed to fetch matches.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchMatches();
    }, []);
    
    useEffect(() => {
        if (selectedMatch) {
            form.reset({ score: selectedMatch.score || '', winnerId: selectedMatch.winnerId || undefined });
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
                score: values.score,
                winnerId: values.winnerId,
            });

            toast({
                title: 'Score Recorded!',
                description: `The result for match ${selectedMatch.team1Name} vs ${selectedMatch.team2Name} has been saved.`
            });

            setIsDialogOpen(false);
            setSelectedMatch(null);
            fetchMatches(); // Refresh the matches list to show new state and potential new matches
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Failed to record match result.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const groupedMatchesByCourt = useMemo(() => {
        return matches.reduce((acc, match) => {
            const courtName = match.courtName;
            if (!acc[courtName]) {
                acc[courtName] = [];
            }
            acc[courtName].push(match);
            return acc;
        }, {} as Record<string, Match[]>);
    }, [matches]);

    const courtNames = useMemo(() => Object.keys(groupedMatchesByCourt).sort(), [groupedMatchesByCourt]);


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
                                            <TableHead>Time</TableHead>
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
                                            <TableRow key={match.id}>
                                                <TableCell className="font-medium">{format(match.startTime.toDate(), 'p')}</TableCell>
                                                <TableCell className="capitalize">{match.eventType.replace(/_/g, ' ')}</TableCell>
                                                <TableCell className={match.winnerId === match.team1Id ? 'font-bold' : ''}>{match.team1Name}</TableCell>
                                                <TableCell className={match.winnerId === match.team2Id ? 'font-bold' : ''}>{match.team2Name}</TableCell>
                                                <TableCell>{match.score || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={match.status === 'COMPLETED' ? 'default' : match.status === 'IN_PROGRESS' ? 'secondary' : 'outline'}>
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

             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                <DialogHeader>
                    <DialogTitle>Record Score</DialogTitle>
                    <DialogDescription>
                        Enter the final score for: <span className="font-semibold">{selectedMatch?.team1Name} vs {selectedMatch?.team2Name}</span>
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="score"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Final Score</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. 21-18" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="winnerId"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                <FormLabel>Select Winner</FormLabel>
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
