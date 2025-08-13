
"use client";

import { useState, useEffect, useRef } from 'react';
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
import { Save, ArrowLeft, Trash2, CheckCircle, Calendar as CalendarIcon, MoreHorizontal, UserPlus, Users as TeamsIcon, Building, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, updateDoc, DocumentReference, deleteDoc, query, Timestamp, addDoc, where } from 'firebase/firestore';
import type { Tournament, Team, Organization, Gender } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import Image from 'next/image';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const tournamentFormSchema = z.object({
  location: z.string().min(3, { message: 'Location must be at least 3 characters.' }),
  date: z.date({ required_error: 'A tournament date is required.'}),
  tournamentType: z.enum(['round-robin', 'knockout'], { required_error: 'Tournament type is required.' }),
  numberOfCourts: z.coerce.number().min(1, { message: 'There must be at least 1 court.' }).max(50, { message: "Cannot exceed 50 courts."}),
  courtNames: z.array(z.object({ name: z.string().min(1, {message: 'Court name cannot be empty.'}) })),
});

const organizationFormSchema = z.object({
    name: z.string().min(2, { message: "Organization name must be at least 2 characters." }),
    location: z.string().min(2, { message: "Location is required." }),
});

const teamFormSchema = z.object({
  type: z.enum(['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles']),
  player1Name: z.string().min(2, "Player 1 name is required."),
  player2Name: z.string().optional(),
  genderP1: z.enum(['male', 'female']).optional(),
  genderP2: z.enum(['male', 'female']).optional(),
  organizationId: z.string({ required_error: "Organization is required." }),
  photoUrl: z.string().optional(),
  lotNumber: z.coerce.number().optional(),
}).refine(data => {
    if (data.type === 'mens_doubles' || data.type === 'womens_doubles' || data.type === 'mixed_doubles') {
        return !!data.player2Name && data.player2Name.length >= 2;
    }
    return true;
}, {
    message: "Player 2 name is required for doubles.",
    path: ["player2Name"],
}).refine(data => {
    if (data.type === 'singles' || data.type === 'mixed_doubles') {
        return !!data.genderP1;
    }
    return true;
}, {
    message: "Gender for Player 1 is required.",
    path: ['genderP1']
}).refine(data => {
    if (data.type === 'mixed_doubles') {
        return !!data.genderP2;
    }
    return true;
}, {
    message: "Gender for Player 2 is required for mixed doubles.",
    path: ['genderP2']
});


