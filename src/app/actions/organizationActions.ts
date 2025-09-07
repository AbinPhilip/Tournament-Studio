
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { Organization } from '@/types';

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
    const orgsRef = collection(db, 'organizations');
    const q = query(orgsRef, where('name', '==', name));
    const querySnapshot = await getDocs(q);
    
    let isDuplicate = false;
    querySnapshot.forEach((doc) => {
        if (!id || doc.id !== id) {
            isDuplicate = true;
        }
    });

    if (isDuplicate) {
        return { error: 'An organization with this name already exists.' };
    }

    if (id) {
      const orgRef = doc(db, 'organizations', id);
      await updateDoc(orgRef, { name, location });
    } else {
      await addDoc(orgsRef, { name, location });
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
