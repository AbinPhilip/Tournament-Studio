"use client";

import { useAuth } from '@/hooks/use-auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types';

const profileFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
});

export default function IndividualView() {
  const { user, updateUserContext } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
    },
  });

  function onSubmit(values: z.infer<typeof profileFormSchema>) {
    if (user) {
        const updatedUser: User = { ...user, ...values };
        updateUserContext(updatedUser);
        toast({
          title: 'Profile Updated',
          description: 'Your information has been successfully updated.',
        });
    }
  }
  
  if (!user) return null;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Welcome, {user.name}</h1>
      <p className="text-muted-foreground mb-8">Here you can update your personal information.</p>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>Update your name and email address.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Your email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex space-x-4">
                <FormItem className="w-1/2">
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input disabled value={user.username} />
                  </FormControl>
                </FormItem>
                <FormItem className="w-1/2">
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input disabled value={user.phoneNumber} />
                  </FormControl>
                </FormItem>
              </div>
              <Button type="submit">Update Profile</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
