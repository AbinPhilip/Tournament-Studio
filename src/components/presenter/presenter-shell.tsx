
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, Timestamp, where } from 'firebase/firestore';
import type { Match, Tournament, TeamType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MonitorPlay, WifiOff, Gamepad2, ListChecks } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel"
import Autoplay from "embla-carousel-autoplay"
import { getRoundName } from '@/lib/utils';
import { EventBadge } from '../ui/event-badge';
import { Logo } from '../logo';


const WelcomeSlide = ({ tournament }: { tournament: Tournament | null }) => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gradient-to-br from-gray-900 to-gray-800">
        <m.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}>
            <Logo />
        </m.div>
        <m.h1 
            className="text-6xl md:text-8xl font-extrabold mt-6 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }}
        >
            {tournament?.location}
        </m.h1>
        <m.p 
            className="text-2xl md:text-3xl text-gray-300 mt-2"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6, duration: 0.5 }}
        >
            Welcome to the Tournament
        </m.p>
    </div>
);


const LiveMatchCard = ({ match }: { match: Match }) => {
    const { team1Points = 0, team2Points = 0, servingTeamId } = match.live || {};
    const team1SetsWon = match.scores?.filter(s => s.team1 > s.team2).length || 0;
    const team2SetsWon = match.scores?.filter(s => s.team2 > s.team1).length || 0;

    const Score = ({ score }: { score: number }) => (
        <AnimatePresence mode="popLayout">
            <m.div
                key={score}
                initial={{ y: -25, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 25, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="text-8xl md:text-9xl font-black text-white"
            >
                {score}
            </m.div>
        </AnimatePresence>
    );

    const PlayerDisplay = ({ name, sets, isServing }: { name: string, sets: number, isServing: boolean }) => (
         <div className={`p-4 rounded-xl transition-all duration-300 w-full text-center ${isServing ? 'bg-yellow-500/10' : ''}`}>
             <h3 className="text-3xl md:text-4xl font-bold truncate" title={name}>{name}</h3>
             <p className="text-xl md:text-2xl text-gray-400">Games Won: {sets}</p>
             <div className="h-6 mt-2">
                 {isServing && <p className="font-bold text-yellow-400 animate-pulse text-lg">SERVING</p>}
             </div>
         </div>
    );

    return (
        <div className="h-full flex flex-col justify-between p-6 bg-gray-800/50 rounded-2xl border border-gray-700">
            <header className="flex justify-between items-center text-gray-300">
                <EventBadge eventType={match.eventType} />
                <span className="font-bold text-xl">Court: {match.courtName}</span>
                <span className="font-semibold">{getRoundName(match.round || 0, match.eventType, 0)}</span>
            </header>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-4">
                <PlayerDisplay name={match.team1Name} sets={team1SetsWon} isServing={servingTeamId === match.team1Id} />
                <div className="flex items-center gap-4">
                     <Score score={team1Points} />
                    <span className="text-5xl font-light text-gray-600">-</span>
                    <Score score={team2Points} />
                </div>
                <PlayerDisplay name={match.team2Name} sets={team2SetsWon} isServing={servingTeamId === match.team2Id} />
            </div>

            <footer/>
        </div>
    );
};

const UpcomingMatchCard = ({ match }: { match: Match }) => (
    <div className="flex flex-col items-center justify-center h-full p-4 bg-gray-800/30 rounded-lg">
        <EventBadge eventType={match.eventType} className="mb-2" />
        <p className="font-bold text-lg mb-2">{getRoundName(match.round || 0, match.eventType, 0)}</p>
        <div className="text-center">
            <p className="font-semibold text-xl truncate">{match.team1Name}</p>
            <p className="text-sm text-gray-400">{match.team1OrgName}</p>
        </div>
        <p className="text-gray-500 font-bold my-1">vs</p>
        <div className="text-center">
            <p className="font-semibold text-xl truncate">{match.team2Name}</p>
            <p className="text-sm text-gray-400">{match.team2OrgName}</p>
        </div>
    </div>
)


export function PresenterShell() {
  const { toast } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const matchesQuery = query(collection(db, 'matches'));
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
  }, [toast]);

  const liveMatches = matches.filter(m => m.status === 'IN_PROGRESS').sort((a,b) => (a.courtName || '').localeCompare(b.courtName || ''));
  const upcomingMatches = matches.filter(m => m.status === 'PENDING').sort((a,b) => (a.round || 0) - (b.round || 0));

  const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType, title: string }) => (
    <div className="flex items-center gap-3 mb-4 px-4">
        <Icon className="h-8 w-8 text-yellow-400" />
        <h2 className="text-3xl font-bold text-gray-200">{title}</h2>
    </div>
  );

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
    <div className="h-screen w-screen bg-gray-900 text-white font-sans flex flex-col p-4 gap-4">
        <div className="flex-[3] min-h-0">
            <SectionHeader icon={Gamepad2} title="Live Matches" />
             <div className="h-[calc(100%-48px)]">
                {liveMatches.length > 0 ? (
                     <Carousel 
                        className="h-full"
                        plugins={[Autoplay({ delay: 10000, stopOnInteraction: false })]}
                        opts={{ loop: true }}
                     >
                        <CarouselContent className="h-full">
                            {liveMatches.map(match => (
                                <CarouselItem key={match.id}>
                                    <LiveMatchCard match={match} />
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                    </Carousel>
                ) : (
                    <div className="h-full flex items-center justify-center bg-gray-800/30 rounded-2xl">
                        <p className="text-2xl text-gray-400">No matches are currently live.</p>
                    </div>
                )}
            </div>
        </div>
        <div className="flex-[1] min-h-0">
            <SectionHeader icon={ListChecks} title="Upcoming Matches" />
             <div className="h-[calc(100%-48px)]">
                 {upcomingMatches.length > 0 ? (
                     <Carousel 
                        className="h-full"
                        plugins={[Autoplay({ delay: 5000, stopOnInteraction: false })]}
                        opts={{ loop: true, slidesToScroll: 'auto' }}
                     >
                        <CarouselContent className="h-full">
                             {upcomingMatches.map(match => (
                                <CarouselItem key={match.id} className="basis-1/3 md:basis-1/4 lg:basis-1/5">
                                    <UpcomingMatchCard match={match} />
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                    </Carousel>
                 ) : (
                    <div className="h-full flex items-center justify-center bg-gray-800/30 rounded-lg">
                        <p className="text-xl text-gray-400">No more pending matches.</p>
                    </div>
                 )}
            </div>
        </div>
    </div>
  );
}
