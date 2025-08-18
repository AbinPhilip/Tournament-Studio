
"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

interface ImageUploaderProps {
  folder: string;
  onUpload: (urls: string[]) => void;
  onRemove: (url: string) => void;
  currentImages?: string[];
  multiple?: boolean;
  disabled?: boolean;
}

export function ImageUploader({ 
    folder, 
    onUpload, 
    onRemove, 
    currentImages = [], 
    multiple = false, 
    disabled = false 
}: ImageUploaderProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!multiple && files.length > 1) {
        toast({ title: "Single File Only", description: "You can only upload one logo.", variant: "destructive"});
        return;
    }

    setIsUploading(true);
    try {
        const uploadedUrls = await Promise.all(
            Array.from(files).map(async (file) => {
                const storageRef = ref(storage, `${folder}/${uuidv4()}-${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                return await getDownloadURL(snapshot.ref);
            })
        );
        onUpload(uploadedUrls);
        toast({ title: 'Upload Successful', description: `${uploadedUrls.length} image(s) uploaded.` });
    } catch (error) {
        console.error("Upload error:", error);
        toast({ title: 'Upload Failed', description: 'Could not upload images.', variant: 'destructive' });
    } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }
  };

  return (
    <div className="space-y-4">
        <div className="flex gap-2">
            <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading || disabled}>
                {isUploading ? <Loader2 className="animate-spin" /> : <Upload />}
                Upload
            </Button>
            <Input
                type="file"
                ref={fileInputRef}
                multiple={multiple}
                onChange={handleFileSelect}
                className="hidden"
                accept="image/png, image/jpeg, image/gif"
                disabled={disabled}
            />
        </div>

        {currentImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {currentImages.map((url) => (
                    <div key={url} className="relative group aspect-square">
                        <Image src={url} alt="Uploaded image" layout="fill" className="object-cover rounded-md border" />
                         {!disabled && (
                             <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => onRemove(url)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                         )}
                    </div>
                ))}
            </div>
        )}

        {currentImages.length === 0 && (
             <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-md text-muted-foreground">
                <ImageIcon className="h-8 w-8 mb-2" />
                <p>No images uploaded.</p>
            </div>
        )}
    </div>
  );
}
