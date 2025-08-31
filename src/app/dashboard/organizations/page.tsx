
"use client";

import React, { useState, useEffect, useCallback, useTransition } from 'react';
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
import { MoreHorizontal, Trash2, Building, Edit } from 'lucide-react';
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
import { LoadingShuttlecock } from '@/components/ui/loading-shuttlecock';

// New server action import
import { addOrUpdateOrganization } from '@/app/actions/organizationActions';


const organizationFormSchema = z.object({
    name: z.string().min(2, { message: "Organization name must be at least 2 characters." }),
    location: z.string().min(2, { message: "Location is required." }),
});

export default function OrganizationPage() {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);
  const [orgToEdit, setOrgToEdit] = useState<Organization | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  
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

    return () => orgsUnsubscribe();
  }, [toast]);
  
  const handleOpenEditDialog = useCallback((org: Organization) => {
    setOrgToEdit(org);
    orgForm.reset(org);
    setIsFormOpen(true);
  }, [orgForm]);

  const handleOpenAddDialog = useCallback(() => {
    setOrgToEdit(null);
    orgForm.reset({ name: '', location: '' });
    setIsFormOpen(true);
  }, [orgForm]);

  const handleFormSubmit = (values: z.infer<typeof organizationFormSchema>) => {
    startTransition(async () => {
        const result = await addOrUpdateOrganization({
            id: orgToEdit?.id,
            ...values
        });

        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: result.id ? 'Organization Updated' : 'Organization Created', description: `"${values.name}" has been saved.` });
            setIsFormOpen(false);
        }
    });
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
            <Button onClick={handleOpenAddDialog}>
              <Building className="mr-2 h-4 w-4" />
              Create Organization
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-48">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
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
      
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent>
            <DialogHeader>
                <DialogTitle>{orgToEdit ? 'Edit Organization' : 'Create New Organization'}</DialogTitle>
            </DialogHeader>
            <Form {...orgForm}>
                <form onSubmit={orgForm.handleSubmit(handleFormSubmit)} className="space-y-4">
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
                    <Button type="submit" disabled={isPending}>
                      {isPending && <div className="animate-spin h-5 w-5 border-2 border-background border-t-transparent rounded-full" />}
                      {orgToEdit ? 'Save Changes' : 'Create Organization'}
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
