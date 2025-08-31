
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
import { Save, ArrowLeft, CheckCircle, Calendar as CalendarIcon, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, updateDoc, DocumentReference, query, Timestamp, writeBatch, onSnapshot } from 'firebase/firestore';
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
} from "@/components/ui/alert-dialog";
import { scheduleMatches } from '@/ai/flows/schedule-matches-flow';


const tournamentFormSchema = z.object({
  name: z.string().min(3, { message: 'Tournament name must be at least 3 characters.' }),
  hostName: z.string().min(3, { message: 'Host name must be at least 3 characters.' }),
  location: z.string().min(3, { message: 'Location must be at least 3 characters.' }),
  date: z.date({ required_error: 'A tournament date is required.'}),
  tournamentType: z.enum(['round-robin', 'knockout'], { required_error: 'Tournament type is required.' }),
  numberOfCourts: z.coerce.number().min(1, { message: 'There must be at least 1 court.' }).max(50, { message: "Cannot exceed 50 courts."}),
  courtNames: z.array(z.object({ name: z.string().min(1, {message: 'Court name cannot be empty.'}) })),
  restTime: z.coerce.number().min(0, { message: 'Rest time cannot be negative.'}).optional(),
});


export default function TournamentSettingsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [tournamentDocRef, setTournamentDocRef] = useState<DocumentReference | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const form = useForm<z.infer<typeof tournamentFormSchema>>({
    resolver: zodResolver(tournamentFormSchema),
    defaultValues: {
      name: '',
      hostName: '',
      location: '',
      date: new Date(),
      tournamentType: 'knockout',
      numberOfCourts: 4,
      courtNames: Array.from({ length: 4 }, (_, i) => ({ name: `Court ${i+1}` })),
      restTime: 10,
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
    setIsLoading(true);

    const tourneyUnsub = onSnapshot(collection(db, 'tournaments'), (snapshot) => {
        if (!snapshot.empty) {
          const tournamentDoc = snapshot.docs[0];
          const data = tournamentDoc.data() as Omit<Tournament, 'id'|'date'|'startedAt'> & { date: Timestamp, startedAt?: Timestamp };
          const tournamentData = { 
              id: tournamentDoc.id, 
              ...data, 
              date: data.date.toDate(),
              startedAt: data.startedAt?.toDate(),
          };
          setTournament(tournamentData as any)
          setTournamentDocRef(tournamentDoc.ref);
          form.reset({ 
            ...data, 
            date: data.date.toDate(), 
            restTime: data.restTime ?? 10,
          });
        } else {
            setTournamentDocRef(null);
            setTournament(null);
        }
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching tournament:", error);
        toast({ title: 'Error', description: 'Failed to fetch tournament data.', variant: 'destructive' });
        setIsLoading(false);
    });
    
    const teamsUnsub = onSnapshot(collection(db, 'teams'), (snapshot) => {
        setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
    });
    
    const orgsUnsub = onSnapshot(collection(db, 'organizations'), (snapshot) => {
        setOrganizations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization)));
    });

    return () => {
        tourneyUnsub();
        teamsUnsub();
        orgsUnsub();
    }
  }, [form, toast]);


  const onTournamentSubmit = async (values: z.infer<typeof tournamentFormSchema>) => {
    setIsSaving(true);
    try {
      const dataToSave = {
        ...values,
        date: Timestamp.fromDate(values.date),
      };

      if (tournamentDocRef) {
        await updateDoc(tournamentDocRef, dataToSave as { [x: string]: any });
      } else {
        const newDocRef = doc(collection(db, 'tournaments'));
        await setDoc(newDocRef, { ...dataToSave, status: 'PENDING' });
      }
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to save tournament details.', variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  };
  
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
        
        const teamsCountPerEvent = Object.values(
            teams.reduce((acc, team) => {
                acc[team.type] = (acc[team.type] || { eventType: team.type, count: 0 });
                acc[team.type].count++;
                return acc;
            }, {} as Record<string, { eventType: string; count: number }>)
        );
        
        const plainTournament = {
            ...tournament,
            date: tournament.date.toISOString(),
            startedAt: tournament.startedAt instanceof Timestamp ? tournament.startedAt.toDate().toISOString() : (tournament.startedAt as Date)?.toISOString(),
        }

        const scheduleInput = {
            teams,
            tournament: plainTournament as any,
            teamsCountPerEvent,
            organizations,
        };

        const generatedMatches = await scheduleMatches(scheduleInput);
        
        generatedMatches.forEach(match => {
            const matchRef = doc(collection(db, 'matches'));
            batch.set(matchRef, { ...match, courtName: '', startTime: Timestamp.now() });
        });
        
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
                         <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tournament Name</FormLabel>
                                <FormControl><Input placeholder="e.g. Annual Badminton Championship" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                         )} />
                         <FormField control={form.control} name="hostName" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Host Name</FormLabel>
                                <FormControl><Input placeholder="e.g. Premier Badminton Club" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                         )} />
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
                                        initialFocus
                                    />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-8">
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
                        <FormField
                            control={form.control}
                            name="restTime"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Rest Time (minutes)</FormLabel>
                                <FormControl>
                                    <Input type="number" min="0" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    
                    <div className="pt-8">
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
                    <Button type="submit" disabled={isTournamentStarted || isSaving}>
                        {isSaving ? <div className="animate-spin h-5 w-5 border-2 border-background border-t-transparent rounded-full" /> : <Save className="mr-2 h-4 w-4" />}
                        {tournamentDocRef ? 'Update Tournament' : 'Create Tournament'}
                    </Button>
                     <Button type="button" variant="outline" onClick={() => router.push('/dashboard')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Button>
                     <Button type="button" variant="default" onClick={handleGenerateSchedule} disabled={isGenerating || isTournamentStarted || !tournament}>
                        {isGenerating ? <div className="animate-spin h-5 w-5 border-2 border-background border-t-transparent rounded-full" /> : <Play />}
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
