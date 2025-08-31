"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
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
import { LoadingShuttlecock } from '@/components/ui/loading-shuttlecock';
import { Progress } from '@/components/ui/progress';
import { uploadImage } from '@/ai/flows/upload-image-flow';


export default function ImageUploaderPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // For optimistic UI, might not be used with backend uploads
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
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
        toast({ title: "File Too Large", description: `The file must be less than 5MB.`, variant: "destructive" });
        return;
    }
    
    setIsUploading(true);
    setUploadProgress(0); // Reset progress

    try {
        // Convert file to Base64 Data URI
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const dataUrl = reader.result as string;

            const { imageUrl, storagePath } = await uploadImage({
                fileDataUrl: dataUrl,
                fileName: file.name,
                userId: user.id
            });

            const imageMetadata = {
                imageUrl: imageUrl,
                storagePath: storagePath,
                uploaderId: user.id,
                createdAt: serverTimestamp(),
                originalFilename: file.name,
                fileSize: file.size,
                mimeType: file.type,
            };

            await addDoc(collection(db, "images"), imageMetadata);
            toast({ title: "Upload Successful", description: `"${file.name}" has been uploaded.` });
            setIsUploading(false);
        };
        reader.onerror = (error) => {
             console.error("FileReader error:", error);
             toast({ title: "File Read Error", description: "Could not read the selected file.", variant: "destructive" });
             setIsUploading(false);
        }
    } catch (error) {
        console.error("Upload failed:", error);
        let description = "Could not upload the image. Please try again.";
        toast({ 
            title: "Upload Failed", 
            description: description,
            variant: "destructive" 
        });
        setIsUploading(false);
    }
  }, [user, toast]);

  const handleDeleteClick = (image: ImageMetadata) => {
    setImageToDelete(image);
  };
  
  const handleConfirmDelete = async () => {
    if (!imageToDelete || !user || imageToDelete.uploaderId !== user.id) return;

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
                        {/* Since backend upload doesn't provide progress, we show a generic loader */}
                        <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
                            <LoadingShuttlecock className="w-6 h-6" />
                            Uploading...
                        </p>
                    </div>
                )}
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>My Image Gallery</CardTitle>
            <CardDescription>View and manage your uploaded images.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-48"><LoadingShuttlecock /></div>
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
