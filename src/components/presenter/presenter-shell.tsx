
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, Timestamp } from 'firebase/firestore';
import type { Match, Tournament, TeamType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MonitorPlay, WifiOff, ListChecks, Trophy } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { getRoundName } from '@/lib/utils';
import { EventBadge } from '../ui/event-badge';
import { Logo } from '../logo';

const WelcomeSlide = ({ tournament }: { tournament: Tournament | null }) => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 text-white">
        <m.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}>
            <Logo />
        </m.div>
        <m.h1 
            className="text-5xl md:text-7xl lg:text-8xl font-extrabold mt-8 tracking-tight"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }}
        >
            {tournament?.name || 'Welcome'}
        </m.h1>
        <m.p 
            className="text-xl md:text-2xl lg:text-3xl text-slate-300 mt-4"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6, duration: 0.5 }}
        >
            Hosted by: {tournament?.hostName}
        </m.p>
    </div>
);


const LiveMatchSlide = ({ match, teamCounts }: { match: Match, teamCounts: Record<TeamType, number> }) => {
    const { team1Points = 0, team2Points = 0, servingTeamId } = match.live || {};
    const team1SetsWon = match.scores?.filter(s => s.team1 > s.team2).length || 0;
    const team2SetsWon = match.scores?.filter(s => s.team2 > s.team1).length || 0;

    const Score = ({ score }: { score: number }) => (
        <AnimatePresence mode="popLayout">
            <m.div
                key={score}
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="text-7xl md:text-8xl lg:text-[10rem] font-black leading-none text-white"
            >
                {score}
            </m.div>
        </AnimatePresence>
    );

    const PlayerDisplay = ({ name, org, isServing }: { name: string, org?: string, isServing: boolean }) => (
         <div className={`p-4 rounded-xl transition-all duration-300 w-full text-center flex flex-col items-center justify-center ${isServing ? 'bg-white/10' : ''}`}>
            <div className="h-8 mb-2">
                 {isServing && <p className="font-bold text-yellow-300 animate-pulse text-lg md:text-xl tracking-widest">SERVING</p>}
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-white break-words" title={name}>{name}</h3>
            <p className="text-base md:text-lg text-slate-300 mt-2">{org}</p>
         </div>
    );
    
    const SetTracker = ({ setsWon }: { setsWon: number }) => (
        <div className="flex gap-2 justify-center">
            {Array.from({length: setsWon}).map((_, i) => (
                <div key={i} className="w-5 h-5 rounded-full bg-yellow-400" />
            ))}
             {Array.from({length: Math.max(0, 2 - setsWon)}).map((_, i) => (
                <div key={`empty-${i}`} className="w-5 h-5 rounded-full bg-white/20" />
            ))}
        </div>
    );

    return (
        <div className="h-full flex flex-col justify-between p-4 sm:p-6 md:p-8 bg-black/30 rounded-2xl border border-white/20">
            <header className="flex justify-between items-center text-slate-200">
                <EventBadge eventType={match.eventType} />
                <span className="font-bold text-xl md:text-3xl text-white">Court: {match.courtName}</span>
                <span className="font-semibold text-lg md:text-2xl">{getRoundName(match.round || 0, match.eventType, teamCounts[match.eventType] || 0)}</span>
            </header>

            <main className="flex-grow grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 py-4">
                <div className="flex flex-col items-center justify-between h-full gap-4">
                    <PlayerDisplay name={match.team1Name} org={match.team1OrgName} isServing={servingTeamId === match.team1Id} />
                    <SetTracker setsWon={team1SetsWon}/>
                </div>
                <div className="flex items-center justify-center gap-4 md:gap-8 my-4 md:my-0">
                     <Score score={team1Points} />
                    <span className="text-6xl md:text-8xl font-light text-white/50">-</span>
                    <Score score={team2Points} />
                </div>
                <div className="flex flex-col items-center justify-between h-full gap-4">
                    <PlayerDisplay name={match.team2Name} org={match.team2OrgName} isServing={servingTeamId === match.team2Id} />
                    <SetTracker setsWon={team2SetsWon}/>
                </div>
            </main>

            <footer/>
        </div>
    );
};

const AllFixturesSlide = ({ matches, teamCounts, page, totalPages }: { matches: Match[], teamCounts: Record<TeamType, number>, page: number, totalPages: number}) => (
    <div className="h-full flex flex-col bg-black/30 rounded-2xl border border-white/20 p-8">
        <header className="text-center mb-8">
            <h2 className="text-4xl md:text-5xl font-bold flex items-center justify-center gap-4 text-white"><ListChecks /> All Fixtures</h2>
            <p className="text-lg md:text-xl text-slate-300">Overview of all non-completed matches ({`Page ${page} of ${totalPages}`})</p>
        </header>
        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {matches.map(match => (
                <div key={match.id} className="bg-white/10 p-4 rounded-lg flex flex-col justify-center text-center text-white">
                    <div className="flex justify-between items-center w-full px-2 mb-2">
                      <EventBadge eventType={match.eventType}/>
                      <span className="font-semibold text-slate-200">{getRoundName(match.round || 0, match.eventType, teamCounts[match.eventType] || 0)}</span>
                    </div>
                    <p className="text-base font-bold truncate">{match.team1Name}</p>
                    <p className="text-xs text-slate-300 mb-1">{match.team1OrgName}</p>
                    <p className="font-bold text-yellow-400 my-1">VS</p>
                    <p className="text-base font-bold truncate">{match.team2Name}</p>
                    <p className="text-xs text-slate-300">{match.team2OrgName}</p>
                </div>
            ))}
        </div>
    </div>
);

