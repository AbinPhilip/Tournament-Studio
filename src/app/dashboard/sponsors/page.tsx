
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
import { MoreHorizontal, Trash2, Edit, CheckCircle, Loader2, HeartHandshake } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import Image from 'next/image';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

const sponsorFormSchema = z.object({
    name: z.string().min(2, { message: "Sponsor name must be at least 2 characters." }),
    photoUrl: z.string().url().optional().or(z.literal('')),
    photoPath: z.string().optional(),
});

export default function SponsorsPage() {
  const { toast } = useToast();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [sponsorToEdit, setSponsorToEdit] = useState<Sponsor | null>(null);
  const [sponsorToDelete, setSponsorToDelete] = useState<Sponsor | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof sponsorFormSchema>>({
    resolver: zodResolver(sponsorFormSchema),
    defaultValues: { name: '', photoUrl: '', photoPath: '' },
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
      setPhotoPreview(sponsor.photoUrl || null);
    } else {
      setSponsorToEdit(null);
      form.reset({ name: '', photoUrl: '', photoPath: '' });
      setPhotoPreview(null);
    }
    setIsFormOpen(true);
  }, [form]);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setSponsorToEdit(null);
    form.reset({ name: '', photoUrl: '', photoPath: '' });
    setPhotoPreview(null);
  }, [form]);

  const handlePhotoUpload = async (file: File): Promise<{ downloadUrl: string, photoPath: string } | null> => {
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_FILE_SIZE) {
        toast({ title: "File Too Large", description: `"${file.name}" is larger than 2MB.`, variant: "destructive" });
        return null;
    }
    const photoPath = `sponsor-logos/${uuidv4()}-${file.name}`;
    const storageRef = ref(storage, photoPath);

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async (e) => {
            try {
                const dataUrl = e.target?.result as string;
                await uploadString(storageRef, dataUrl, 'data_url');
                const downloadUrl = await getDownloadURL(storageRef);
                resolve({ downloadUrl, photoPath });
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
    });
  };

  const handleFormSubmit = async (values: z.infer<typeof sponsorFormSchema>) => {
    setIsSubmitting(true);
    try {
        let finalPhotoUrl = sponsorToEdit?.photoUrl || '';
        let finalPhotoPath = sponsorToEdit?.photoPath || '';
        const file = fileInputRef.current?.files?.[0];

        if (file) { // A new file has been selected for upload
            // Upload the new logo first
            const uploadResult = await handlePhotoUpload(file);
            if (uploadResult) {
                // If there was an old logo, try to delete it from storage *after* the new one is uploaded.
                if (sponsorToEdit?.photoPath) {
                    try {
                        const oldLogoRef = ref(storage, sponsorToEdit.photoPath);
                        await deleteObject(oldLogoRef);
                    } catch (e: any) {
                        // Log a warning if deletion fails, but don't block the update.
                        if (e.code !== 'storage/object-not-found') {
                            console.warn("Could not delete old logo, but proceeding with update:", e);
                        }
                    }
                }
                finalPhotoUrl = uploadResult.downloadUrl;
                finalPhotoPath = uploadResult.photoPath;
            } else {
                // If upload fails, don't proceed with the form submission
                setIsSubmitting(false);
                return;
            }
        }
        
        const sponsorData = { name: values.name, photoUrl: finalPhotoUrl, photoPath: finalPhotoPath };

        if (sponsorToEdit) {
            const sponsorRef = doc(db, 'sponsors', sponsorToEdit.id);
            await updateDoc(sponsorRef, sponsorData);
            toast({ title: 'Sponsor Updated', description: `Details for "${values.name}" have been updated.` });
        } else {
            await addDoc(collection(db, 'sponsors'), sponsorData);
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
        
        if (sponsorToDelete.photoPath) {
            try {
                const logoRef = ref(storage, sponsorToDelete.photoPath);
                await deleteObject(logoRef);
            } catch (e: any) {
                 if (e.code !== 'storage/object-not-found') {
                    console.warn("Could not delete logo from storage, it might have been removed already:", e);
                 }
            }
        }
        toast({ title: 'Sponsor Deleted', description: `"${sponsorToDelete.name}" has been removed.` });
        setSponsorToDelete(null);
    } catch (error) {
        toast({ title: 'Error', description: 'Failed to delete sponsor.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setPhotoPreview(URL.createObjectURL(file));
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
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Logo</TableHead>
                  <TableHead>Sponsor Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sponsors.map((sponsor) => (
                  <TableRow key={sponsor.id}>
                    <TableCell>
                      <Image 
                        data-ai-hint="company logo"
                        src={sponsor.photoUrl || "https://placehold.co/80x80.png"} 
                        alt={`${sponsor.name} logo`} 
                        width={80} 
                        height={80} 
                        className="rounded-md object-contain bg-muted" 
                      />
                    </TableCell>
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
              <FormItem>
                <FormLabel>Sponsor Logo</FormLabel>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 bg-muted rounded-md flex items-center justify-center overflow-hidden">
                    <Image data-ai-hint="company logo" src={photoPreview || "https://placehold.co/80x80.png"} width={80} height={80} alt="Sponsor logo" className="object-contain h-full w-full" />
                  </div>
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    Upload Logo
                  </Button>
                  <Input type="file" ref={fileInputRef} onChange={handlePhotoChange} className="hidden" accept="image/*" />
                </div>
              </FormItem>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle />}
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
              {isSubmitting ? <Loader2 className="animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
