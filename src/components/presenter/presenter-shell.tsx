
"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, Timestamp, orderBy, limit } from 'firebase/firestore';
import type { Match, Tournament, Team, TeamType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, WifiOff, Trophy, Crown, Building, ImageIcon } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { getRoundName } from '@/lib/utils';
import { EventBadge } from '../ui/event-badge';
import { Logo } from '../logo';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '../ui/table';
import Image from 'next/image';

const LiveMatchSlide = ({ match, teamCounts }: { match: Match, teamCounts: Record<TeamType, number> }) => {
    const { team1Points = 0, team2Points = 0, servingTeamId } = match.live || {};
    const team1SetsWon = match.scores?.filter(s => s.team1 > s.team2).length || 0;
    const team2SetsWon = match.scores?.filter(s => s.team2 > s.team1).length || 0;

    const Score = ({ score }: { score: number }) => (
        <div className="relative w-32 h-32 md:w-48 md:h-48 flex items-center justify-center">
            <AnimatePresence mode="popLayout">
                <m.div
                    key={score}
                    initial={{ y: -40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 40, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="text-7xl md:text-8xl font-black leading-none text-white font-headline"
                    style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}
                >
                    {score}
                </m.div>
            </AnimatePresence>
        </div>
    );
    
    const PlayerDisplay = ({ name, org, isServing, setsWon }: { name: string, org?: string, isServing: boolean, setsWon: number }) => (
         <div className={cn("p-4 rounded-xl transition-all duration-300 w-full text-center flex flex-col items-center justify-center", isServing ? 'bg-white/10' : '')}>
            <div className="h-8 mb-2">
                 {isServing && <p className="font-bold text-yellow-300 animate-pulse text-lg md:text-xl tracking-widest font-headline" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>SERVING</p>}
            </div>
             <div className="flex items-center gap-4">
                 <h3 className="text-2xl md:text-4xl font-bold text-white break-words font-headline" title={name} style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{name}</h3>
                 <span className="text-4xl md:text-6xl font-bold text-yellow-400 font-headline" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{setsWon}</span>
             </div>
            <p className="text-base md:text-xl text-slate-200 mt-2" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>{org}</p>
         </div>
    );
    
    return (
        <m.div 
            className="h-full flex flex-col justify-between p-4 sm:p-6 md:p-8 bg-black/30 rounded-2xl border border-white/20"
            initial={{opacity: 0, scale: 0.95}}
            animate={{opacity: 1, scale: 1}}
            transition={{duration: 0.5}}
        >
            <header className="flex justify-between items-center text-slate-200" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>
                <EventBadge eventType={match.eventType} />
                <span className="font-bold text-xl md:text-3xl text-white font-headline">Court: {match.courtName}</span>
                <span className="font-semibold text-lg md:text-2xl">{getRoundName(match.round || 0, match.eventType, teamCounts[match.eventType] || 0)}</span>
            </header>

            <main className="flex-grow grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 py-4">
                <PlayerDisplay name={match.team1Name} org={match.team1OrgName} isServing={servingTeamId === match.team1Id} setsWon={team1SetsWon}/>
                <div className="flex items-center justify-center gap-2 md:gap-4 my-4 md:my-0">
                     <Score score={team1Points} />
                    <span className="text-6xl md:text-8xl font-light text-white/50 font-headline" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>-</span>
                    <Score score={team2Points} />
                </div>
                <PlayerDisplay name={match.team2Name} org={match.team2OrgName} isServing={servingTeamId === match.team2Id} setsWon={team2SetsWon}/>
            </main>

            <footer className="text-center text-slate-400">
               {match.scores && match.scores.length > 0 && (
                    <div className="flex justify-center items-center gap-4 text-lg" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>
                        <span className="font-semibold">Previous Sets:</span>
                        <div className="flex gap-3">
                        {match.scores.map((s, i) => (
                             <span key={i} className="font-mono bg-black/30 px-2 py-1 rounded-md text-white">{s.team1}-{s.team2}</span>
                        ))}
                        </div>
                    </div>
                )}
            </footer>
        </m.div>
    );
};


const FixtureSlide = ({ match, teamCounts }: { match: Match, teamCounts: Record<TeamType, number>}) => {
    return (
        <m.div
            className="h-full flex flex-col justify-between p-4 sm:p-6 md:p-8 bg-black/30 rounded-2xl border border-white/20"
            initial={{opacity: 0, scale: 0.95}}
            animate={{opacity: 1, scale: 1}}
            transition={{duration: 0.5}}
        >
            <header className="flex justify-between items-center text-slate-200" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>
                <EventBadge eventType={match.eventType} />
                <span className="font-bold text-xl md:text-3xl text-white font-headline">Court: {match.courtName}</span>
                 <span className="font-semibold text-lg md:text-2xl">{getRoundName(match.round || 0, match.eventType, teamCounts[match.eventType] || 0)}</span>
            </header>
            
            <main className="flex-grow flex flex-col items-center justify-center text-white text-center">
                 <div className="w-full" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
                    <h3 className="text-3xl md:text-5xl font-bold text-white break-words font-headline">{match.team1Name}</h3>
                    <p className="text-lg md:text-2xl text-slate-200 mt-2">{match.team1OrgName}</p>
                 </div>
                 <h4 className="text-4xl md:text-6xl font-bold text-yellow-300 my-8 font-headline" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>VS</h4>
                 <div className="w-full" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
                    <h3 className="text-3xl md:text-5xl font-bold text-white break-words font-headline">{match.team2Name}</h3>
                    <p className="text-lg md:text-2xl text-slate-200 mt-2">{match.team2OrgName}</p>
                 </div>
            </main>

            <footer className="text-center text-slate-400" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>
                Upcoming Match
            </footer>
        </m.div>
    )
}

const WelcomeSlide = ({ tournament }: { tournament: Tournament | null }) => (
    <m.div
        className="h-full flex flex-col justify-center items-center p-8 text-white text-center bg-black/30 rounded-2xl border border-white/20"
        initial={{opacity: 0, scale: 0.95}}
        animate={{opacity: 1, scale: 1}}
        transition={{duration: 0.5}}
    >
        <m.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}>
            {tournament?.logoUrl ? (
                <Image src={tournament.logoUrl} alt="Tournament Logo" width={128} height={128} className="object-contain h-32 w-32 rounded-full bg-white/10 p-2" />
            ) : (
                <Logo />
            )}
        </m.div>
        <m.h1 
            className="text-5xl md:text-7xl lg:text-8xl font-bold mt-8 tracking-tight font-headline"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }}
            style={{ textShadow: '3px 3px 10px rgba(0,0,0,0.7)' }}
        >
            {tournament?.name || 'Welcome'}
        </m.h1>
        <m.p 
            className="text-xl md:text-2xl lg:text-3xl text-slate-200 mt-4"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6, duration: 0.5 }}
            style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}
        >
            Hosted by: {tournament?.hostName}
        </m.p>
    </m.div>
);

