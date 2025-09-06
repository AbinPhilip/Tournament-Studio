
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import type { ImageMetadata } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Trash2, Download, ImageIcon, AlertTriangle } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import { Progress } from '@/components/ui/progress';

// --- Debugging Checklist ---
// 1. Firebase Project Setup: Ensure services (Auth, Firestore, Storage) are enabled in the Firebase Console.
// 2. Environment Variables: Verify all NEXT_PUBLIC_FIREBASE_* variables are correct in your .env file. Check for auth/invalid-api-key errors in the browser console.
// 3. Authentication: Ensure you are logged in before using the uploader. The `user` object should not be null.
// 4. Security Rules: If you see permission errors, check both `storage.rules` and `firestore.rules` in your project and deploy them to the Firebase Console.

export default function ImageUploaderPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [imageToDelete, setImageToDelete] = useState<ImageMetadata | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // The user must be logged in to access this page's functionality.
    if (!user) {
      setIsLoading(false);
      return;
    };
    
    setIsLoading(true);
    const q = query(
        collection(db, "images"), 
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
    const file = event.target.files?.[0];

    // Debug log for the user object
    console.log('[ImageUploader] User object:', user);
    
    if (!file || !user) {
        if (!user) {
            toast({ title: "Authentication Error", description: "You must be logged in to upload images.", variant: "destructive" });
        }
        return;
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
        toast({ title: "File Too Large", description: `The file must be less than 5MB.`, variant: "destructive" });
        return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);

    const storagePath = `images/${user.id}/${uuidv4()}-${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
        },
        (error) => {
            console.error("Upload failed:", error);
            let description = "Could not upload the image. Please try again.";
            if (error.code === 'storage/unauthorized') {
                description = "Permission denied. Please check your Firebase Storage rules.";
                console.error("DEBUGGING TIP: Check the Firebase Console for Storage rules and verify that they match your project's `storage.rules` file. This error indicates a mismatch or incorrect rule logic.");
            }
            toast({ title: "Upload Failed", description, variant: "destructive" });
            setIsUploading(false);
        },
        async () => {
            try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                const imageMetadata = {
                    imageUrl: downloadURL,
                    storagePath: storagePath,
                    uploaderId: user.id,
                    createdAt: serverTimestamp(),
                    originalFilename: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                };
                await addDoc(collection(db, "images"), imageMetadata);
                toast({ title: "Upload Successful", description: `"${file.name}" has been uploaded.` });
            } catch (error) {
                 console.error("Error saving metadata:", error);
                 toast({ title: "Metadata Error", description: "Image uploaded, but failed to save metadata.", variant: "destructive" });
                 console.error("DEBUGGING TIP: Verify your Firestore security rules in the Firebase Console. The error above indicates the `addDoc` call was rejected. Check the browser's network tab or Firebase debug logs for 'permission-denied' errors.");
            } finally {
                setIsUploading(false);
            }
        }
    );
  }, [user, toast]);

  const handleDeleteClick = (image: ImageMetadata) => {
    setImageToDelete(image);
  };
  
  const handleConfirmDelete = async () => {
    if (!imageToDelete) return;

    const isOwner = user && imageToDelete.uploaderId === user.id;
    if (!isOwner) {
         toast({ title: "Permission Denied", description: "You can only delete your own images.", variant: "destructive" });
         setImageToDelete(null);
         return;
    }

    const { storagePath, id } = imageToDelete;
    
    try {
        // 1. Delete from Storage
        const imageRef = ref(storage, storagePath);
        await deleteObject(imageRef);

        // 2. Delete from Firestore
        await deleteDoc(doc(db, "images", id));

        toast({ title: "Image Deleted", description: "The image has been successfully removed." });
    } catch(error: any) {
        console.error("Deletion error:", error);
        let description = "Could not delete the image.";
        if (error.code === 'storage/object-not-found') {
            description = "File not found in storage, deleting metadata record.";
            // If file doesn't exist, still try to delete firestore record
            try {
                 await deleteDoc(doc(db, "images", id));
                 toast({ title: "Image Deleted", description: "The image metadata has been successfully removed." });
            } catch (firestoreError) {
                 description = "File not found in storage, and failed to delete metadata record.";
            }
        }
        toast({ title: "Deletion Failed", description, variant: "destructive" });
    } finally {
        setImageToDelete(null);
    }
  };

  if (!user) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Image Uploader</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Please log in to use the image uploader.</p>
            </CardContent>
        </Card>
    )
  }

  return (
    <div className="space-y-8 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Image Uploader</CardTitle>
          <CardDescription>Upload and manage images for your tournament.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="flex flex-col gap-4">
                <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full sm:w-auto self-start">
                    <Upload className="mr-2"/>
                    Upload Image
                </Button>
                <Input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/png, image/jpeg, image/gif, image/webp"
                />
                {isUploading && (
                    <div className="space-y-2">
                        <Progress value={uploadProgress} className="w-full" />
                        <div
                            className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2"
                            >
                               Uploading... {Math.round(uploadProgress)}%
                        </div>
                    </div>
                )}
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Image Gallery</CardTitle>
            <CardDescription>View and manage all uploaded images.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-48"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
            ) : images.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {images.map(image => (
                        <div key={image.id} className="relative group aspect-square">
                           <Image src={image.imageUrl} alt={image.originalFilename} fill className="object-cover rounded-md border" />
                           <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <a href={image.imageUrl} download={image.originalFilename} target="_blank" rel="noopener noreferrer">
                                <Button size="sm"><Download className="mr-2"/>Download</Button>
                               </a>
                               {user?.id === image.uploaderId && (
                                   <Button size="sm" variant="destructive" onClick={() => handleDeleteClick(image)}>
                                    <Trash2 className="mr-2"/>Delete
                                   </Button>
                               )}
                           </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    <ImageIcon className="mx-auto h-12 w-12" />
                    <p className="mt-4">No images have been uploaded yet.</p>
                </div>
            )}
        </CardContent>
      </Card>
      
      <AlertDialog open={!!imageToDelete} onOpenChange={(isOpen) => !isOpen && setImageToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle />Are you sure?</AlertDialogTitle>
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

    