export default function TournamentSettingsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [tournamentDocRef, setTournamentDocRef] = useState<DocumentReference | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // States for Team/Org Management
  const [teams, setTeams] = useState<Team[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);
  const [orgToEdit, setOrgToEdit] = useState<Organization | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [teamToEdit, setTeamToEdit] = useState<Team | null>(null);
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [isAddOrgOpen, setIsAddOrgOpen] = useState(false);
  const [isEditOrgOpen, setIsEditOrgOpen] = useState(false);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [originalLotNumbers, setOriginalLotNumbers] = useState<Record<string, number | undefined>>({});

  const form = useForm<z.infer<typeof tournamentFormSchema>>({
    resolver: zodResolver(tournamentFormSchema),
    defaultValues: {
      location: '',
      date: new Date(),
      tournamentType: 'round-robin',
      numberOfCourts: 4,
      courtNames: Array.from({ length: 4 }, () => ({ name: '' })),
    },
  });
  
  const orgForm = useForm<z.infer<typeof organizationFormSchema>>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: { name: '', location: '' },
  });

  const teamForm = useForm<z.infer<typeof teamFormSchema>>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: { type: 'singles', player1Name: '', player2Name: '', photoUrl: '' },
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
          setTournamentDocRef(tournamentDoc.ref);
          form.reset({
            ...data,
            date: data.date.toDate(),
          });
        } else {
            setTournamentDocRef(null);
        }
        
        const fetchedTeams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
        setTeams(fetchedTeams);
        const lotNumberMap: Record<string, number | undefined> = {};
        fetchedTeams.forEach(team => {
            lotNumberMap[team.id] = team.lotNumber;
        });
        setOriginalLotNumbers(lotNumberMap);

        setOrganizations(orgsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization)));
        
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to fetch data.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [form, toast]);
  
  // Effects for edit dialogs
  useEffect(() => {
    if (orgToEdit) {
        orgForm.reset(orgToEdit);
        setIsEditOrgOpen(true);
    }
  }, [orgToEdit, orgForm]);

  useEffect(() => {
    if (teamToEdit) {
        teamForm.reset(teamToEdit);
        setPhotoPreview(teamToEdit.photoUrl || null);
        setIsEditTeamOpen(true);
    }
  }, [teamToEdit, teamForm]);
  
  useEffect(() => {
    if (!isAddTeamOpen && !isEditTeamOpen) {
        setPhotoPreview(null);
        teamForm.reset();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
  }, [isAddTeamOpen, isEditTeamOpen, teamForm]);


  const onTournamentSubmit = async (values: z.infer<typeof tournamentFormSchema>) => {
    try {
      const dataToSave = {
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
      }
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to save tournament details.', variant: 'destructive' });
    }
  };
  
  const handleDeleteTournament = async () => {
    if (!tournamentDocRef) return;
    try {
        await deleteDoc(tournamentDocRef);
        toast({ title: 'Success', description: 'Tournament has been deleted.' });
        setTournamentDocRef(null);
        form.reset({
          location: '',
          date: new Date(),
          tournamentType: 'round-robin',
          numberOfCourts: 4,
          courtNames: Array.from({ length: 4 }, (_, i) => ({ name: `Court ${i + 1}` })),
        });
        router.push('/dashboard');
    } catch (error) {
        toast({ title: 'Error', description: 'Failed to delete tournament.', variant: 'destructive' });
    } finally {
        setIsDeleteDialogOpen(false);
    }
  };
  
    const handleAddOrg = async (values: z.infer<typeof organizationFormSchema>) => {
    try {
        const q = query(collection(db, 'organizations'), where('name', '==', values.name));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            toast({ title: 'Error', description: 'An organization with this name already exists.', variant: 'destructive' });
            return;
        }

        const newOrgDoc = await addDoc(collection(db, 'organizations'), values);
        const newOrg: Organization = { id: newOrgDoc.id, ...values };
        setOrganizations([...organizations, newOrg]);
        toast({ title: 'Organization Created', description: `Organization "${newOrg.name}" has been added.` });
        setIsAddOrgOpen(false);
        orgForm.reset();
    } catch(error) {
        toast({ title: 'Error', description: 'Failed to create organization.', variant: 'destructive' });
    }
  };
  
  const handleEditOrg = async (values: z.infer<typeof organizationFormSchema>) => {
    if (!orgToEdit) return;
    try {
        const orgRef = doc(db, 'organizations', orgToEdit.id);
        await updateDoc(orgRef, values);
        setOrganizations(organizations.map(o => o.id === orgToEdit.id ? { ...o, ...values } : o));
        setIsEditOrgOpen(false);
        setOrgToEdit(null);
        setIsSuccessModalOpen(true);
    } catch (error) {
        toast({ title: 'Error', description: 'Failed to update organization.', variant: 'destructive' });
    }
  };

  const handleDeleteOrg = async () => {
    if (!orgToDelete) return;

    const isOrgInUse = teams.some(t => t.organizationId === orgToDelete.id);
    if (isOrgInUse) {
        toast({ title: 'Error', description: 'Cannot delete organization with active teams.', variant: 'destructive' });
        setOrgToDelete(null);
        return;
    }

    try {
        await deleteDoc(doc(db, 'organizations', orgToDelete.id));
        setOrganizations(organizations.filter(o => o.id !== orgToDelete.id));
        toast({ title: 'Success', description: 'Organization has been deleted.' });
    } catch (error) {
        toast({ title: 'Error', description: 'Failed to delete organization.', variant: 'destructive' });
    }
    setOrgToDelete(null);
  }
  
  const handleTeamSubmit = async (values: z.infer<typeof teamFormSchema>, isEditing: boolean) => {
    try {
        const teamData: Partial<Omit<Team, 'id'>> = {
            type: values.type,
            player1Name: values.player1Name,
            organizationId: values.organizationId,
        };

        if (values.lotNumber || values.lotNumber === 0) {
            teamData.lotNumber = values.lotNumber;
        }
        
        if (values.photoUrl) teamData.photoUrl = values.photoUrl;

        if (values.type === 'mens_doubles') {
            teamData.player2Name = values.player2Name;
            teamData.genderP1 = 'male';
            teamData.genderP2 = 'male';
        } else if (values.type === 'womens_doubles') {
            teamData.player2Name = values.player2Name;
            teamData.genderP1 = 'female';
            teamData.genderP2 = 'female';
        } else if (values.type === 'mixed_doubles') {
            teamData.player2Name = values.player2Name;
            teamData.genderP1 = values.genderP1;
            teamData.genderP2 = values.genderP2;
        } else if (values.type === 'singles') {
            teamData.genderP1 = values.genderP1;
        }
        
        if (isEditing) {
            if (!teamToEdit) return;
            const teamRef = doc(db, 'teams', teamToEdit.id);
            await updateDoc(teamRef, teamData as { [x: string]: any });
            setTeams(teams.map(t => t.id === teamToEdit.id ? { ...teamToEdit, ...teamData } as Team : t));
            setIsEditTeamOpen(false);
            setTeamToEdit(null);
            setIsSuccessModalOpen(true);
        } else {
            const dataToSave: any = { ...teamData };
            if (values.lotNumber !== undefined && values.lotNumber !== null && !isNaN(values.lotNumber)) {
                dataToSave.lotNumber = values.lotNumber;
            }
            const newTeamDoc = await addDoc(collection(db, 'teams'), dataToSave);
            const newTeam = { id: newTeamDoc.id, ...dataToSave };
            setTeams([...teams, newTeam as Team]);
            toast({
              title: 'Team Registered',
              description: `Team "${teamData.player1Name}${teamData.player2Name ? ' & ' + teamData.player2Name : ''}" has been registered.`,
            });
            setIsAddTeamOpen(false);
        }
        teamForm.reset({ type: 'singles', player1Name: '', player2Name: '', photoUrl: '', lotNumber: undefined });
        setPhotoPreview(null);
    } catch(error) {
        console.error(error);
        toast({ title: 'Error', description: `Failed to ${isEditing ? 'update' : 'register'} team.`, variant: 'destructive' });
    }
  };


  const handleDeleteTeam = async () => {
    if (!teamToDelete) return;
    try {
        await deleteDoc(doc(db, 'teams', teamToDelete.id));
        setTeams(teams.filter(t => t.id !== teamToDelete.id));
        toast({ title: 'Success', description: 'Team has been deleted.' });
    } catch (error) {
        toast({ title: 'Error', description: 'Failed to delete team.', variant: 'destructive' });
    }
    setTeamToDelete(null);
  };
  
  const getOrgName = (orgId: string) => organizations.find(o => o.id === orgId)?.name || 'N/A';
  
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            setPhotoPreview(dataUrl);
            teamForm.setValue('photoUrl', dataUrl);
        };
        reader.readAsDataURL(file);
    }
  };
  
  const handleInlinePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>, teamId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result as string;
      try {
        const teamRef = doc(db, 'teams', teamId);
        await updateDoc(teamRef, { photoUrl: dataUrl });
        setTeams(prevTeams => prevTeams.map(t => 
            t.id === teamId ? { ...t, photoUrl: dataUrl } : t
        ));
        toast({ title: 'Photo Updated', description: 'The team photo has been changed.' });
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to update photo.', variant: 'destructive' });
      }
    };
    reader.readAsDataURL(file);
  };
  
  const handleLotNumberChange = (teamId: string, value: string) => {
    const newLotNumber = value === '' ? undefined : parseInt(value, 10);
    if (value !== '' && isNaN(newLotNumber)) return; // Prevent non-numeric input

    setTeams(prevTeams => prevTeams.map(t => 
        t.id === teamId ? { ...t, lotNumber: newLotNumber } : t
    ));
  };
  
  const handleLotNumberBlur = async (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const originalLot = originalLotNumbers[teamId];
    const currentLot = team.lotNumber;
    
    // Only update if the value has actually changed
    if (originalLot !== currentLot) {
        try {
            const teamRef = doc(db, 'teams', teamId);
            await updateDoc(teamRef, { lotNumber: currentLot === undefined ? null : currentLot });
            
            // Update the original value in state to prevent re-triggers
            setOriginalLotNumbers(prev => ({ ...prev, [teamId]: currentLot }));
            
            const teamName = team.player2Name ? `${team.player1Name} & ${team.player2Name}` : team.player1Name;
            const orgName = getOrgName(team.organizationId);

            toast({
                title: 'Lot Number Updated',
                description: `Lot for ${teamName} (${orgName}) saved.`
            });
        } catch (error) {
            toast({
                title: 'Error Saving Lot Number',
                variant: 'destructive'
            });
            // Revert the change in UI on failure
            setTeams(prevTeams => prevTeams.map(t => 
                t.id === teamId ? { ...t, lotNumber: originalLot } : t
            ));
        }
    }
  };


  const TeamFormContent = ({ isEditing }: { isEditing: boolean }) => {
    const teamType = teamForm.watch('type');
    return (
    <Form {...teamForm}>
        <form onSubmit={teamForm.handleSubmit((values) => handleTeamSubmit(values, isEditing))} className="space-y-4">
        <FormField control={teamForm.control} name="type" render={({ field }) => (
            <FormItem>
                <FormLabel>Event Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select an event type" /></SelectTrigger></FormControl>
                    <SelectContent>
                        <SelectItem value="singles">Singles</SelectItem>
                        <SelectItem value="mens_doubles">Men's Doubles</SelectItem>
                        <SelectItem value="womens_doubles">Women's Doubles</SelectItem>
                        <SelectItem value="mixed_doubles">Mixed Doubles</SelectItem>
                    </SelectContent>
                </Select><FormMessage />
            </FormItem>
        )} />
        <FormField control={teamForm.control} name="player1Name" render={({ field }) => (
            <FormItem>
                <FormLabel>Player 1 Name</FormLabel>
                <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                <FormMessage />
            </FormItem>
        )} />
        {(teamType === 'singles' || teamType === 'mixed_doubles') && (
            <FormField control={teamForm.control} name="genderP1" render={({ field }) => (
                <FormItem>
                <FormLabel>Player 1 Gender</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                    <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                </Select><FormMessage />
            </FormItem>
            )} />
        )}
        {(teamType === 'mens_doubles' || teamType === 'womens_doubles' || teamType === 'mixed_doubles') && (
            <FormField control={teamForm.control} name="player2Name" render={({ field }) => (
                <FormItem>
                    <FormLabel>Player 2 Name</FormLabel>
                    <FormControl><Input placeholder="Partner's Name" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
        )}
         {teamType === 'mixed_doubles' && (
            <FormField control={teamForm.control} name="genderP2" render={({ field }) => (
                <FormItem>
                <FormLabel>Player 2 Gender</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                    <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                </Select><FormMessage />
            </FormItem>
            )} />
        )}
        
        <FormField control={teamForm.control} name="organizationId" render={({ field }) => (
            <FormItem>
                <FormLabel>Organization</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select an organization" /></SelectTrigger></FormControl>
                    <SelectContent>
                        {organizations.map(org => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}
                    </SelectContent>
                </Select><FormMessage />
            </FormItem>
        )} />
        
        <FormField control={teamForm.control} name="lotNumber" render={({ field }) => (
            <FormItem>
                <FormLabel>Lot Number</FormLabel>
                <FormControl><Input type="number" placeholder="e.g. 1" {...field} onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} /></FormControl>
                <FormMessage />
            </FormItem>
        )} />

        <FormItem>
          <FormLabel>Team Photo</FormLabel>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 bg-muted rounded-md flex items-center justify-center overflow-hidden">
                <Image 
                    data-ai-hint="badminton duo" 
                    src={photoPreview || "https://placehold.co/80x80.png"} 
                    width={80} height={80} 
                    alt="Team photo" 
                    className="object-cover h-full w-full"
                />
            </div>
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              Upload
            </Button>
            <Input type="file" ref={fileInputRef} onChange={handlePhotoChange} className="hidden" accept="image/png, image/jpeg, image/gif" />
          </div>
          <FormMessage />
        </FormItem>
        <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
            <Button type="submit">{isEditing ? 'Save Changes' : 'Register Team'}</Button>
        </DialogFooter>
        </form>
    </Form>
  )
  }

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
              Configure the settings for the upcoming tournament.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onTournamentSubmit)} className="space-y-8">
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

                <div className="flex gap-4 flex-wrap">
                    <Button type="submit">
                        <Save className="mr-2 h-4 w-4" />
                        {tournamentDocRef ? 'Update Tournament' : 'Create Tournament'}
                    </Button>
                     <Button type="button" variant="outline" onClick={() => router.push('/dashboard')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Button>
                    {tournamentDocRef && (
                      <AlertDialog>
                          <AlertDialogTrigger asChild>
                               <Button type="button" variant="destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Tournament
                                </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the tournament and all associated teams, organizations, and matches.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteTournament} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                    )}
                </div>
              </form>
            </Form>
          </CardContent>
      </Card>
      
      <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>Register and manage badminton teams.</CardDescription>
            </div>
            <Dialog open={isAddTeamOpen} onOpenChange={setIsAddTeamOpen}>
              <DialogTrigger asChild>
                <Button>
                  <TeamsIcon className="mr-2 h-4 w-4" />
                  Register Team
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Register New Team</DialogTitle>
                  <DialogDescription>Enter the details for the new team.</DialogDescription>
                </DialogHeader>
                <TeamFormContent isEditing={false} />
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot #</TableHead>
                  <TableHead>Photo</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Players</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-20"
                        value={t.lotNumber ?? ''}
                        onChange={(e) => handleLotNumberChange(t.id, e.target.value)}
                        onBlur={() => handleLotNumberBlur(t.id)}
                        placeholder="N/A"
                      />
                    </TableCell>
                    <TableCell>
                        <div className="relative group cursor-pointer" onClick={() => inlineFileInputRefs.current[t.id]?.click()}>
                           <Image 
                             data-ai-hint="badminton players"
                             src={t.photoUrl || 'https://placehold.co/80x80.png'} 
                             alt="Team photo" 
                             width={80} 
                             height={80} 
                             className="rounded-md object-cover group-hover:opacity-50 transition-opacity"
                           />
                           <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                                <Edit className="h-6 w-6 text-white" />
                           </div>
                           <Input
                                type="file"
                                className="hidden"
                                ref={el => (inlineFileInputRefs.current[t.id] = el)}
                                onChange={(e) => handleInlinePhotoChange(e, t.id)}
                                accept="image/png, image/jpeg, image/gif"
                            />
                        </div>
                    </TableCell>
                    <TableCell className="font-medium capitalize">{t.type.replace('_', ' ')}</TableCell>
                    <TableCell>{t.player1Name}{t.player2Name ? ` & ${t.player2Name}`: ''}</TableCell>
                    <TableCell>{getOrgName(t.organizationId)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setTeamToEdit(t)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setTeamToDelete(t)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Organization Management</CardTitle>
              <CardDescription>Create and manage organizations.</CardDescription>
            </div>
            <Dialog open={isAddOrgOpen} onOpenChange={setIsAddOrgOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Building className="mr-2 h-4 w-4" />
                  Create Organization
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Organization</DialogTitle>
                </DialogHeader>
                <Form {...orgForm}>
                  <form onSubmit={orgForm.handleSubmit(handleAddOrg)} className="space-y-4">
                    <FormField control={orgForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization Name</FormLabel>
                        <FormControl><Input placeholder="e.g. Premier Badminton Club" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={orgForm.control} name="location" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl><Input placeholder="e.g. New York, USA" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                      <Button type="submit">Create Organization</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>{org.location}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setOrgToEdit(org)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setOrgToDelete(org)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

     <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the tournament and all associated teams, organizations, and matches.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteTournament} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
      
        {/* Edit Organization Dialog */}
      <Dialog open={isEditOrgOpen} onOpenChange={setIsEditOrgOpen}>
          <DialogContent>
          <DialogHeader>
              <DialogTitle>Edit Organization: {orgToEdit?.name}</DialogTitle>
          </DialogHeader>
          <Form {...orgForm}>
              <form onSubmit={orgForm.handleSubmit(handleEditOrg)} className="space-y-4">
              <FormField control={orgForm.control} name="name" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl><Input placeholder="e.g. Premier Badminton Club" {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
              )} />
              <FormField control={orgForm.control} name="location" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl><Input placeholder="e.g. New York, USA" {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
              )} />
              <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setIsEditOrgOpen(false)}>Cancel</Button>
                  <Button type="submit">Save Changes</Button>
              </DialogFooter>
              </form>
          </Form>
          </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={isEditTeamOpen} onOpenChange={setIsEditTeamOpen}>
          <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
              <DialogTitle>Edit Team</DialogTitle>
              <DialogDescription>Update the team details.</DialogDescription>
          </DialogHeader>
          <TeamFormContent isEditing={true} />
          </DialogContent>
      </Dialog>
      
        {/* Delete Org Alert */}
      <AlertDialog open={!!orgToDelete} onOpenChange={(open) => !open && setOrgToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the organization <span className="font-semibold">{orgToDelete?.name}</span>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteOrg} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Organization
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Team Alert */}
      <AlertDialog open={!!teamToDelete} onOpenChange={(open) => !open && setTeamToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the team: <span className="font-semibold">{teamToDelete?.player1Name}{teamToDelete?.player2Name ? ` & ${teamToDelete.player2Name}` : ''}</span>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteTeam} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Team
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div>
  );
}

    