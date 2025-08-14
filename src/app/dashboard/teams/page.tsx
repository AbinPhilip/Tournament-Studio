
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MoreHorizontal, Trash2, Edit, CheckCircle, TeamsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, query } from 'firebase/firestore';
import type { Team, Organization } from '@/types';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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


export default function TeamsPage() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [teamToEdit, setTeamToEdit] = useState<Team | null>(null);
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [originalLotNumbers, setOriginalLotNumbers] = useState<Record<string, number | undefined>>({});
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const teamForm = useForm<z.infer<typeof teamFormSchema>>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: { type: 'singles', player1Name: '', player2Name: '', photoUrl: '' },
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsSnap, orgsSnap] = await Promise.all([
          getDocs(collection(db, 'teams')),
          getDocs(collection(db, 'organizations')),
        ]);
        
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
      }
    };
    fetchData();
  }, [toast]);
  
  // Effects for edit dialogs
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
  
  const handleTeamSubmit = async (values: z.infer<typeof teamFormSchema>, isEditing: boolean) => {
    try {
        const teamData: Partial<Omit<Team, 'id'>> = {
            type: values.type,
            player1Name: values.player1Name,
            organizationId: values.organizationId,
        };
        
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
        
        const dataToSave: any = { ...teamData };
        if (values.lotNumber !== undefined && values.lotNumber !== null && !isNaN(values.lotNumber)) {
            dataToSave.lotNumber = values.lotNumber;
        }

        if (isEditing) {
            if (!teamToEdit) return;
            const teamRef = doc(db, 'teams', teamToEdit.id);
            await updateDoc(teamRef, dataToSave as { [x: string]: any });
            setTeams(teams.map(t => t.id === teamToEdit.id ? { ...teamToEdit, ...dataToSave } as Team : t));
            setIsEditTeamOpen(false);
            setTeamToEdit(null);
            setIsSuccessModalOpen(true);
        } else {
            const newTeamDoc = await addDoc(collection(db, 'teams'), dataToSave);
            const newTeam = { id: newTeamDoc.id, ...dataToSave };
            setTeams([...teams, newTeam as Team]);
            toast({
              title: 'Team Registered',
              description: `Team "${dataToSave.player1Name}${dataToSave.player2Name ? ' & ' + dataToSave.player2Name : ''}" has been registered.`,
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
    
    if (originalLot !== currentLot) {
        try {
            const teamRef = doc(db, 'teams', teamId);
            await updateDoc(teamRef, { lotNumber: currentLot === undefined ? null : currentLot });
            
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
            <Input type="file" ref={fileInputRef} onChange={handlePhotoChange} className="hidden" accept="image/*" capture="environment" />
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

  return (
    <div className="space-y-8 p-4 md:p-8">
      <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>
                Register and manage badminton teams.
              </CardDescription>
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
                        <div className={cn("relative group cursor-pointer")} onClick={() => inlineFileInputRefs.current[t.id]?.click()}>
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
                                accept="image/*"
                                capture="environment"
                            />
                        </div>
                    </TableCell>
                    <TableCell className="font-medium capitalize">{t.type.replace(/_/g, ' ')}</TableCell>
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
        
      <AlertDialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <div className="flex items-center gap-2">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                    <AlertDialogTitle>Success!</AlertDialogTitle>
                </div>
                <AlertDialogDescription>
                  Team details have been saved successfully.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => setIsSuccessModalOpen(false)}>OK</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
