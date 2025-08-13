
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Save, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import type { Tournament } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';

const tournamentFormSchema = z.object({
  location: z.string().min(3, { message: 'Location must be at least 3 characters.' }),
  date: z.date({ required_error: 'A date is required.' }),
  numberOfCourts: z.coerce.number().min(1, { message: 'There must be at least 1 court.' }).max(50, { message: "Cannot exceed 50 courts."}),
  courtNames: z.array(z.object({ name: z.string().min(1, {message: 'Court name cannot be empty.'}) })),
});

export default function TournamentAdminPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<z.infer<typeof tournamentFormSchema>>({
    resolver: zodResolver(tournamentFormSchema),
    defaultValues: {
      location: '',
      date: new Date(),
      numberOfCourts: 4,
      courtNames: Array.from({ length: 4 }, () => ({ name: '' })),
    },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "courtNames",
  });

  const numberOfCourts = form.watch('numberOfCourts');

  useEffect(() => {
    const numCourts = isNaN(numberOfCourts) || numberOfCourts < 1 ? 1 : numberOfCourts > 50 ? 50 : numberOfCourts;
    const currentCourtNames = form.getValues('courtNames').map(f => f.name);
    const newCourtNames = Array.from({ length: numCourts }, (_, i) => ({
      name: currentCourtNames[i] || `Court ${i + 1}`,
    }));
    replace(newCourtNames);
  }, [numberOfCourts, replace, form]);

  useEffect(() => {
    const fetchTournamentData = async () => {
      setIsLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'tournaments'));
        if (!querySnapshot.empty) {
          const tournamentDoc = querySnapshot.docs[0];
          const data = tournamentDoc.data() as Tournament;
          setTournamentId(tournamentDoc.id);
          form.reset({
            ...data,
            date: data.date.toDate(),
          });
        }
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to fetch tournament data.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchTournamentData();
  }, [form, toast]);

  const onSubmit = async (values: z.infer<typeof tournamentFormSchema>) => {
    try {
      const dataToSave = {
        ...values,
        date: Timestamp.fromDate(values.date),
      };

      if (tournamentId) {
        await updateDoc(doc(db, 'tournaments', tournamentId), dataToSave);
      } else {
        const newDocRef = doc(collection(db, 'tournaments'));
        await setDoc(newDocRef, dataToSave);
        setTournamentId(newDocRef.id);
      }
      toast({ title: 'Success', description: 'Tournament details have been saved.' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to save tournament details.', variant: 'destructive' });
    }
  };
  
  if (isLoading) {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-8 pt-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-10 w-32" />
            </CardContent>
        </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tournament Administration</CardTitle>
        <CardDescription>
          Configure the settings for the upcoming tournament.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                            variant="outline"
                            className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                            )}
                            >
                            {field.value ? (
                                format(field.value, 'PPP')
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
                            disabled={(date) => date < new Date() || date < new Date('1900-01-01')}
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            
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

            <div className="flex gap-4">
                <Button type="submit">
                    <Save className="mr-2 h-4 w-4" />
                    Save Tournament Settings
                </Button>
                 <Button type="button" variant="outline" onClick={() => router.push('/dashboard')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
    