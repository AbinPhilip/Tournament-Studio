
'use server';
/**
 * @fileOverview A secure flow for deleting an image from Storage and Firestore.
 * 
 * - deleteImage - Verifies ownership and deletes the image and its metadata.
 * - DeleteImageInput - The input type for the deleteImage function.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { ImageMetadata } from '@/types';

const DeleteImageInputSchema = z.object({
  imageId: z.string().describe('The Firestore document ID of the image metadata.'),
  requestingUserId: z.string().describe('The ID of the user requesting the deletion.'),
});
export type DeleteImageInput = z.infer<typeof DeleteImageInputSchema>;

const deleteImageFlow = ai.defineFlow(
  {
    name: 'deleteImageFlow',
    inputSchema: DeleteImageInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    const { imageId, requestingUserId } = input;

    const imageDocRef = doc(db, 'images', imageId);
    const imageDocSnap = await getDoc(imageDocRef);

    if (!imageDocSnap.exists()) {
      throw new Error('Image metadata not found in Firestore.');
    }

    const imageMetadata = imageDocSnap.data() as ImageMetadata;

    // Security Check: Ensure the user requesting deletion is the one who uploaded it.
    if (imageMetadata.uploaderId !== requestingUserId) {
      throw new Error('Permission denied. You can only delete your own images.');
    }

    // 1. Delete the file from Cloud Storage
    try {
      const storageRef = ref(storage, imageMetadata.storagePath);
      await deleteObject(storageRef);
    } catch (error: any) {
      // If the file doesn't exist in storage, we can still proceed to delete the Firestore doc.
      if (error.code !== 'storage/object-not-found') {
        console.error("Failed to delete from storage:", error);
        throw new Error('Failed to delete image from storage.');
      }
      console.warn(`File not found in storage at path: ${imageMetadata.storagePath}, but proceeding to delete Firestore record.`);
    }
    
    // 2. Delete the metadata document from Firestore
    await deleteDoc(imageDocRef);
  }
);


export async function deleteImage(input: DeleteImageInput): Promise<void> {
  await deleteImageFlow(input);
}

    