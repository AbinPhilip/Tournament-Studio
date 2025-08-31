
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

const organizationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, { message: "Organization name must be at least 2 characters." }),
  location: z.string().min(2, { message: "Location is required." }),
});

export async function addOrUpdateOrganization(data: z.infer<typeof organizationSchema>) {
  const validatedFields = organizationSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields provided.",
    };
  }
  
  const { id, name, location } = validatedFields.data;

  try {
    // Check for duplicate organization name, excluding the current one if editing
    const q = query(collection(db, 'organizations'), where('name', '==', name));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
        if (!id || querySnapshot.docs[0].id !== id) {
             return { error: 'An organization with this name already exists.' };
        }
    }

    if (id) {
      // Update existing organization
      const orgRef = doc(db, 'organizations', id);
      await updateDoc(orgRef, { name, location });
    } else {
      // Add new organization
      await addDoc(collection(db, 'organizations'), { name, location });
    }

    revalidatePath('/dashboard/organizations');
    return { success: true, id: id };

  } catch (error) {
    console.error("Error saving organization:", error);
    return {
      error: "An unexpected error occurred while saving the organization.",
    };
  }
}
