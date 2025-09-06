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
    // Ensure users are logged in before accessing the uploader page
    if (!user) {
      console.log("ImageUploaderPage: User is not authenticated. Redirect or show login message.");
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
    // 4. Add a console log to debug the user object
    console.log('handleFileUpload triggered. User object:', user);
    
    if (!user) {
        console.error("Upload blocked: User object is null. Ensure user is logged in.");
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
            // 1. Check for storage/unauthorized error
            if (error.code === 'storage/unauthorized') {
                console.error("DEBUG: Firebase Storage Permission Denied. Check the following:");
                console.error("1. Check the Firebase Console for Storage rules and verify that they match the required rules.");
                console.error("2. Ensure the `storagePath` variable matches the rules. Current path:", storagePath);
                console.error("3. Verify the user is authenticated and their UID is correct:", user?.id);
                toast({ title: "Upload Failed", description: "Permission denied. Check storage rules.", variant: "destructive" });
            } else {
                 toast({ title: "Upload Failed", description: "Could not upload the image. Please try again.", variant: "destructive" });
            }
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
                 console.error("Failed to save metadata to Firestore:", error);
                 // 2. Verify Firestore security rules
                 console.error("DEBUG: Failed to save metadata. Check the following:");
                 console.error("1. Verify your Firestore security rules in the Firebase Console.");
                 console.error("2. Check for permission-denied errors in the browser's network tab or Firebase debug logs.");
                 toast({ title: "Metadata Error", description: "Image uploaded, but failed to save metadata.", variant: "destructive" });
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

  useEffect(() => {
    // 3. Check for Firebase config issues on component mount
    if (typeof window !== 'undefined') {
        try {
            // A simple check to see if firebase app is initialized
            db.app; 
        } catch (e: any) {
            console.error("DEBUG: Firebase initialization error. Check the following:");
            console.error("1. Verify that all environment variables (NEXT_PUBLIC_FIREBASE_*) are correctly set in your .env.local or .env file.");
            console.error("2. Check the browser's console for errors like 'Firebase: Error (auth/invalid-api-key)'.");
            console.error("3. Ensure the Firebase project is correctly set up in the Firebase Console, and the Storage and Firestore services are enabled.");
            toast({ title: "Firebase Config Error", description: "Could not connect to Firebase services.", variant: "destructive" });
        }
    }
  }, []);

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
