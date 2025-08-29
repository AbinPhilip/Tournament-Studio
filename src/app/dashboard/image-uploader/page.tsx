
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import type { ImageMetadata } from '@/types';
import { Loader2, UploadCloud, Image as ImageIcon, Trash2 } from 'lucide-react';
import NextImage from 'next/image';
import { format } from 'date-fns';

export default function ImageUploaderPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [imageToDelete, setImageToDelete] = useState<ImageMetadata | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    const q = query(
      collection(db, "images"), 
      where("uploaderId", "==", user.id),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const imageData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ImageMetadata));
        setImages(imageData);
        setIsLoading(false);
    }, (error) => {
        console.error(error);
        toast({ title: "Error", description: "Failed to fetch images. You may need to create a Firestore index.", variant: "destructive" });
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ title: "File too large", description: "Please select an image smaller than 2MB.", variant: "destructive"});
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);
    setUploadProgress(0);

    const storagePath = `images/${user.id}/${uuidv4()}-${selectedFile.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, selectedFile);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      }, 
      (error) => {
        console.error("Upload failed:", error);
        toast({ title: "Upload Failed", description: error.message, variant: "destructive"});
        setIsUploading(false);
      }, 
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, "images"), {
            imageUrl: downloadURL,
            storagePath: storagePath, // Use the defined path
            uploaderId: user.id,
            uploaderName: user.name,
            createdAt: serverTimestamp(),
            originalFilename: selectedFile.name,
            fileSize: selectedFile.size,
            mimeType: selectedFile.type,
          });
          toast({ title: "Success", description: "Image uploaded and metadata saved."});
        } catch (error) {
           console.error("Error saving metadata:", error);
           toast({ title: "Error", description: "Image uploaded, but failed to save metadata.", variant: "destructive"});
        } finally {
            setIsUploading(false);
            setSelectedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
      }
    );
  };
  
  const handleDeleteImage = async () => {
    if (!imageToDelete) return;

    setIsDeleting(true);
    try {
        const storageRef = ref(storage, imageToDelete.storagePath);
        await deleteObject(storageRef);

        await deleteDoc(doc(db, "images", imageToDelete.id));
        toast({ title: "Image Deleted", description: "Image and metadata have been removed." });
    } catch(error) {
        console.error("Deletion error:", error);
        toast({ title: "Error", description: "Failed to delete image.", variant: "destructive" });
    } finally {
        setIsDeleting(false);
        setImageToDelete(null);
    }
  };


  return (
    <div className="space-y-8 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud /> Image Uploader
          </CardTitle>
          <CardDescription>
            Upload images to Cloud Storage and manage their metadata in Firestore.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" />
          {selectedFile && (
            <div className="p-4 border rounded-md space-y-3">
              <p>Selected file: <span className="font-semibold">{selectedFile.name}</span></p>
              {isUploading && <Progress value={uploadProgress} />}
              <Button onClick={handleUpload} disabled={isUploading || !selectedFile}>
                {isUploading ? <Loader2 className="animate-spin mr-2" /> : <UploadCloud className="mr-2" />}
                Upload Image
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>My Uploaded Images</CardTitle>
          <CardDescription>Images you have uploaded to the system.</CardDescription>
        </CardHeader>
        <CardContent>
           {isLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
           ) : images.length > 0 ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map(image => (
                    <div key={image.id} className="border rounded-lg overflow-hidden group relative">
                        <NextImage src={image.imageUrl} alt={image.originalFilename} width={300} height={300} className="aspect-square object-cover w-full h-full" />
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50 text-white text-xs backdrop-blur-sm">
                            <p className="font-bold truncate">{image.originalFilename}</p>
                            <p>Uploaded: {image.createdAt ? format((image.createdAt as Timestamp).toDate(), "dd MMM yyyy") : 'N/A'}</p>
                        </div>
                        <Button 
                            variant="destructive" size="icon" 
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setImageToDelete(image)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
             </div>
           ) : (
             <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-4" />
                <p>You haven't uploaded any images yet.</p>
            </div>
           )}
        </CardContent>
      </Card>

      <AlertDialog open={!!imageToDelete} onOpenChange={(open) => !open && setImageToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the image <span className="font-semibold">{imageToDelete?.originalFilename}</span> from storage and remove its record from the database.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteImage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeleting}>
                  {isDeleting && <Loader2 className="animate-spin mr-2" />}
                  Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
