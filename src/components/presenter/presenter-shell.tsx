
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import type { Match, Tournament } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MonitorPlay, WifiOff } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LiveMatchView } from './live-match-view';
import { HubView } from './hub-view';

export function PresenterShell() {
  const { toast } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourt, setSelectedCourt] = useState<string | null>(null);

  useEffect(() => {
    const matchesQuery = query(collection(db, 'matches'), orderBy('startTime', 'desc'));
    const tournamentQuery = query(collection(db, 'tournaments'));

    const unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => {
      const matchesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: (doc.data().startTime as Timestamp)?.toDate()
      } as Match));
      setMatches(matchesData);
    }, (error) => {
      console.error("Error fetching matches:", error);
      toast({ title: 'Error', description: 'Failed to fetch match data.', variant: 'destructive' });
    });

    const unsubscribeTournament = onSnapshot(tournamentQuery, (snapshot) => {
      if (!snapshot.empty) {
        const tourneyData = snapshot.docs[0].data() as Tournament;
        setTournament(tourneyData);
        // Automatically select the first court if none is selected
        if (!selectedCourt && tourneyData.courtNames.length > 0) {
          setSelectedCourt(tourneyData.courtNames[0].name);
        }
      } else {
        setTournament(null);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching tournament:", error);
      toast({ title: 'Error', description: 'Failed to fetch tournament data.', variant: 'destructive' });
      setIsLoading(false);
    });

    return () => {
      unsubscribeMatches();
      unsubscribeTournament();
    };
  }, [toast, selectedCourt]);

  const liveMatch = matches.find(m => m.courtName === selectedCourt && m.status === 'IN_PROGRESS');

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white">
        <Loader2 className="h-24 w-24 animate-spin" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-900 text-white p-8 text-center">
        <WifiOff className="h-32 w-32 text-red-500 mb-8" />
        <h1 className="text-5xl font-bold mb-4">No Tournament Active</h1>
        <p className="text-2xl text-gray-400">Please start a tournament in the admin dashboard to use the presenter view.</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-900 text-white font-sans flex flex-col">
      <header className="p-4 bg-black/20 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-2">
            <MonitorPlay/>
            <h1 className="text-xl font-bold">Presenter View</h1>
        </div>
        <div className="w-64">
          <Select onValueChange={setSelectedCourt} value={selectedCourt || ''}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Select a court to display" />
            </SelectTrigger>
            <SelectContent>
              {tournament.courtNames.map(court => (
                <SelectItem key={court.name} value={court.name}>
                  {court.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {liveMatch ? (
          <LiveMatchView match={liveMatch} tournament={tournament} />
        ) : (
          <HubView matches={matches} selectedCourt={selectedCourt} tournament={tournament} />
        )}
      </main>
    </div>
  );
}
