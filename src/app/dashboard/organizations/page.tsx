
"use client";

import React, { useState, useEffect } from 'react';
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
import { MoreHorizontal, Trash2, Building, Edit, CheckCircle } from 'lucide-react';
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
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, updateDoc } from 'firebase/firestore';
import type { Organization, Team } from '@/types';


const organizationFormSchema = z.object({
    name: z.string().min(2, { message: "Organization name must be at least 2 characters." }),
    location: z.string().min(2, { message: "Location is required." }),
});

export default function OrganizationPage() {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);
  const [orgToEdit, setOrgToEdit] = useState<Organization | null>(null);
  const [isAddOrgOpen, setIsAddOrgOpen] = useState(false);
  const [isEditOrgOpen, setIsEditOrgOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const orgForm = useForm<z.infer<typeof organizationFormSchema>>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: { name: '', location: '' },
  });
  
  const fetchData = async () => {
      const [orgsSnap, teamsSnap] = await Promise.all([
          getDocs(collection(db, 'organizations')),
          getDocs(collection(db, 'teams')),
      ]);
      setOrganizations(orgsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization)));
      setTeams(teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  useEffect(() => {
    if (orgToEdit) {
        orgForm.reset(orgToEdit);
        setIsEditOrgOpen(true);
    }
  }, [orgToEdit, orgForm]);

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
        
      <AlertDialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <div className="flex items-center gap-2">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                    <AlertDialogTitle>Success!</AlertDialogTitle>
                </div>
                <AlertDialogDescription>
                  Organization details have been saved successfully.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => setIsSuccessModalOpen(false)}>OK</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
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
