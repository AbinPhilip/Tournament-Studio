
'use server';
/**
 * @fileOverview A flow for uploading an image to Google Cloud Storage.
 *
 * - uploadImage - Uploads an image from a data URL.
 * - UploadImageInput - The input type for the uploadImage function.
 * - UploadImageOutput - The return type for the uploadImage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

const UploadImageInputSchema = z.object({
  fileDataUrl: z.string().describe("The file to upload, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  fileName: z.string().describe("The original name of the file."),
  userId: z.string().describe("The ID of the user uploading the file."),
});
export type UploadImageInput = z.infer<typeof UploadImageInputSchema>;

const UploadImageOutputSchema = z.object({
  imageUrl: z.string().describe("The public URL of the uploaded image."),
  storagePath: z.string().describe("The full path of the file in the storage bucket."),
});
export type UploadImageOutput = z.infer<typeof UploadImageOutputSchema>;

const uploadImageFlow = ai.defineFlow(
  {
    name: 'uploadImageFlow',
    inputSchema: UploadImageInputSchema,
    outputSchema: UploadImageOutputSchema,
  },
  async (input) => {
    const storage = new Storage();
    const bucketName = 'roleplay-nvrtl.appspot.com'; // Your bucket name

    // Extract mime type and base64 data from data URL
    const matches = input.fileDataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error("Invalid fileDataUrl format.");
    }
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    const uniqueFileName = `${uuidv4()}-${input.fileName}`;
    const storagePath = `images/${input.userId}/${uniqueFileName}`;
    const file = storage.bucket(bucketName).file(storagePath);

    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
      },
    });

    // Make the file public and get its URL
    await file.makePublic();
    const imageUrl = file.publicUrl();

    return {
      imageUrl,
      storagePath,
    };
  }
);


export async function uploadImage(input: UploadImageInput): Promise<UploadImageOutput> {
    return await uploadImageFlow(input);
}
