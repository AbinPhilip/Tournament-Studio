
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MoreHorizontal, Trash2, Edit, CheckCircle, HeartHandshake } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import type { Sponsor } from '@/types';
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
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LoadingShuttlecock } from '@/components/ui/loading-shuttlecock';

const sponsorFormSchema = z.object({
    name: z.string().min(2, { message: "Sponsor name must be at least 2 characters." }),
});

export default function SponsorsPage() {
  const { toast } = useToast();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [sponsorToEdit, setSponsorToEdit] = useState<Sponsor | null>(null);
  const [sponsorToDelete, setSponsorToDelete] = useState<Sponsor | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);

  const form = useForm<z.infer<typeof sponsorFormSchema>>({
    resolver: zodResolver(sponsorFormSchema),
    defaultValues: { name: '' },
  });
  
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'sponsors'), (snapshot) => {
      const sponsorsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sponsor));
      setSponsors(sponsorsData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching sponsors:", error);
      toast({ title: 'Error', description: 'Failed to load sponsors.', variant: 'destructive' });
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);

  const handleOpenForm = useCallback((sponsor: Sponsor | null = null) => {
    if (sponsor) {
      setSponsorToEdit(sponsor);
      form.reset(sponsor);
    } else {
      setSponsorToEdit(null);
      form.reset({ name: '' });
    }
    setIsFormOpen(true);
  }, [form]);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setSponsorToEdit(null);
    form.reset({ name: '' });
  }, [form]);


  const handleFormSubmit = async (values: z.infer<typeof sponsorFormSchema>) => {
    setIsSubmitting(true);
    try {
      if (sponsorToEdit) {
        const sponsorRef = doc(db, 'sponsors', sponsorToEdit.id);
        await updateDoc(sponsorRef, values);
        toast({ title: 'Sponsor Updated', description: `Details for "${values.name}" have been updated.` });
      } else {
        await addDoc(collection(db, 'sponsors'), values);
        toast({ title: 'Sponsor Added', description: `Sponsor "${values.name}" has been added.` });
      }

      handleCloseForm();
    } catch (error) {
      console.error("Error submitting sponsor:", error);
      toast({ title: 'Error', description: `Failed to ${sponsorToEdit ? 'update' : 'add'} sponsor.`, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleDeleteSponsor = async () => {
    if (!sponsorToDelete) return;
    setIsSubmitting(true);
    try {
        await deleteDoc(doc(db, 'sponsors', sponsorToDelete.id));
        toast({ title: 'Sponsor Deleted', description: `"${sponsorToDelete.name}" has been removed.` });
        setSponsorToDelete(null);
    } catch (error) {
        toast({ title: 'Error', description: 'Failed to delete sponsor.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 p-4 md:p-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Sponsor Management</CardTitle>
            <CardDescription>Add, edit, or remove tournament sponsors.</CardDescription>
          </div>
          <Button onClick={() => handleOpenForm()}>
            <HeartHandshake className="mr-2 h-4 w-4" /> Add Sponsor
          </Button>
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
                  <TableHead>Sponsor Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sponsors.map((sponsor) => (
                  <TableRow key={sponsor.id}>
                    <TableCell className="font-medium">{sponsor.name}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => handleOpenForm(sponsor)}>
                            <Edit className="mr-2 h-4 w-4" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setSponsorToDelete(sponsor)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />Delete
                          </DropdownMenuItem>
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

      <Dialog open={isFormOpen} onOpenChange={(open) => !open && handleCloseForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{sponsorToEdit ? 'Edit Sponsor' : 'Add New Sponsor'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sponsor Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Awesome Inc." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <div className="animate-spin h-5 w-5 border-2 border-background border-t-transparent rounded-full" /> : <CheckCircle />}
                  {sponsorToEdit ? 'Save Changes' : 'Add Sponsor'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!sponsorToDelete} onOpenChange={(open) => !open && setSponsorToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the sponsor "{sponsorToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSponsor} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isSubmitting}>
              {isSubmitting ? <div className="animate-spin h-5 w-5 border-2 border-background border-t-transparent rounded-full" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
