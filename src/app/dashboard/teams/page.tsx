
"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { MoreHorizontal, Trash2, Edit, CheckCircle, Users, ArrowUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, updateDoc, addDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import type { Team, Organization, TeamType } from '@/types';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EventBadge } from '@/components/ui/event-badge';
import { LoadingShuttlecock } from '@/components/ui/loading-shuttlecock';


const teamFormSchema = z.object({
  type: z.enum(['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles']),
  player1Name: z.string().min(2, "Player 1 name is required."),
  player2Name: z.string().optional(),
  genderP1: z.enum(['male', 'female']).optional(),
  genderP2: z.enum(['male', 'female']).optional(),
  organizationId: z.string({ required_error: "Organization is required." }),
  lotNumber: z.coerce.number().int().positive({ message: "Lot number must be a positive number." }).optional(),
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


const TeamForm = ({
    form,
    onSubmit,
    isSubmitting,
    organizations,
    playersByOrg,
}: {
    form: any;
    onSubmit: (values: z.infer<typeof teamFormSchema>) => void;
    isSubmitting: boolean;
    organizations: Organization[];
    playersByOrg: Record<string, string[]>;
}) => {
    const teamType = form.watch('type');
    const orgId = form.watch('organizationId');
    const availablePlayers = playersByOrg[orgId] || [];

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="organizationId" render={({ field }) => (
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
                <FormField control={form.control} name="type" render={({ field }) => (
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

                <datalist id="player-list">
                    {availablePlayers.map(p => <option key={p} value={p} />)}
                </datalist>

                <FormField control={form.control} name="player1Name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Player 1 Name</FormLabel>
                        <FormControl><Input placeholder="John Doe" {...field} list="player-list" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                {(teamType === 'singles' || teamType === 'mixed_doubles') && (
                    <FormField control={form.control} name="genderP1" render={({ field }) => (
                        <FormItem><FormLabel>Player 1 Gender</FormLabel>
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
                    <FormField control={form.control} name="player2Name" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Player 2 Name</FormLabel>
                            <FormControl><Input placeholder="Partner's Name" {...field} list="player-list"/></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                )}
                {teamType === 'mixed_doubles' && (
                    <FormField control={form.control} name="genderP2" render={({ field }) => (
                        <FormItem><FormLabel>Player 2 Gender</FormLabel>
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

                <FormField control={form.control} name="lotNumber" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Lot Number</FormLabel>
                        <FormControl><Input type="number" placeholder="e.g. 1" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <div className="animate-spin h-5 w-5 border-2 border-background border-t-transparent rounded-full" />}
                        {form.formState.isDirty ? 'Save Changes' : 'Register Team'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    )
}


export default function TeamsPage() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [teamToEdit, setTeamToEdit] = useState<Team | null>(null);
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Team | 'organizationName'; direction: 'ascending' | 'descending' } | null>(null);
  const [eventFilter, setEventFilter] = useState<TeamType | 'all'>('all');

  const teamForm = useForm<z.infer<typeof teamFormSchema>>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: { type: 'singles', player1Name: '', player2Name: '', lotNumber: undefined },
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [teamsSnap, orgsSnap] = await Promise.all([
        getDocs(collection(db, 'teams')),
        getDocs(collection(db, 'organizations')),
      ]);
      
      const fetchedTeams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(fetchedTeams);

      const fetchedOrgs = orgsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));
      setOrganizations(fetchedOrgs);
      
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch data.', variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleOpenEditDialog = useCallback((team: Team) => {
    setTeamToEdit(team);
    teamForm.reset(team);
    setIsEditTeamOpen(true);
  }, [teamForm]);
  
  const resetFormAndClose = useCallback(() => {
    teamForm.reset({ type: 'singles', player1Name: '', player2Name: '', lotNumber: undefined });
    setIsAddTeamOpen(false);
    setIsEditTeamOpen(false);
  }, [teamForm]);

  const handleTeamSubmit = async (values: z.infer<typeof teamFormSchema>) => {
    setIsSubmitting(true);
    try {
        const { player1Name, player2Name, organizationId, type, lotNumber } = values;

        const teamsRef = collection(db, 'teams');
        const qPlayers = query(teamsRef, 
            where('organizationId', '==', organizationId),
            where('type', '==', type),
            where('player1Name', '==', player1Name),
            where('player2Name', '==', (player2Name || '')) 
        );
        
        const playerSnapshot = await getDocs(qPlayers);
        if (!playerSnapshot.empty && (!teamToEdit || playerSnapshot.docs[0].id !== teamToEdit.id)) {
            toast({ title: 'Duplicate Team', description: 'A team with these players from this organization in this event already exists.', variant: 'destructive' });
            setIsSubmitting(false);
            return;
        }

        if (lotNumber) {
            const qLot = query(teamsRef, where('type', '==', type), where('lotNumber', '==', lotNumber));
            const lotSnapshot = await getDocs(qLot);
            if (!lotSnapshot.empty && (!teamToEdit || lotSnapshot.docs[0].id !== teamToEdit.id)) {
                const existingTeam = lotSnapshot.docs[0].data() as Team;
                toast({ title: 'Duplicate Lot Number', description: `Lot number ${lotNumber} is already taken by "${existingTeam.player1Name}" in the ${type} event.`, variant: 'destructive' });
                setIsSubmitting(false);
                return;
            }
        }
        
        let teamData: Omit<Team, 'id'> = {
            ...values,
            player2Name: values.player2Name || '',
        };

        if (values.type === 'mens_doubles') { teamData.genderP1 = 'male'; teamData.genderP2 = 'male'; }
        else if (values.type === 'womens_doubles') { teamData.genderP1 = 'female'; teamData.genderP2 = 'female'; }
        else if (values.type === 'singles') { teamData.player2Name = ''; teamData.genderP2 = undefined; }
        
        const dataToSave = { ...teamData, lotNumber: teamData.lotNumber ?? null };

        if (teamToEdit) {
            const teamRef = doc(db, 'teams', teamToEdit.id);
            await updateDoc(teamRef, dataToSave);
            setTeamToEdit(null);
            setIsSuccessModalOpen(true);
        } else {
            await addDoc(collection(db, 'teams'), dataToSave);
            toast({
              title: 'Team Registered',
              description: `Team "${dataToSave.player1Name}${dataToSave.player2Name ? ' & ' + dataToSave.player2Name : ''}" has been registered.`,
            });
        }
        fetchData(); 
        resetFormAndClose();
    } catch(error) {
        console.error(error);
        toast({ title: 'Error', description: `Failed to ${teamToEdit ? 'update' : 'register'} team.`, variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };


  const handleDeleteTeam = async () => {
    if (!teamToDelete) return;
    try {
        await deleteDoc(doc(db, 'teams', teamToDelete.id));
        setTeams(prev => prev.filter(t => t.id !== teamToDelete.id));
        toast({ title: 'Success', description: 'Team has been deleted.' });
    } catch (error) {
        toast({ title: 'Error', description: 'Failed to delete team.', variant: 'destructive' });
    }
    setTeamToDelete(null);
  };
  
  const orgNameMap = useMemo(() => {
      return new Map(organizations.map(org => [org.id, org.name]));
  }, [organizations]);

  const getOrgName = useCallback((orgId: string) => orgNameMap.get(orgId) || '', [orgNameMap]);
  
   const handleLotNumberChange = async (teamId: string, newLotNumberStr: string) => {
    const newLotNumber = newLotNumberStr === '' ? undefined : parseInt(newLotNumberStr, 10);

    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    if (newLotNumber && teams.some(t => t.id !== teamId && t.type === team.type && t.lotNumber === newLotNumber)) {
        toast({
            title: 'Duplicate Lot Number',
            description: `Lot number ${newLotNumber} is already used in this event.`,
            variant: 'destructive',
        });
        return;
    }

    try {
        await updateDoc(doc(db, 'teams', teamId), { lotNumber: newLotNumber ?? null });
        setTeams(prevTeams => prevTeams.map(t => t.id === teamId ? { ...t, lotNumber: newLotNumber } : t));
        toast({
            title: 'Lot Number Updated',
            description: `Lot number for ${team.player1Name}${team.player2Name ? ` & ${team.player2Name}` : ''} has been updated.`,
        });
    } catch (error) {
        toast({ title: 'Error Saving Lot Number', variant: 'destructive' });
    }
  };

  const playersByOrg = useMemo(() => {
     const playersMap: Record<string, Set<string>> = {};
     teams.forEach(team => {
          if (!playersMap[team.organizationId]) {
              playersMap[team.organizationId] = new Set();
          }
          playersMap[team.organizationId].add(team.player1Name);
          if (team.player2Name) {
              playersMap[team.organizationId].add(team.player2Name);
          }
      });
      
      const finalPlayersByOrg: Record<string, string[]> = {};
      for(const orgId in playersMap) {
          finalPlayersByOrg[orgId] = Array.from(playersMap[orgId]).sort();
      }
      return finalPlayersByOrg;
  }, [teams]);

  const sortedTeams = useMemo(() => {
    let sortableTeams = [...teams];
    if (sortConfig !== null) {
      sortableTeams.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'organizationName') {
            aValue = getOrgName(a.organizationId);
            bValue = getOrgName(b.organizationId);
        } else {
            aValue = a[sortConfig.key as keyof Team] ?? '';
            bValue = b[sortConfig.key as keyof Team] ?? '';
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
             if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
             if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
             return 0;
        }

        if (String(aValue).toLocaleLowerCase() < String(bValue).toLocaleLowerCase()) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (String(aValue).toLocaleLowerCase() > String(bValue).toLocaleLowerCase()) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableTeams;
  }, [teams, sortConfig, getOrgName]);
  
  const filteredAndSortedTeams = useMemo(() => {
    if (eventFilter === 'all') {
      return sortedTeams;
    }
    return sortedTeams.filter(team => team.type === eventFilter);
  }, [sortedTeams, eventFilter]);


  const requestSort = (key: keyof Team | 'organizationName') => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const SortableHeader = ({ sortKey, children }: { sortKey: keyof Team | 'organizationName', children: React.ReactNode }) => (
    <Button variant="ghost" onClick={() => requestSort(sortKey)}>
        {children}
        <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
  
  const eventTypes: TeamType[] = ['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles'];


  return (
    <div className="space-y-8 p-4 md:p-8">
      <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>Register and manage teams. Assign lot numbers before starting the tournament.</CardDescription>
            </div>
             <div className="flex flex-col-reverse sm:flex-row gap-2 items-center">
                 <Select value={eventFilter} onValueChange={(value) => setEventFilter(value as TeamType | 'all')}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Filter by event" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Events</SelectItem>
                        {eventTypes.map(event => (
                            <SelectItem key={event} value={event} className="capitalize">{event.replace(/_/g, ' ')}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Dialog open={isAddTeamOpen} onOpenChange={setIsAddTeamOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => teamForm.reset()} className="w-full sm:w-auto"><Users className="mr-2 h-4 w-4" />Register Team</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Register New Team</DialogTitle>
                    </DialogHeader>
                    <TeamForm
                        form={teamForm}
                        onSubmit={handleTeamSubmit}
                        isSubmitting={isSubmitting}
                        organizations={organizations}
                        playersByOrg={playersByOrg}
                    />
                  </DialogContent>
                </Dialog>
            </div>
          </CardHeader>
          <CardContent>
             {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <LoadingShuttlecock />
                </div>
             ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><SortableHeader sortKey="lotNumber">Lot #</SortableHeader></TableHead>
                      <TableHead><SortableHeader sortKey="type">Event</SortableHeader></TableHead>
                      <TableHead>Players</TableHead>
                      <TableHead><SortableHeader sortKey="organizationName">Organization</SortableHeader></TableHead>
                      <TableHead><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedTeams.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Input type="number" className="w-20" defaultValue={t.lotNumber ?? ''}
                            onBlur={(e) => handleLotNumberChange(t.id, e.target.value)} placeholder=""
                          />
                        </TableCell>
                        <TableCell><EventBadge eventType={t.type} /></TableCell>
                        <TableCell>{t.player1Name}{t.player2Name ? ` & ${t.player2Name}`: ''}</TableCell>
                        <TableCell>{getOrgName(t.organizationId)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => handleOpenEditDialog(t)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setTeamToDelete(t)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             )}
          </CardContent>
        </Card>
        
      <AlertDialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <div className="flex items-center gap-2">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                    <AlertDialogTitle>Success!</AlertDialogTitle>
                </div>
                <AlertDialogDescription>Team details have been saved successfully.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => setIsSuccessModalOpen(false)}>OK</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isEditTeamOpen} onOpenChange={(isOpen) => {
          if (!isOpen) resetFormAndClose();
          setIsEditTeamOpen(isOpen);
      }}>
          <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Team</DialogTitle></DialogHeader>
           <TeamForm
                form={teamForm}
                onSubmit={handleTeamSubmit}
                isSubmitting={isSubmitting}
                organizations={organizations}
                playersByOrg={playersByOrg}
            />
          </DialogContent>
      </Dialog>
      
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
                <AlertDialogAction onClick={handleDeleteTeam} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Team</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
