
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
import { collection, doc, onSnapshot, setDoc, Timestamp, getDocs } from 'firebase/firestore';
import type { Team, Organization, Registration, Tournament } from '@/types';
import { EventBadge } from '@/components/ui/event-badge';
import { DollarSign, Shirt, HandCoins } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const paymentFormSchema = z.object({
  paymentAmount: z.coerce.number().positive({ message: "Amount must be greater than 0." }),
});

type MergedTeamData = Team & Partial<Registration> & { orgName: string };
type GroupedData = {
  orgId: string;
  orgName: string;
  teams: MergedTeamData[];
  totalKits: number;
  totalFee: number;
  paidAmount: number;
  dueAmount: number;
};

export default function RegistrationPage() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [registrations, setRegistrations] = useState<Map<string, Registration>>(new Map());
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [teamToPay, setTeamToPay] = useState<MergedTeamData | null>(null);

  const form = useForm<z.infer<typeof paymentFormSchema>>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { paymentAmount: 0 }
  });

  useEffect(() => {
    const unsubOrgs = onSnapshot(collection(db, 'organizations'), (snapshot) => {
      setOrganizations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization)));
    });

    const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
    });

    const unsubRegistrations = onSnapshot(collection(db, 'registrations'), (snapshot) => {
      const newRegistrations = new Map<string, Registration>();
      snapshot.forEach(doc => {
        newRegistrations.set(doc.id, { id: doc.id, ...doc.data() } as Registration);
      });
      setRegistrations(newRegistrations);
    });

    const unsubTournament = onSnapshot(collection(db, 'tournaments'), (snapshot) => {
      if (!snapshot.empty) {
        const tourneyData = snapshot.docs[0].data() as Tournament;
        setTournament(tourneyData);
      }
      setIsLoading(false);
    });

    return () => {
      unsubOrgs();
      unsubTeams();
      unsubRegistrations();
      unsubTournament();
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
  
  const openPaymentDialog = (team: MergedTeamData) => {
    setTeamToPay(team);
    form.setValue('paymentAmount', tournament?.registrationFee || 0);
  }

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
  
  const groupedData = useMemo<GroupedData[]>(() => {
    const orgMap = new Map(organizations.map(o => [o.id, o.name]));
    const teamsByOrg: Record<string, MergedTeamData[]> = {};

    teams.forEach(team => {
      if (!teamsByOrg[team.organizationId]) {
        teamsByOrg[team.organizationId] = [];
      }
      const registration = registrations.get(team.id);
      teamsByOrg[team.organizationId].push({
        ...team,
        ...registration,
        orgName: orgMap.get(team.organizationId) || 'Unknown Org',
        kitProvided: registration?.kitProvided ?? false,
        paymentStatus: registration?.paymentStatus ?? 'pending'
      });
    });

    return Object.entries(teamsByOrg).map(([orgId, orgTeams]) => {
      const totalKits = orgTeams.length;
      const totalFee = totalKits * (tournament?.registrationFee || 0);
      const paidAmount = orgTeams.reduce((sum, team) => sum + (team.paymentAmount || 0), 0);
      
      return {
        orgId,
        orgName: orgMap.get(orgId) || 'Unknown Org',
        teams: orgTeams.sort((a,b) => a.player1Name.localeCompare(b.player1Name)),
        totalKits,
        totalFee,
        paidAmount,
        dueAmount: totalFee - paidAmount,
      };
    }).sort((a, b) => a.orgName.localeCompare(b.orgName));

  }, [teams, organizations, registrations, tournament]);

  return (
    <div className="space-y-8 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Registration Desk</CardTitle>
          <CardDescription>Manage team registration formalities like payment and kit distribution, grouped by organization.</CardDescription>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <Accordion type="single" collapsible className="w-full space-y-4">
          {groupedData.map(group => (
            <AccordionItem value={group.orgId} key={group.orgId} className="border-b-0">
                <Card>
                    <AccordionTrigger className="p-4 hover:no-underline">
                        <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center text-left gap-2">
                           <h3 className="text-xl font-bold">{group.orgName}</h3>
                           <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                                <Badge variant="secondary" className="text-base"><Shirt className="mr-2"/>{group.totalKits} Kits</Badge>
                                <Badge variant="secondary" className="text-base"><HandCoins className="mr-2"/>₹{group.totalFee.toLocaleString()}</Badge>
                                <Badge variant={group.dueAmount > 0 ? 'destructive' : 'default'} className="text-base">Due: ₹{group.dueAmount.toLocaleString()}</Badge>
                           </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                    <TableHead>Team</TableHead>
                                    <TableHead>Event</TableHead>
                                    <TableHead className="text-center">Kit Provided</TableHead>
                                    <TableHead>Payment</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {group.teams.map(team => (
                                    <TableRow key={team.id}>
                                        <TableCell className="font-medium">{team.player1Name}{team.player2Name && ` & ${team.player2Name}`}</TableCell>
                                        <TableCell><EventBadge eventType={team.type} /></TableCell>
                                        <TableCell className="text-center">
                                            <Checkbox
                                                checked={team.kitProvided}
                                                onCheckedChange={() => handleKitToggle(team.id, team.kitProvided || false)}
                                                aria-label="Kit provided status"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={team.paymentStatus === 'paid' ? 'default' : 'secondary'}>
                                                {team.paymentStatus === 'paid' ? `Paid (₹${team.paymentAmount})` : 'Pending'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                        {team.paymentStatus === 'pending' && (
                                            <Button variant="outline" size="sm" onClick={() => openPaymentDialog(team)}>
                                                <DollarSign className="mr-2 h-4 w-4" />
                                                Confirm Payment
                                            </Button>
                                        )}
                                        </TableCell>
                                    </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </AccordionContent>
                </Card>
            </AccordionItem>
          ))}
        </Accordion>
      )}

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
                    <FormLabel>Payment Amount (INR)</FormLabel>
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