const CompletedMatchSlide = ({ matches, teamCounts }: { matches: Match[], teamCounts: Record<TeamType, number>}) => (
    <div className="h-full flex flex-col bg-black/30 rounded-2xl border border-white/20 p-8 text-white">
        <header className="text-center mb-8">
            <h2 className="text-4xl md:text-5xl font-bold flex items-center justify-center gap-4 text-white"><Trophy /> Recent Results</h2>
            <p className="text-lg md:text-xl text-slate-300">Overview of the latest completed matches</p>
        </header>
        <div className="flex-grow overflow-y-auto">
            <div className="grid grid-cols-[1fr_1fr_2fr_2fr_1fr] gap-x-4 gap-y-2 text-lg text-left px-4 py-3 border-b-2 border-white/30 font-bold uppercase text-slate-300">
                <span>Event</span>
                <span>Round</span>
                <span>Winner</span>
                <span>Runner-up</span>
                <span className="text-center">Score</span>
            </div>
            <div className="space-y-2 mt-2">
                {matches.map(match => {
                    const winnerIsTeam1 = match.winnerId === match.team1Id;
                    const winnerName = winnerIsTeam1 ? match.team1Name : match.team2Name;
                    const winnerOrg = winnerIsTeam1 ? match.team1OrgName : match.team2OrgName;
                    const loserName = winnerIsTeam1 ? match.team2Name : match.team1Name;
                    const loserOrg = winnerIsTeam1 ? match.team2OrgName : match.team1OrgName;
                    
                    return (
                        <div key={match.id} className="grid grid-cols-[1fr_1fr_2fr_2fr_1fr] gap-x-4 items-center text-xl bg-white/5 p-3 rounded-lg">
                            <div><EventBadge eventType={match.eventType}/></div>
                            <div className="font-semibold text-slate-200">{getRoundName(match.round || 0, match.eventType, teamCounts[match.eventType] || 0)}</div>
                            <div className="truncate">
                                <p className="font-bold text-yellow-300 truncate">{winnerName}</p>
                                <p className="text-sm text-slate-400 truncate">{winnerOrg}</p>
                            </div>
                             <div className="truncate">
                                <p className="font-semibold text-slate-300 truncate">{loserName}</p>
                                <p className="text-sm text-slate-400 truncate">{loserOrg}</p>
                            </div>
                            <div className="text-center font-bold text-2xl">{match.score}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
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
      const matchesData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startTime: (data.startTime as Timestamp)?.toDate(),
          lastUpdateTime: (data.lastUpdateTime as Timestamp)?.toDate(),
        } as Match;
      });
      setMatches(matchesData);
    }, (error) => {
      console.error("Error fetching matches:", error);
      toast({ title: 'Error', description: 'Failed to fetch match data.', variant: 'destructive' });
    });

    const unsubscribeTournament = onSnapshot(tournamentQuery, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        const tourneyData = { id: snapshot.docs[0].id, ...docData } as Tournament;
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
  const allNonCompletedMatches = matches.filter(m => m.status !== 'COMPLETED').sort((a, b) => (a.startTime as any) - (b.startTime as any));
  
  const completedMatches = matches
    .filter(m => m.status === 'COMPLETED' && m.lastUpdateTime)
    .sort((a, b) => b.lastUpdateTime!.getTime() - a.lastUpdateTime!.getTime())
    .slice(0, 8);


  const chunkArray = <T,>(array: T[], size: number): T[][] => {
    const chunkedArr: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunkedArr.push(array.slice(i, i + size));
    }
    return chunkedArr;
  };
  
  const fixturePages = chunkArray(allNonCompletedMatches, 8);


  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white">
        <Loader2 className="h-24 w-24 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-900 text-white p-8 text-center">
        <WifiOff className="h-32 w-32 text-red-500 mb-8" />
        <h1 className="text-5xl font-bold mb-4">No Tournament Active</h1>
        <p className="text-2xl text-slate-300">Please start a tournament in the admin dashboard to use the presenter view.</p>
      </div>
    );
  }
  
  const hasSlides = liveMatches.length > 0 || allNonCompletedMatches.length > 0 || completedMatches.length > 0;

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-gray-900 to-blue-900/50 font-sans flex flex-col p-4 relative">
        { !hasSlides ? (
            <WelcomeSlide tournament={tournament} />
        ) : (
             <Carousel 
                className="h-full w-full"
                plugins={[Autoplay({ delay: 15000, stopOnInteraction: false })]}
                opts={{ loop: true }}
             >
                <CarouselContent className="h-full">
                    <CarouselItem>
                        <WelcomeSlide tournament={tournament} />
                    </CarouselItem>
                    
                    {liveMatches.map(match => (
                        <CarouselItem key={match.id}>
                            <LiveMatchSlide match={match} teamCounts={teamCounts}/>
                        </CarouselItem>
                    ))}

                    {fixturePages.map((page, index) => (
                         <CarouselItem key={`fixture-page-${index}`}>
                           <AllFixturesSlide matches={page} teamCounts={teamCounts} page={index+1} totalPages={fixturePages.length}/>
                        </CarouselItem>
                    ))}

                    {completedMatches.length > 0 && (
                         <CarouselItem>
                           <CompletedMatchSlide matches={completedMatches} teamCounts={teamCounts} />
                        </CarouselItem>
                    )}

                </CarouselContent>
            </Carousel>
        )}
    </div>
  );
}