const CompletedMatchesSlide = ({ matches, teamCounts }: { matches: Match[], teamCounts: Record<TeamType, number> }) => (
     <m.div
        className="h-full flex flex-col justify-center p-4 sm:p-6 md:p-8 bg-black/30 rounded-2xl border border-white/20"
        initial={{opacity: 0, scale: 0.95}}
        animate={{opacity: 1, scale: 1}}
        transition={{duration: 0.5}}
    >
        <header className="text-center mb-6" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
            <h2 className="text-4xl md:text-5xl font-bold text-white font-headline flex items-center justify-center gap-4">
                <Trophy className="text-yellow-400" />
                Recent Results
            </h2>
        </header>
        <main className="text-white" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>
            <Table className="text-lg">
                <TableHeader>
                    <TableRow className="border-white/20 hover:bg-transparent">
                        <TableHead className="text-white/80 font-headline text-xl">Event</TableHead>
                        <TableHead className="text-white/80 font-headline text-xl">Round</TableHead>
                        <TableHead className="text-white/80 font-headline text-xl">Winner</TableHead>
                        <TableHead className="text-white/80 font-headline text-xl">Runner-up</TableHead>
                        <TableHead className="text-center text-white/80 font-headline text-xl">Score</TableHead>
                        <TableHead className="text-center text-white/80 font-headline text-xl">Point Diff.</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                     {matches.map(match => {
                        const winnerIsTeam1 = match.winnerId === match.team1Id;
                        const winnerName = winnerIsTeam1 ? match.team1Name : match.team2Name;
                        const winnerOrg = winnerIsTeam1 ? match.team1OrgName : match.team2OrgName;
                        const loserName = winnerIsTeam1 ? match.team2Name : match.team1Name;
                        const loserOrg = winnerIsTeam1 ? match.team2OrgName : match.team1OrgName;
                        const diff = match.pointDifferential;
                        return (
                             <TableRow key={match.id} className="border-white/20 hover:bg-white/5">
                                <TableCell><EventBadge eventType={match.eventType} /></TableCell>
                                <TableCell>{getRoundName(match.round || 0, match.eventType, teamCounts[match.eventType] || 0)}</TableCell>
                                <TableCell>
                                    <p className="font-bold">{winnerName}</p>
                                    <p className="text-sm text-slate-300">{winnerOrg}</p>
                                </TableCell>
                                <TableCell>
                                     <p>{loserName}</p>
                                     <p className="text-sm text-slate-300">{loserOrg}</p>
                                </TableCell>
                                <TableCell className="text-center font-bold text-yellow-300 text-xl font-headline">{match.score}</TableCell>
                                <TableCell className="text-center font-bold text-green-400 text-xl font-headline">
                                    {diff !== undefined && diff > 0 ? `+${diff}` : ''}
                                </TableCell>
                            </TableRow>
                        )
                     })}
                </TableBody>
            </Table>
        </main>
     </m.div>
);

