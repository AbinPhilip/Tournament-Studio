
"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, UploadCloud } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface MultiImageUploaderProps {
  value?: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  className?: string;
}

export function MultiImageUploader({
  value = [],
  onChange,
  maxFiles = 5,
  className,
}: MultiImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (value.length + files.length > maxFiles) {
      toast({
        title: 'File Limit Exceeded',
        description: `You can only upload a maximum of ${maxFiles} files.`,
        variant: 'destructive',
      });
      return;
    }

    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Invalid File Type', description: `File "${file.name}" is not an image.` });
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        onChange([...value, dataUrl]);
      };
      reader.readAsDataURL(file);
    });

    // Reset file input
    if(event.target) {
        event.target.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {value.map((url, index) => (
          <div key={index} className="relative group aspect-square">
            <Image
              src={url}
              alt={`Preview ${index}`}
              layout="fill"
              className="object-cover rounded-md border"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleRemoveImage(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {value.length < maxFiles && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center w-full aspect-square border-2 border-dashed rounded-md hover:border-primary transition-colors text-muted-foreground"
          >
            <UploadCloud className="h-8 w-8" />
            <span className="mt-2 text-sm text-center">Upload Image(s)</span>
          </button>
        )}
      </div>
       <Input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple={maxFiles > 1}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}
