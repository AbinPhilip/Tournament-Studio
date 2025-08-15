
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { Tournament } from '@/types';

export function CourtUmpireLogin() {
  const router = useRouter();
  const { courtLogin } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [courts, setCourts] = useState<string[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<string | null>(null);

  useEffect(() => {
    if (isDialogOpen) {
      const fetchTournament = async () => {
        setIsLoading(true);
        try {
          const tournamentSnap = await getDocs(collection(db, 'tournaments'));
          if (!tournamentSnap.empty) {
            const tournamentData = tournamentSnap.docs[0].data() as Tournament;
            setCourts(tournamentData.courtNames.map(c => c.name));
          } else {
            toast({ variant: 'destructive', title: 'No Tournament Found', description: 'A tournament must be configured by an admin.' });
            setIsDialogOpen(false);
          }
        } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch tournament data.' });
        } finally {
          setIsLoading(false);
        }
      };
      fetchTournament();
    }
  }, [isDialogOpen, toast]);

  const handleLogin = async () => {
    if (!selectedCourt) {
        toast({ variant: 'destructive', title: 'No Court Selected', description: 'Please select a court to proceed.' });
        return;
    }
    setIsLoading(true);
    try {
      const user = await courtLogin(selectedCourt);
      if (user) {
        toast({
          title: 'Login Successful',
          description: `You are now managing ${selectedCourt}.`,
        });
        router.push('/dashboard');
      } else {
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: 'Could not log in for the selected court.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'An Error Occurred',
        description: 'Something went wrong. Please try again.',
      });
    } finally {
      setIsLoading(false);
      setIsDialogOpen(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
            Login as Umpire
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Court Umpire Login</DialogTitle>
          <DialogDescription>Select your assigned court to begin scoring.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
            {isLoading && !courts.length ? (
                <div className="flex justify-center"><Loader2 className="animate-spin" /></div>
            ) : (
                 <Select onValueChange={setSelectedCourt}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a court..." />
                    </SelectTrigger>
                    <SelectContent>
                        {courts.map(courtName => (
                            <SelectItem key={courtName} value={courtName}>
                                {courtName}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancel</Button>
          </DialogClose>
          <Button onClick={handleLogin} disabled={isLoading || !selectedCourt}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Proceed to Scorer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