const WinnerSlide = ({ match }: { match: Match }) => {
    const winnerName = match.winnerId === match.team1Id ? match.team1Name : match.team2Name;
    const winnerOrg = match.winnerId === match.team1Id ? match.team1OrgName : match.team2OrgName;

    return (
        <m.div
            className="h-full flex flex-col justify-center items-center p-8 text-white text-center bg-black/30 rounded-2xl border-2 border-yellow-400"
            initial={{opacity: 0, scale: 0.9, y: 50}}
            animate={{opacity: 1, scale: 1, y: 0}}
            transition={{duration: 0.7, type: 'spring', stiffness: 100}}
        >
            <m.div initial={{scale: 0}} animate={{scale: 1, rotate: -15}} transition={{delay: 0.3, duration: 0.5}}>
                <Crown className="h-24 w-24 text-yellow-400" style={{ filter: 'drop-shadow(0 0 10px #facc15)' }} />
            </m.div>
            <m.h2 
                className="text-6xl md:text-8xl font-bold text-yellow-300 mt-4 tracking-wider font-headline"
                initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}} transition={{delay: 0.5}}
                 style={{ textShadow: '3px 3px 10px rgba(0,0,0,0.7)' }}
            >
                WINNER
            </m.h2>
            <m.div
                className="mt-8"
                initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}} transition={{delay: 0.7}}
                 style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}
            >
                <h3 className="text-4xl md:text-6xl font-bold text-white font-headline">{winnerName}</h3>
                <p className="text-2xl md:text-3xl text-slate-200 mt-2">{winnerOrg}</p>
            </m.div>
            <m.p 
                className="mt-6 text-3xl font-bold text-white bg-black/40 px-6 py-2 rounded-lg font-headline"
                initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}} transition={{delay: 0.9}}
                 style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}
            >
                Final Score: {match.score}
            </m.p>
             <footer className="text-slate-400 text-lg mt-8" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>
                From Court: {match.courtName}
            </footer>
        </m.div>
    );
};

const SponsorsSlide = ({ urls }: { urls: string[] }) => (
    <m.div
        className="h-full flex flex-col justify-center p-4 sm:p-6 md:p-8 bg-black/30 rounded-2xl border border-white/20"
        initial={{opacity: 0, scale: 0.95}}
        animate={{opacity: 1, scale: 1}}
        transition={{duration: 0.5}}
    >
        <header className="text-center mb-6" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
            <h2 className="text-4xl md:text-5xl font-bold text-white font-headline flex items-center justify-center gap-4">
                <Building className="text-blue-400" />
                Our Sponsors
            </h2>
        </header>
        <main className="flex-grow flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {urls.map((url, i) => (
                <m.div
                    key={i}
                    className="p-4 bg-white/90 rounded-xl shadow-lg"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 + i * 0.1, type: 'spring' }}
                >
                    <Image
                        src={url}
                        alt={`Sponsor ${i + 1}`}
                        width={200}
                        height={100}
                        className="object-contain h-24 w-48"
                    />
                </m.div>
            ))}
        </main>
    </m.div>
);

