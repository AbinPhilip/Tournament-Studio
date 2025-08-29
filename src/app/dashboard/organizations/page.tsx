
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MoreHorizontal, Trash2, Building, Edit, CheckCircle, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, doc, query, where, getDocs, updateDoc, onSnapshot } from 'firebase/firestore';
import type { Organization, Team } from '@/types';


const organizationFormSchema = z.object({
    name: z.string().min(2, { message: "Organization name must be at least 2 characters." }),
    location: z.string().min(2, { message: "Location is required." }),
});

export default function OrganizationPage() {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);
  const [orgToEdit, setOrgToEdit] = useState<Organization | null>(null);
  const [isAddOrgOpen, setIsAddOrgOpen] = useState(false);
  const [isEditOrgOpen, setIsEditOrgOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const orgForm = useForm<z.infer<typeof organizationFormSchema>>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: { name: '', location: '' },
  });

  useEffect(() => {
    setIsLoading(true);
    const orgsUnsubscribe = onSnapshot(collection(db, 'organizations'), (snapshot) => {
        setOrganizations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization)));
        setIsLoading(false);
    }, (error) => {
        console.error("Failed to fetch organizations: ", error);
        toast({ title: 'Error', description: 'Failed to load organization data.', variant: 'destructive' });
        setIsLoading(false);
    });

    const teamsUnsubscribe = onSnapshot(collection(db, 'teams'), (snapshot) => {
        setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
    });

    return () => {
        orgsUnsubscribe();
        teamsUnsubscribe();
    };
  }, [toast]);
  
  const handleOpenEditDialog = useCallback((org: Organization) => {
    setOrgToEdit(org);
    orgForm.reset(org);
    setIsEditOrgOpen(true);
  }, [orgForm]);

  const handleAddOrg = async (values: z.infer<typeof organizationFormSchema>) => {
    setIsSubmitting(true);
    if (organizations.some(org => org.name.toLowerCase() === values.name.toLowerCase())) {
        toast({ title: 'Error', description: 'An organization with this name already exists.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
    }
    
    try {
        await addDoc(collection(db, 'organizations'), values);
        toast({ title: 'Organization Created', description: `Organization "${values.name}" has been added.` });
        setIsAddOrgOpen(false);
        orgForm.reset({ name: '', location: '' });
    } catch(error) {
        console.error("Error adding organization: ", error);
        toast({ title: 'Error', description: 'Failed to create organization.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleEditOrg = async (values: z.infer<typeof organizationFormSchema>) => {
    if (!orgToEdit) return;
    setIsSubmitting(true);
    try {
        const orgRef = doc(db, 'organizations', orgToEdit.id);
        await updateDoc(orgRef, values);
        toast({ title: 'Success', description: `"${values.name}" has been updated.`});
        setIsEditOrgOpen(false);
        setOrgToEdit(null);
    } catch (error) {
        console.error("Error updating organization: ", error);
        toast({ title: 'Error', description: 'Failed to update organization.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteOrg = async () => {
    if (!orgToDelete) return;

    const teamsInOrgQuery = query(collection(db, 'teams'), where('organizationId', '==', orgToDelete.id));
    const teamsInOrgSnap = await getDocs(teamsInOrgQuery);

    if (!teamsInOrgSnap.empty) {
        toast({ title: 'Error', description: 'Cannot delete organization with active teams. Please delete or reassign teams first.', variant: 'destructive' });
        setOrgToDelete(null);
        return;
    }

    try {
        await deleteDoc(doc(db, 'organizations', orgToDelete.id));
        toast({ title: 'Success', description: 'Organization has been deleted.' });
    } catch (error) {
        toast({ title: 'Error', description: 'Failed to delete organization.', variant: 'destructive' });
    }
    setOrgToDelete(null);
  }

  return (
    <div className="space-y-8 p-4 md:p-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Organization Management</CardTitle>
              <CardDescription>
                 Create and manage organizations.
              </CardDescription>
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
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="animate-spin" />}
                        Create Organization
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            ) : (
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
                              <DropdownMenuItem onSelect={() => handleOpenEditDialog(org)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setOrgToDelete(org)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
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
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="animate-spin" />}
                    Save Changes
                  </Button>
              </DialogFooter>
              </form>
          </Form>
          </DialogContent>
      </Dialog>
      
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
    </div>
  );
}
