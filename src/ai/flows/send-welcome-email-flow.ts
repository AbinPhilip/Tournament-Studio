
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

const WelcomeEmailOutputSchema = z.object({
    subject: z.string().describe('The subject line for the email.'),
    body: z.string().describe('The body content of the email.'),
});

const welcomeEmailPrompt = ai.definePrompt({
    name: 'welcomeEmailPrompt',
    input: { schema: WelcomeEmailInputSchema },
    output: { schema: WelcomeEmailOutputSchema },
    prompt: `
        You are an assistant that writes welcoming and informative emails to new users of an application called "Score Vision".
        Your tone should be friendly and professional.
        
        Generate a welcome email for a new user with the following details:
        - Name: {{{name}}}
        - Username: {{{username}}}
        - Role: {{{role}}}

        The email should:
        1.  Have a clear and welcoming subject line.
        2.  Greet the user by name.
        3.  Confirm their account creation and mention their username.
        4.  Briefly explain what they can do based on their assigned role. Keep it concise.
            - "individual": Can view their own profile and information.
            - "update": Can modify specific data records in the system.
            - "inquiry": Has read-only access to browse system data.
            - "admin": Can manage users, teams, and system settings.
            - "super": Has full system-wide administrative powers.
        5.  Provide the application URL for them to log in: {{{appUrl}}}
        6.  End with a friendly closing from "The Score Vision Team".

        Do not include their phone number in the email body.
    `,
});


const sendWelcomeEmailFlow = ai.defineFlow(
  {
    name: 'sendWelcomeEmailFlow',
    inputSchema: WelcomeEmailInputSchema,
    outputSchema: z.object({ success: z.boolean() }),
  },
  async (input) => {
    
    const { output } = await welcomeEmailPrompt(input);

    if (!output) {
        console.error('AI failed to generate welcome email content.');
        return { success: false };
    }

    const { subject, body } = output;

    // In a real application, you would integrate an email sending service here.
    // For this example, we'll just log the AI-generated email to the console.
    console.log('--- Sending Welcome Email ---');
    console.log(`To: ${input.name}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${body}`);
    console.log('-----------------------------');

    return { success: true };
  }
);

export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<{ success: boolean }> {
    return sendWelcomeEmailFlow(input);
}
