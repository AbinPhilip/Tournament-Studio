
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, doc, query, where, onSnapshot, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import type { ImageMetadata } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Upload, Trash2, Download, ImageIcon } from 'lucide-react';
import Image from 'next/image';
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


export default function ImageUploaderPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [imageToDelete, setImageToDelete] = useState<ImageMetadata | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
        setIsLoading(false);
        return;
    };
    
    setIsLoading(true);
    const q = query(
        collection(db, "images"), 
        where("uploaderId", "==", user.id),
        orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const imagesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as ImageMetadata));
        setImages(imagesData);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching images:", error);
        toast({ title: 'Error', description: 'Could not fetch your images.', variant: 'destructive' });
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
        toast({ title: "Authentication Error", description: "You must be logged in to upload images.", variant: "destructive" });
        return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
        toast({ title: "File Too Large", description: `The file must be less than 5MB.`, variant: "destructive" });
        return;
    }
    
    setIsUploading(true);
    const storagePath = `images/${user.id}/${uuidv4()}-${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => { /* progress can be monitored here */ },
      (error) => {
        console.error("Upload failed:", error);
        toast({ title: "Upload Failed", description: "Could not upload the image. Please check your network and security rules.", variant: "destructive" });
        setIsUploading(false);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
          const imageMetadata = {
            imageUrl: downloadURL,
            storagePath: storagePath,
            uploaderId: user.id,
            createdAt: serverTimestamp(),
            originalFilename: file.name,
            fileSize: file.size,
            mimeType: file.type,
          };

          try {
            await addDoc(collection(db, "images"), imageMetadata);
            toast({ title: "Upload Successful", description: `"${file.name}" has been uploaded.` });
          } catch(e) {
            console.error("Firestore error:", e);
            toast({ title: "Metadata Error", description: "Image uploaded, but failed to save metadata.", variant: "destructive" });
          } finally {
            setIsUploading(false);
          }
        });
      }
    );
  }, [user, toast]);

  const handleDeleteClick = (image: ImageMetadata) => {
    setImageToDelete(image);
  };
  
  const handleConfirmDelete = async () => {
    if (!imageToDelete) return;

    const { storagePath, id } = imageToDelete;
    
    try {
        // Delete from Storage
        const imageRef = ref(storage, storagePath);
        await deleteObject(imageRef);

        // Delete from Firestore
        await deleteDoc(doc(db, "images", id));

        toast({ title: "Image Deleted", description: "The image has been successfully removed." });
    } catch(error) {
        console.error("Deletion error:", error);
        toast({ title: "Deletion Failed", description: "Could not delete the image. It may have already been removed.", variant: "destructive" });
    } finally {
        setImageToDelete(null);
    }
  };

  return (
    <div className="space-y-8 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Image Uploader</CardTitle>
          <CardDescription>Upload and manage images for your tournament. Files are stored securely in Cloud Storage.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="flex gap-2">
                <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    {isUploading ? <Loader2 className="animate-spin" /> : <Upload />}
                    Upload Image
                </Button>
                <Input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/png, image/jpeg, image/gif, image/webp"
                />
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Your Image Gallery</CardTitle>
            <CardDescription>View and manage your uploaded images.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-48"><Loader2 className="h-12 w-12 animate-spin" /></div>
            ) : images.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {images.map(image => (
                        <div key={image.id} className="relative group aspect-square">
                           <Image src={image.imageUrl} alt={image.originalFilename} fill className="object-cover rounded-md border" />
                           <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <a href={image.imageUrl} download={image.originalFilename} target="_blank" rel="noopener noreferrer">
                                <Button size="sm"><Download className="mr-2"/>Download</Button>
                               </a>
                               <Button size="sm" variant="destructive" onClick={() => handleDeleteClick(image)}>
                                <Trash2 className="mr-2"/>Delete
                               </Button>
                           </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    <ImageIcon className="mx-auto h-12 w-12" />
                    <p className="mt-4">You haven't uploaded any images yet.</p>
                </div>
            )}
        </CardContent>
      </Card>
      
      <AlertDialog open={!!imageToDelete} onOpenChange={(isOpen) => !isOpen && setImageToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to delete this image?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the image from storage and its associated metadata.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
