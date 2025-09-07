
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, onSnapshot, writeBatch, setDoc, Timestamp } from 'firebase/firestore';
import type { Team, Organization, Registration, Tournament } from '@/types';
import { EventBadge } from '@/components/ui/event-badge';
import { DollarSign, Receipt } from 'lucide-react';
import Link from 'next/link';

const paymentFormSchema = z.object({
  paymentAmount: z.coerce.number().positive({ message: "Amount must be greater than 0." }),
});

type MergedTeamData = Team & Registration & { orgName: string };

export default function RegistrationPage() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [registrations, setRegistrations] = useState<Map<string, Registration>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [teamToPay, setTeamToPay] = useState<MergedTeamData | null>(null);

  const form = useForm<z.infer<typeof paymentFormSchema>>({
    resolver: zodResolver(paymentFormSchema),
  });

  useEffect(() => {
    const unsubOrgs = onSnapshot(collection(db, 'organizations'), (snapshot) => {
      setOrganizations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization)));
    });

    const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      const fetchedTeams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(fetchedTeams);
      setIsLoading(false);
    });

    const unsubRegistrations = onSnapshot(collection(db, 'registrations'), (snapshot) => {
      const newRegistrations = new Map<string, Registration>();
      snapshot.forEach(doc => {
        newRegistrations.set(doc.id, { id: doc.id, ...doc.data() } as Registration);
      });
      setRegistrations(newRegistrations);
    });

    return () => {
      unsubOrgs();
      unsubTeams();
      unsubRegistrations();
    };
  }, []);

  const handleKitToggle = async (teamId: string, currentStatus: boolean) => {
    try {
      const regRef = doc(db, 'registrations', teamId);
      await setDoc(regRef, { kitProvided: !currentStatus }, { merge: true });
      toast({ title: 'Status Updated', description: 'Kit status has been changed.' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to update kit status.', variant: 'destructive' });
    }
  };

  const handlePaymentSubmit = async (values: z.infer<typeof paymentFormSchema>) => {
    if (!teamToPay) return;
    try {
      const regRef = doc(db, 'registrations', teamToPay.id);
      await setDoc(regRef, {
        paymentStatus: 'paid',
        paymentAmount: values.paymentAmount,
        paymentDate: Timestamp.now(),
      }, { merge: true });
      toast({ title: 'Payment Confirmed', description: `Payment for ${teamToPay.player1Name}'s team recorded.` });
      setTeamToPay(null);
      form.reset();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to confirm payment.', variant: 'destructive' });
    }
  };
  
  const mergedData = useMemo<MergedTeamData[]>(() => {
    const orgMap = new Map(organizations.map(o => [o.id, o.name]));
    return teams.map(team => {
      const registration = registrations.get(team.id) || {
        id: team.id,
        teamId: team.id,
        paymentStatus: 'pending',
        kitProvided: false,
      };
      return {
        ...team,
        ...registration,
        orgName: orgMap.get(team.organizationId) || 'Unknown Org',
      };
    }).sort((a, b) => a.orgName.localeCompare(b.orgName) || a.player1Name.localeCompare(b.player1Name));
  }, [teams, organizations, registrations]);

  return (
    <div className="space-y-8 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Registration Desk</CardTitle>
          <CardDescription>Manage team registration formalities like payment and kit distribution.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-center">Kit Provided</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mergedData.map(team => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.player1Name}{team.player2Name && ` & ${team.player2Name}`}</TableCell>
                    <TableCell>{team.orgName}</TableCell>
                    <TableCell><EventBadge eventType={team.type} /></TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={team.kitProvided}
                        onCheckedChange={() => handleKitToggle(team.id, team.kitProvided)}
                        aria-label="Kit provided status"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={team.paymentStatus === 'paid' ? 'default' : 'secondary'}>
                        {team.paymentStatus === 'paid' ? `Paid ($${team.paymentAmount})` : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {team.paymentStatus === 'pending' ? (
                        <Button variant="outline" size="sm" onClick={() => setTeamToPay(team)}>
                          <DollarSign className="mr-2 h-4 w-4" />
                          Confirm Payment
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" asChild>
                           <Link href={`/dashboard/registration/receipt/${team.id}`} target="_blank">
                            <Receipt className="mr-2 h-4 w-4" />
                            View Receipt
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!teamToPay} onOpenChange={(isOpen) => !isOpen && setTeamToPay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment for {teamToPay?.player1Name}'s Team</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handlePaymentSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="paymentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Amount ($)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Enter amount" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                <Button type="submit">Confirm Payment</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