const EventImageSlide = ({ url }: { url: string }) => (
    <m.div
        className="h-full w-full bg-black/30 rounded-2xl border border-white/20 relative overflow-hidden"
        initial={{opacity: 0}}
        animate={{opacity: 1}}
        transition={{duration: 1}}
    >
        <Image
            src={url}
            alt="Event Image"
            layout="fill"
            objectFit="cover"
            className="z-0"
        />
         <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10"/>
         <header className="absolute top-4 left-4 z-20" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
            <h2 className="text-4xl md:text-5xl font-bold text-white font-headline flex items-center justify-center gap-4">
                <ImageIcon className="text-green-400" />
                Highlights
            </h2>
        </header>
    </m.div>
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
        const tourneyData = { 
            id: snapshot.docs[0].id, 
            ...docData, 
            date: (docData.date as Timestamp)?.toDate().toISOString() 
        } as Tournament;
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

  const slides = useMemo(() => {
    const now = Date.now();
    const liveMatches = matches.filter(m => m.status === 'IN_PROGRESS' && m.courtName).sort((a,b) => (a.courtName || '').localeCompare(b.courtName || ''));
    const scheduledFixtures = matches.filter(m => m.status === 'SCHEDULED' && m.courtName).sort((a, b) => (a.startTime as any) - (b.startTime as any));
    const allCompleted = matches.filter(m => m.status === 'COMPLETED' && m.winnerId).sort((a, b) => (b.lastUpdateTime?.getTime() || 0) - (a.lastUpdateTime?.getTime() || 0));
    
    // Show winner slide for matches completed in the last 5 minutes
    const recentWinners = allCompleted.filter(m => m.lastUpdateTime && (now - m.lastUpdateTime.getTime()) < 5 * 60 * 1000);
    const olderCompleted = allCompleted.slice(0, 8);
    
    const slideComponents = [];

    // 1. Welcome slide
    slideComponents.push(<CarouselItem key="welcome"><WelcomeSlide tournament={tournament} /></CarouselItem>);

    // 2. Recent Winner slides
    recentWinners.forEach(match => slideComponents.push(
        <CarouselItem key={`winner-${match.id}`}><WinnerSlide match={match} /></CarouselItem>
    ));

    // 3. Live matches
    liveMatches.forEach(match => slideComponents.push(
        <CarouselItem key={match.id}><LiveMatchSlide match={match} teamCounts={teamCounts}/></CarouselItem>
    ));
    
    // 4. Sponsor slide
    if (tournament?.sponsorUrls && tournament.sponsorUrls.length > 0) {
        slideComponents.push(<CarouselItem key="sponsors"><SponsorsSlide urls={tournament.sponsorUrls} /></CarouselItem>);
    }

    // 5. Scheduled fixtures
    scheduledFixtures.forEach(match => slideComponents.push(
        <CarouselItem key={match.id}><FixtureSlide match={match} teamCounts={teamCounts} /></CarouselItem>
    ));
    
    // 6. Completed matches table
    if (olderCompleted.length > 0) {
        slideComponents.push(<CarouselItem key="completed"><CompletedMatchesSlide matches={olderCompleted} teamCounts={teamCounts} /></CarouselItem>);
    }

    // 7. Event image slides
    if (tournament?.eventImageUrls && tournament.eventImageUrls.length > 0) {
        tournament.eventImageUrls.forEach((url, i) => {
            slideComponents.push(<CarouselItem key={`event-img-${i}`}><EventImageSlide url={url} /></CarouselItem>);
        });
    }
    
    return slideComponents;
  }, [matches, tournament, teamCounts]);
  
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
        <h1 className="text-5xl font-bold mb-4 font-headline">No Tournament Active</h1>
        <p className="text-2xl text-slate-300">Please start a tournament in the admin dashboard to use the presenter view.</p>
      </div>
    );
  }
  
  return (
    <div className="h-screen w-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-black to-black font-sans flex flex-col p-4 relative">
       {slides.length <= 1 ? ( // Only welcome slide exists
            <WelcomeSlide tournament={tournament} />
        ) : (
             <Carousel 
                className="h-full w-full"
                plugins={[Autoplay({ delay: 15000, stopOnInteraction: false })]}
                opts={{ loop: true }}
             >
                <CarouselContent className="h-full">
                    {slides}
                </CarouselContent>
            </Carousel>
        )}
    </div>
  );
}
