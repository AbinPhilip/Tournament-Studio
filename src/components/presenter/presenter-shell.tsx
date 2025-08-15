
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, Timestamp } from 'firebase/firestore';
import type { Match, Tournament, TeamType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MonitorPlay, WifiOff, Gamepad2, ListChecks } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { getRoundName } from '@/lib/utils';
import { EventBadge } from '../ui/event-badge';
import { Logo } from '../logo';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const WelcomeSlide = ({ tournament }: { tournament: Tournament | null }) => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gradient-to-br from-background to-slate-900/50 text-foreground">
        <m.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}>
            <Logo />
        </m.div>
        <m.h1 
            className="text-5xl md:text-7xl lg:text-8xl font-extrabold mt-8 text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-primary"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }}
        >
            {tournament?.location}
        </m.h1>
        <m.p 
            className="text-xl md:text-2xl lg:text-3xl text-muted-foreground mt-4"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6, duration: 0.5 }}
        >
            Welcome to the Tournament
        </m.p>
    </div>
);


const LiveMatchSlide = ({ match }: { match: Match }) => {
    const { team1Points = 0, team2Points = 0, servingTeamId } = match.live || {};
    const team1SetsWon = match.scores?.filter(s => s.team1 > s.team2).length || 0;
    const team2SetsWon = match.scores?.filter(s => s.team2 > s.team1).length || 0;

    const Score = ({ score }: { score: number }) => (
        <AnimatePresence mode="popLayout">
            <m.div
                key={score}
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 30, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="text-8xl md:text-9xl font-black"
            >
                {score}
            </m.div>
        </AnimatePresence>
    );

    const PlayerDisplay = ({ name, org, sets, isServing }: { name: string, org?: string, sets: number, isServing: boolean }) => (
         <div className={`p-4 rounded-xl transition-all duration-300 w-full text-center ${isServing ? 'bg-primary/10' : ''}`}>
             <h3 className="text-3xl md:text-5xl font-bold truncate" title={name}>{name}</h3>
             <p className="text-lg md:text-xl text-muted-foreground">{org}</p>
             <p className="text-lg md:text-xl text-muted-foreground mt-2">Games Won: {sets}</p>
             <div className="h-8 mt-2">
                 {isServing && <p className="font-bold text-primary animate-pulse text-lg tracking-widest">SERVING</p>}
             </div>
         </div>
    );

    return (
        <div className="h-full flex flex-col justify-between p-4 sm:p-6 md:p-8 bg-background rounded-2xl border">
            <header className="flex justify-between items-center text-muted-foreground">
                <EventBadge eventType={match.eventType} />
                <span className="font-bold text-xl md:text-2xl">Court: {match.courtName}</span>
                <span className="font-semibold text-lg md:text-xl">{getRoundName(match.round || 0, match.eventType, 0)}</span>
            </header>

            <main className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 py-4 text-center">
                <PlayerDisplay name={match.team1Name} org={match.team1OrgName} sets={team1SetsWon} isServing={servingTeamId === match.team1Id} />
                <div className="flex items-center justify-center gap-4 md:gap-8 my-4 md:my-0">
                     <Score score={team1Points} />
                    <span className="text-6xl font-light text-muted-foreground/50">-</span>
                    <Score score={team2Points} />
                </div>
                <PlayerDisplay name={match.team2Name} org={match.team2OrgName} sets={team2SetsWon} isServing={servingTeamId === match.team2Id} />
            </main>

            <footer/>
        </div>
    );
};

const UpcomingMatchesSlide = ({ matches, teamCounts }: { matches: Match[], teamCounts: Record<TeamType, number>}) => (
    <Card className="h-full flex flex-col bg-background/80 backdrop-blur-sm">
        <CardHeader className="text-center">
            <CardTitle className="text-4xl md:text-5xl font-bold flex items-center justify-center gap-4"><ListChecks /> Upcoming Matches</CardTitle>
            <CardDescription className="text-lg md:text-xl">Next on the schedule</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
                {matches.slice(0, 6).map(match => (
                    <div key={match.id} className="bg-muted/50 p-4 rounded-lg flex flex-col justify-center text-center">
                        <div className="flex justify-center mb-2"><EventBadge eventType={match.eventType}/></div>
                        <p className="font-semibold text-muted-foreground">{getRoundName(match.round || 0, match.eventType, teamCounts[match.eventType])}</p>
                        <p className="text-lg font-bold truncate">{match.team1Name}</p>
                        <p className="text-sm text-muted-foreground mb-1">{match.team1OrgName}</p>
                        <p className="font-bold text-primary">VS</p>
                        <p className="text-lg font-bold truncate">{match.team2Name}</p>
                        <p className="text-sm text-muted-foreground">{match.team2OrgName}</p>
                    </div>
                ))}
             </div>
        </CardContent>
    </Card>
);

export function PresenterShell() {
  const { toast } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teamCounts, setTeamCounts] = useState<Record<TeamType, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const matchesQuery = query(collection(db, 'matches'));
    const tournamentQuery = query(collection(db, 'tournaments'));
    const teamsQuery = query(collection(db, 'teams'));

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
    });

    const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
        const counts: Record<TeamType, number> = { singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0 };
        snapshot.forEach(doc => {
            const team = doc.data() as { type: TeamType };
            if (counts[team.type] !== undefined) {
                counts[team.type]++;
            }
        });
        setTeamCounts(counts);
    });


    return () => {
      unsubscribeMatches();
      unsubscribeTournament();
      unsubscribeTeams();
    };
  }, [toast]);

  const liveMatches = matches.filter(m => m.status === 'IN_PROGRESS').sort((a,b) => (a.courtName || '').localeCompare(b.courtName || ''));
  const upcomingMatches = matches.filter(m => m.status === 'SCHEDULED' && !m.live).sort((a, b) => (a.startTime as any) - (b.startTime as any));

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-24 w-24 animate-spin text-primary" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground p-8 text-center">
        <WifiOff className="h-32 w-32 text-destructive mb-8" />
        <h1 className="text-5xl font-bold mb-4">No Tournament Active</h1>
        <p className="text-2xl text-muted-foreground">Please start a tournament in the admin dashboard to use the presenter view.</p>
      </div>
    );
  }
  
  const hasSlides = liveMatches.length > 0 || upcomingMatches.length > 0;

  return (
    <div className="h-screen w-screen bg-muted font-sans flex flex-col p-4">
        { !hasSlides ? (
            <WelcomeSlide tournament={tournament} />
        ) : (
             <Carousel 
                className="h-full w-full"
                plugins={[Autoplay({ delay: 10000, stopOnInteraction: false })]}
                opts={{ loop: true }}
             >
                <CarouselContent className="h-full">
                    <CarouselItem>
                        <WelcomeSlide tournament={tournament} />
                    </CarouselItem>
                    
                    {liveMatches.map(match => (
                        <CarouselItem key={match.id}>
                            <LiveMatchSlide match={match} />
                        </CarouselItem>
                    ))}

                    {upcomingMatches.length > 0 && (
                        <CarouselItem>
                           <UpcomingMatchesSlide matches={upcomingMatches} teamCounts={teamCounts} />
                        </CarouselItem>
                    )}
                </CarouselContent>
            </Carousel>
        )}
    </div>
  );
}
