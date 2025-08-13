'use server';
/**
 * @fileOverview A flow for sending a welcome email to new users.
 *
 * - sendWelcomeEmail - A function that handles sending the welcome email.
 * - WelcomeEmailInput - The input type for the sendWelcomeEmail function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const WelcomeEmailInputSchema = z.object({
  name: z.string().describe('The full name of the new user.'),
  username: z.string().describe('The username for the new user.'),
  phoneNumber: z.string().describe('The phone number for the new user.'),
  role: z.string().describe('The assigned role for the new user.'),
  appUrl: z.string().url().describe('The URL of the application.'),
});
export type WelcomeEmailInput = z.infer<typeof WelcomeEmailInputSchema>;

const sendWelcomeEmailFlow = ai.defineFlow(
  {
    name: 'sendWelcomeEmailFlow',
    inputSchema: WelcomeEmailInputSchema,
    outputSchema: z.object({ success: z.boolean() }),
  },
  async (input) => {
    const subject = 'Welcome to Score Vision!';
    const body = `
      Hello ${input.name},

      Welcome to Score Vision! Your account has been created successfully.
      
      You can log in using the following credentials:
      Username: ${input.username}
      Phone Number: ${input.phoneNumber}

      Your assigned role is: ${input.role}

      You can access the application at: ${input.appUrl}

      Best regards,
      The Score Vision Team
    `;

    // In a real application, you would integrate an email sending service here.
    // For this example, we'll just log the email to the console.
    console.log('--- Sending Welcome Email ---');
    console.log(`To: ${input.name} <email placeholder>`); // email is in `values` but not in schema
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
    console.log('-----------------------------');

    return { success: true };
  }
);

export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<{ success: boolean }> {
    return sendWelcomeEmailFlow(input);
}
