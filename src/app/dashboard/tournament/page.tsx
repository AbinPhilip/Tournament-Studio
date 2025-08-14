
"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Save, ArrowLeft, CheckCircle, Calendar as CalendarIcon, Loader2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, updateDoc, DocumentReference, query, Timestamp, where, writeBatch } from 'firebase/firestore';
import type { Tournament, Team, TeamType, Organization } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


const tournamentFormSchema = z.object({
  location: z.string().min(3, { message: 'Location must be at least 3 characters.' }),
  date: z.date({ required_error: 'A tournament date is required.'}),
  tournamentType: z.enum(['round-robin', 'knockout'], { required_error: 'Tournament type is required.' }),
  numberOfCourts: z.coerce.number().min(1, { message: 'There must be at least 1 court.' }).max(50, { message: "Cannot exceed 50 courts."}),
  courtNames: z.array(z.object({ name: z.string().min(1, {message: 'Court name cannot be empty.'}) })),
});


export default function TournamentSettingsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [tournament, setTournament] = useState<(Omit<Tournament, 'date'> & { date: Date }) | null>(null);
  const [tournamentDocRef, setTournamentDocRef] = useState<DocumentReference | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const form = useForm<z.infer<typeof tournamentFormSchema>>({
    resolver: zodResolver(tournamentFormSchema),
    defaultValues: {
      location: '',
      date: new Date(),
      tournamentType: 'knockout',
      numberOfCourts: 4,
      courtNames: Array.from({ length: 4 }, () => ({ name: '' })),
    },
  });
  

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "courtNames",
  });

  const numberOfCourts = form.watch('numberOfCourts');
  const isTournamentStarted = tournament?.status === 'IN_PROGRESS' || tournament?.status === 'COMPLETED';

  useEffect(() => {
    const numCourts = isNaN(numberOfCourts) || numberOfCourts < 1 ? 1 : numberOfCourts > 50 ? 50 : numberOfCourts;
    const currentCourtNames = form.getValues('courtNames').map(f => f.name);
    const newCourtNames = Array.from({ length: numCourts }, (_, i) => ({
      name: currentCourtNames[i] || `Court ${i + 1}`,
    }));
    replace(newCourtNames);
  }, [numberOfCourts, replace, form]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [tournamentSnap, teamsSnap, orgsSnap] = await Promise.all([
          getDocs(collection(db, 'tournaments')),
          getDocs(collection(db, 'teams')),
          getDocs(collection(db, 'organizations')),
        ]);
        
        if (!tournamentSnap.empty) {
          const tournamentDoc = tournamentSnap.docs[0];
          const data = tournamentDoc.data() as Omit<Tournament, 'id'|'date'> & { date: Timestamp };
          const tournamentData = { id: tournamentDoc.id, ...data, date: data.date.toDate()};
          setTournament(tournamentData)
          setTournamentDocRef(tournamentDoc.ref);
          form.reset({
            ...data,
            date: data.date.toDate(),
          });
        } else {
            setTournamentDocRef(null);
            setTournament(null);
        }
        
        setTeams(teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
        setOrganizations(orgsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization)));
        
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to fetch data.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [form, toast]);


  const onTournamentSubmit = async (values: z.infer<typeof tournamentFormSchema>) => {
    try {
      const dataToSave: Partial<Tournament> & { date: Timestamp } = {
        ...values,
        date: Timestamp.fromDate(values.date),
      };

      if (tournamentDocRef) {
        await updateDoc(tournamentDocRef, dataToSave as { [x: string]: any });
      } else {
        const q = query(collection(db, 'tournaments'));
        const querySnapshot = await getDocs(q);
        if(!querySnapshot.empty) {
            toast({ title: 'Error', description: 'A tournament is already configured. Please update the existing one.', variant: 'destructive'});
            return;
        }
        const newDocRef = doc(collection(db, 'tournaments'));
        await setDoc(newDocRef, { ...dataToSave, status: 'PENDING' });
        setTournamentDocRef(newDocRef);
        setTournament({ id: newDocRef.id, ...values });
      }
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to save tournament details.', variant: 'destructive' });
    }
  };
  
 const getOrgName = (orgId: string) => organizations.find(o => o.id === orgId)?.name || 'N/A';

 const handleGenerateSchedule = async () => {
    if (!tournament) {
        toast({ title: 'Error', description: 'Please create and save a tournament first.', variant: 'destructive'});
        return;
    }
     if (teams.length < 2) {
        toast({ title: 'Not enough teams', description: 'You need at least 2 teams to generate a schedule.', variant: 'destructive' });
        return;
    }
    if (teams.some(t => t.lotNumber === undefined || t.lotNumber === null)) {
        toast({ title: 'Missing Lot Numbers', description: 'Please assign a lot number to every team on the Teams page before generating pairings.', variant: 'destructive' });
        return;
    }

    setIsGenerating(true);
    try {
        const batch = writeBatch(db);

        // Clear existing matches
        const existingMatchesQuery = await getDocs(collection(db, 'matches'));
        existingMatchesQuery.forEach(doc => batch.delete(doc.ref));
        
        const eventTypes: TeamType[] = ['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles'];

        for (const eventType of eventTypes) {
            const eventTeams = teams
                .filter(t => t.type === eventType)
                .sort((a, b) => (a.lotNumber || 0) - (b.lotNumber || 0));

            if (eventTeams.length < 2) continue; // Skip events with less than 2 teams

            if (tournament.tournamentType === 'knockout') {
                let teamsToPair = [...eventTeams];
                // Handle a single bye for odd-numbered teams
                if (teamsToPair.length % 2 !== 0) {
                    const byeTeam = teamsToPair.pop()!; // Team with highest lot gets bye
                    const byeMatchRef = doc(collection(db, 'matches'));
                    // Create a "bye" match that is already completed
                     batch.set(byeMatchRef, {
                        team1Id: byeTeam.id,
                        team2Id: 'BYE',
                        team1Name: byeTeam.player1Name + (byeTeam.player2Name ? ` & ${byeTeam.player2Name}` : ''),
                        team2Name: 'BYE',
                        team1OrgName: getOrgName(byeTeam.organizationId),
                        team2OrgName: '',
                        eventType: eventType,
                        status: 'COMPLETED',
                        winnerId: byeTeam.id,
                        score: 'BYE',
                        round: 1,
                     });
                }
                // Pair remaining teams
                for (let i = 0; i < teamsToPair.length; i += 2) {
                    const team1 = teamsToPair[i];
                    const team2 = teamsToPair[i+1];
                    const matchRef = doc(collection(db, 'matches'));
                    batch.set(matchRef, {
                        team1Id: team1.id,
                        team2Id: team2.id,
                        team1Name: team1.player1Name + (team1.player2Name ? ` & ${team1.player2Name}` : ''),
                        team2Name: team2.player1Name + (team2.player2Name ? ` & ${team2.player2Name}` : ''),
                        team1OrgName: getOrgName(team1.organizationId),
                        team2OrgName: getOrgName(team2.organizationId),
                        eventType: eventType,
                        status: 'PENDING',
                        round: 1,
                        courtName: '',
                        startTime: Timestamp.now(),
                    });
                }
            } else { // round-robin
                 for (let i = 0; i < eventTeams.length; i++) {
                    for (let j = i + 1; j < eventTeams.length; j++) {
                        const team1 = eventTeams[i];
                        const team2 = eventTeams[j];
                        const matchRef = doc(collection(db, 'matches'));
                        batch.set(matchRef, {
                            team1Id: team1.id,
                            team2Id: team2.id,
                            team1Name: team1.player1Name + (team1.player2Name ? ` & ${team1.player2Name}` : ''),
                            team2Name: team2.player1Name + (team2.player2Name ? ` & ${team2.player2Name}` : ''),
                            team1OrgName: getOrgName(team1.organizationId),
                            team2OrgName: getOrgName(team2.organizationId),
                            eventType: eventType,
                            status: 'PENDING',
                            courtName: '',
                            startTime: Timestamp.now(),
                        });
                    }
                }
            }
        }
        
        // Set tournament status to IN_PROGRESS
        const tourneyRef = doc(db, 'tournaments', tournament.id);
        batch.update(tourneyRef, { status: 'IN_PROGRESS', startedAt: Timestamp.now() });

        await batch.commit();
        toast({ title: 'Pairings Generated!', description: `Matches have been created. Go to the scheduler to assign them.` });
        router.push('/dashboard/scheduler');

    } catch (error) {
        console.error("Error generating schedule:", error);
        toast({ title: 'Error Generating Schedule', description: 'An error occurred while generating pairings.', variant: 'destructive' });
    } finally {
        setIsGenerating(false);
    }
};

  if (isLoading) {
    return (
        <div className="space-y-4 p-8">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <div className="pt-4">
                <Skeleton className="h-96 w-full" />
            </div>
        </div>
    )
  }

  return (
    <div className="space-y-8 p-4 md:p-8">
      <Card>
          <CardHeader>
            <CardTitle>Tournament Administration</CardTitle>
            <CardDescription>
             Configure the tournament. Once settings are finalized, go to the Teams page to register participants and assign lot numbers before generating pairings.
             {isTournamentStarted && <span className="font-bold text-destructive block mt-2">Tournament is active. Settings are locked. Go to the Scheduler to reset if needed.</span>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onTournamentSubmit)} className="space-y-8">
                <fieldset disabled={isTournamentStarted}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Tournament Location</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. City Arena" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                         <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                <FormLabel>Tournament Date</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant={"outline"}
                                        className={cn(
                                            "pl-3 text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                        )}
                                        >
                                        {field.value ? (
                                            format(field.value, "PPP")
                                        ) : (
                                            <span>Pick a date</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        disabled={(date) =>
                                        date < new Date()
                                        }
                                        initialFocus
                                    />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <FormField
                            control={form.control}
                            name="tournamentType"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Tournament Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a tournament format" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    <SelectItem value="round-robin">Round Robin</SelectItem>
                                    <SelectItem value="knockout">Knockout</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="numberOfCourts"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Number of Courts</FormLabel>
                                <FormControl>
                                    <Input type="number" min="1" max="50" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    

                    <div>
                      <FormLabel>Court Names</FormLabel>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        {fields.map((field, index) => (
                            <FormField
                            key={field.id}
                            control={form.control}
                            name={`courtNames.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} placeholder={`Court ${index + 1}`} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </div>
                </fieldset>
                <div className="flex gap-4 flex-wrap items-center border-t pt-6">
                    <Button type="submit" disabled={isTournamentStarted}>
                        <Save className="mr-2 h-4 w-4" />
                        {tournamentDocRef ? 'Update Tournament' : 'Create Tournament'}
                    </Button>
                     <Button type="button" variant="outline" onClick={() => router.push('/dashboard')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Button>
                     <Button type="button" variant="default" onClick={handleGenerateSchedule} disabled={isGenerating || isTournamentStarted || !tournament}>
                        {isGenerating ? <Loader2 className="animate-spin" /> : <Play />}
                        Start Tournament & Generate Pairings
                    </Button>
                </div>
              </form>
            </Form>
          </CardContent>
      </Card>
      

      <AlertDialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <div className="flex items-center gap-2">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                    <AlertDialogTitle>Success!</AlertDialogTitle>
                </div>
                <AlertDialogDescription>
                  Tournament details have been saved successfully.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => setIsSuccessModalOpen(false)}>OK</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
