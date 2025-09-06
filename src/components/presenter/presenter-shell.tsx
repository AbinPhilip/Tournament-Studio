

"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, Timestamp, orderBy, limit } from 'firebase/firestore';
import type { Match, Tournament, Team, TeamType, Sponsor } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { WifiOff, Trophy, Crown, Ticket, HeartHandshake, Clock, Calendar, MapPin } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { getRoundName } from '@/lib/utils';
import { EventBadge } from '../ui/event-badge';
import { Logo } from '../logo';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '../ui/table';
import Image from 'next/image';
import { LoadingShuttlecock } from '../ui/loading-shuttlecock';
import { format } from 'date-fns';

const LiveMatchSlide = ({ match, teamCounts }: { match: Match, teamCounts: Record<TeamType, number> }) => {
    const { team1Points = 0, team2Points = 0, servingTeamId } = match.live || {};
    const team1SetsWon = match.scores?.filter(s => s.team1 > s.team2).length || 0;
    const team2SetsWon = match.scores?.filter(s => s.team2 > s.team1).length || 0;

    const Score = ({ score }: { score: number }) => (
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-48 md:h-48 flex items-center justify-center">
            <AnimatePresence mode="popLayout">
                <m.div
                    key={score}
                    initial={{ y: -40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 40, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="text-6xl sm:text-7xl md:text-8xl font-black leading-none text-white font-headline"
                    style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}
                >
                    {score}
                </m.div>
            </AnimatePresence>
        </div>
    );
    
    const PlayerDisplay = ({ name, org, isServing, setsWon }: { name: string, org?: string, isServing: boolean, setsWon: number }) => (
         <div className={cn("p-2 sm:p-4 rounded-xl transition-all duration-300 w-full text-center flex flex-col items-center justify-center", isServing ? 'bg-white/10' : '')}>
            <div className="h-6 sm:h-8 mb-2">
                 {isServing && <p className="font-bold text-base sm:text-lg md:text-xl tracking-widest text-yellow-300 animate-pulse font-headline" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>SERVING</p>}
            </div>
             <div className="flex items-center gap-2 sm:gap-4">
                 <h3 className="text-xl sm:text-2xl md:text-4xl font-bold text-white break-words font-headline" title={name} style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{name}</h3>
                 <span className="text-3xl sm:text-4xl md:text-6xl font-bold text-yellow-400 font-headline" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{setsWon}</span>
             </div>
            <p className="text-sm sm:text-base md:text-xl text-slate-200 mt-1 sm:mt-2" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>{org}</p>
         </div>
    );
    
    return (
        <m.div 
            className="h-full flex flex-col justify-between p-4 sm:p-6 md:p-8 bg-black/30 rounded-2xl border border-white/20"
            initial={{opacity: 0, scale: 0.95}}
            animate={{opacity: 1, scale: 1}}
            transition={{duration: 0.5}}
        >
            <header className="flex justify-between items-center text-slate-200 flex-wrap gap-2" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>
                <EventBadge eventType={match.eventType} />
                <span className="font-bold text-lg sm:text-xl md:text-3xl text-white font-headline">Court: {match.courtName}</span>
                <span className="font-semibold text-base sm:text-lg md:text-2xl">{getRoundName(match.round || 0, match.eventType, teamCounts[match.eventType] || 0)}</span>
            </header>

            <main className="flex-grow grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 py-4">
                <PlayerDisplay name={match.team1Name} org={match.team1OrgName} isServing={servingTeamId === match.team1Id} setsWon={team1SetsWon}/>
                <div className="flex items-center justify-center gap-1 sm:gap-2 md:gap-4 my-2 sm:my-4 md:my-0">
                     <Score score={team1Points} />
                    <span className="text-5xl sm:text-6xl md:text-8xl font-light text-white/50 font-headline" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>-</span>
                    <Score score={team2Points} />
                </div>
                <PlayerDisplay name={match.team2Name} org={match.team2OrgName} isServing={servingTeamId === match.team2Id} setsWon={team2SetsWon}/>
            </main>

            <footer className="text-center text-slate-400">
               {match.scores && match.scores.length > 0 && (
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4 text-sm sm:text-lg" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>
                        <span className="font-semibold">Previous Sets:</span>
                        <div className="flex gap-2 sm:gap-3 flex-wrap justify-center">
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
            <header className="flex justify-between items-center text-slate-200 flex-wrap gap-2" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>
                <EventBadge eventType={match.eventType} />
                <span className="font-bold text-lg sm:text-xl md:text-3xl text-white font-headline">Court: {match.courtName}</span>
                 <span className="font-semibold text-base sm:text-lg md:text-2xl">{getRoundName(match.round || 0, match.eventType, teamCounts[match.eventType] || 0)}</span>
            </header>
            
            <main className="flex-grow flex flex-col items-center justify-center text-white text-center">
                 <div className="w-full" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
                    <h3 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white break-words font-headline">{match.team1Name}</h3>
                    <p className="text-base sm:text-lg md:text-2xl text-slate-200 mt-2">{match.team1OrgName}</p>
                 </div>
                 <h4 className="text-3xl sm:text-4xl md:text-6xl font-bold text-yellow-300 my-4 sm:my-8 font-headline" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>VS</h4>
                 <div className="w-full" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
                    <h3 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white break-words font-headline">{match.team2Name}</h3>
                    <p className="text-base sm:text-lg md:text-2xl text-slate-200 mt-2">{match.team2OrgName}</p>
                 </div>
            </main>

            <footer className="text-center text-slate-400" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>
                Upcoming Match
            </footer>
        </m.div>
    )
}

const UnassignedFixtureSlide = ({ matches, teamCounts }: { matches: Match[], teamCounts: Record<TeamType, number>}) => {
    return (
        <m.div
            className="h-full flex flex-col p-4 sm:p-6 md:p-8 bg-black/30 rounded-2xl border border-white/20"
            initial={{opacity: 0, scale: 0.95}}
            animate={{opacity: 1, scale: 1}}
            transition={{duration: 0.5}}
        >
            <header className="text-center mb-4 sm:mb-6">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white font-headline" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
                    Upcoming Unassigned Matches
                </h2>
            </header>
            
            <main className="flex-grow grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 text-white text-center overflow-y-auto">
                {matches.map(match => (
                    <div key={match.id} className="flex flex-col justify-center">
                        <EventBadge eventType={match.eventType} className="mb-2 mx-auto" />
                         <div className="w-full" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>
                            <h3 className="text-lg sm:text-xl font-bold text-white break-words font-headline">{match.team1Name}</h3>
                            <p className="text-sm text-slate-200">{match.team1OrgName}</p>
                         </div>
                         <h4 className="text-lg sm:text-xl font-bold text-yellow-300 my-2 font-headline" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>VS</h4>
                         <div className="w-full" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>
                            <h3 className="text-lg sm:text-xl font-bold text-white break-words font-headline">{match.team2Name}</h3>
                            <p className="text-sm text-slate-200">{match.team2OrgName}</p>
                         </div>
                    </div>
                ))}
            </main>
        </m.div>
    )
}


const WelcomeSlide = ({ tournament }: { tournament: Tournament | null }) => (
    <m.div
        className="h-full flex flex-col justify-center items-center p-4 sm:p-8 text-white text-center bg-black/30 rounded-2xl border border-white/20"
        initial={{opacity: 0, scale: 0.95}}
        animate={{opacity: 1, scale: 1}}
        transition={{duration: 0.5}}
    >
        <m.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}>
            {tournament?.logoUrl ? (
                <Image 
                    src={tournament.logoUrl} 
                    alt={tournament.name} 
                    width={200}
                    height={200}
                    className="object-contain h-32 sm:h-48 w-auto mb-4"
                    style={{ filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.3))' }}
                />
            ) : (
                 <Logo />
            )}
        </m.div>
        <m.h1 
            className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold mt-8 tracking-tight font-headline"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }}
            style={{ textShadow: '3px 3px 10px rgba(0,0,0,0.7)' }}
        >
            {tournament?.name || 'Welcome'}
        </m.h1>
        <m.p 
            className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-slate-200 mt-4"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6, duration: 0.5 }}
            style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}
        >
            Hosted by: {tournament?.hostName}
        </m.p>
        {tournament && (
             <m.div 
                className="mt-8 flex flex-col md:flex-row gap-4 md:gap-8 text-lg md:text-2xl text-slate-300"
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8, duration: 0.5 }}
                style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}
            >
                <div className="flex items-center gap-2">
                    <MapPin />
                    <span>{tournament.location}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar />
                    <span>{format(tournament.date, "PPP")}</span>
                </div>
            </m.div>
        )}
    </m.div>
);

const CompletedMatchesSlide = ({ matches, teamCounts }: { matches: Match[], teamCounts: Record<TeamType, number> }) => (
     <m.div
        className="h-full flex flex-col justify-center p-4 sm:p-6 md:p-8 bg-black/30 rounded-2xl border border-white/20"
        initial={{opacity: 0, scale: 0.95}}
        animate={{opacity: 1, scale: 1}}
        transition={{duration: 0.5}}
    >
        <header className="text-center mb-4 sm:mb-6" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white font-headline flex items-center justify-center gap-4">
                <Trophy className="text-yellow-400" />
                Recent Results
            </h2>
        </header>
        <main className="text-white overflow-y-auto" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>
            <Table className="text-sm sm:text-lg">
                <TableHeader>
                    <TableRow className="border-white/20 hover:bg-transparent">
                        <TableHead className="text-white/80 font-headline text-base sm:text-xl">Event</TableHead>
                        <TableHead className="text-white/80 font-headline text-base sm:text-xl hidden md:table-cell">Round</TableHead>
                        <TableHead className="text-white/80 font-headline text-base sm:text-xl">Winner</TableHead>
                        <TableHead className="text-center text-white/80 font-headline text-base sm:text-xl">Score</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                     {matches.map(match => {
                        const winnerIsTeam1 = match.winnerId === match.team1Id;
                        const winnerName = winnerIsTeam1 ? match.team1Name : match.team2Name;
                        return (
                             <TableRow key={match.id} className="border-white/20 hover:bg-white/5">
                                <TableCell><EventBadge eventType={match.eventType} /></TableCell>
                                <TableCell className="hidden md:table-cell">{getRoundName(match.round || 0, match.eventType, teamCounts[match.eventType] || 0)}</TableCell>
                                <TableCell>
                                    <p className="font-bold">{winnerName}</p>
                                </TableCell>
                                <TableCell className="text-center font-bold text-yellow-300 text-lg sm:text-xl font-headline">{match.score}</TableCell>
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
            className="h-full flex flex-col justify-center items-center p-4 sm:p-8 text-white text-center bg-black/30 rounded-2xl border-2 border-yellow-400"
            initial={{opacity: 0, scale: 0.9, y: 50}}
            animate={{opacity: 1, scale: 1, y: 0}}
            transition={{duration: 0.7, type: 'spring', stiffness: 100}}
        >
            <m.div initial={{scale: 0}} animate={{scale: 1, rotate: -15}} transition={{delay: 0.3, duration: 0.5}}>
                <Crown className="h-16 w-16 sm:h-24 sm:w-24 text-yellow-400" style={{ filter: 'drop-shadow(0 0 10px #facc15)' }} />
            </m.div>
            <m.h2 
                className="text-4xl sm:text-6xl md:text-8xl font-bold text-yellow-300 mt-4 tracking-wider font-headline"
                initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}} transition={{delay: 0.5}}
                 style={{ textShadow: '3px 3px 10px rgba(0,0,0,0.7)' }}
            >
                WINNER
            </m.h2>
            <m.div
                className="mt-4 sm:mt-8"
                initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}} transition={{delay: 0.7}}
                 style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}
            >
                <h3 className="text-2xl sm:text-4xl md:text-6xl font-bold text-white font-headline">{winnerName}</h3>
                <p className="text-lg sm:text-2xl md:text-3xl text-slate-200 mt-2">{winnerOrg}</p>
            </m.div>
            <m.p 
                className="mt-4 sm:mt-6 text-xl sm:text-3xl font-bold text-white bg-black/40 px-4 py-1 sm:px-6 sm:py-2 rounded-lg font-headline"
                initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}} transition={{delay: 0.9}}
                 style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}
            >
                Final Score: {match.score}
            </m.p>
             <footer className="text-slate-400 text-base sm:text-lg mt-4 sm:mt-8" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>
                From Court: {match.courtName}
            </footer>
        </m.div>
    );
};

const LotteryDrawSlide = ({ teams, eventType }: { teams: Team[], eventType: TeamType }) => {
    return (
        <m.div
            className="h-full flex flex-col p-4 sm:p-6 md:p-8 bg-black/30 rounded-2xl border border-white/20"
            initial={{opacity: 0, scale: 0.95}}
            animate={{opacity: 1, scale: 1}}
            transition={{duration: 0.5}}
        >
            <header className="text-center mb-4 sm:mb-6" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white font-headline flex items-center justify-center gap-4">
                    <Ticket className="text-yellow-400" />
                    Lottery Draw Results
                </h2>
                <EventBadge eventType={eventType} className="mt-4 text-xl sm:text-2xl px-4 sm:px-6 py-2" />
            </header>
            <main className="text-white flex-grow overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="border-white/20 hover:bg-transparent">
                            <TableHead className="text-white/80 font-headline text-base sm:text-xl w-1/6">Lot #</TableHead>
                            <TableHead className="text-white/80 font-headline text-base sm:text-xl w-3/6">Team</TableHead>
                            <TableHead className="text-white/80 font-headline text-base sm:text-xl w-2/6">Organization</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {teams.map(team => (
                            <TableRow key={team.id} className="border-white/20 hover:bg-white/5">
                                <TableCell className="font-black text-2xl sm:text-3xl text-yellow-300 font-headline">{team.lotNumber}</TableCell>
                                <TableCell className="font-bold text-lg sm:text-xl">{team.player1Name}{team.player2Name && ` & ${team.player2Name}`}</TableCell>
                                <TableCell className="text-sm sm:text-base text-slate-300">{team.organizationId}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </main>
        </m.div>
    );
};

const SponsorsSlide = ({ sponsors }: { sponsors: Sponsor[] }) => {
    if (sponsors.length === 0) return null;

    return (
        <m.div
            className="h-full flex flex-col justify-center p-4 sm:p-6 md:p-8 bg-black/30 rounded-2xl border border-white/20"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
        >
            <header className="text-center mb-6 sm:mb-10" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white font-headline flex items-center justify-center gap-4">
                    <HeartHandshake className="text-pink-400" />
                    Our Valued Sponsors
                </h2>
            </header>
            <main className="flex-grow flex items-center justify-center">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-8 sm:gap-x-16 gap-y-6 sm:gap-y-10">
                    {sponsors.map(sponsor => (
                        <div key={sponsor.id} className="flex flex-col items-center justify-center gap-4">
                            {sponsor.logoUrl ? (
                                <Image 
                                    src={sponsor.logoUrl} 
                                    alt={sponsor.name} 
                                    width={200} 
                                    height={120} 
                                    className="object-contain h-24 sm:h-32 w-auto" 
                                    style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.7))' }}
                                />
                            ) : (
                                <div className="h-24 sm:h-32 flex items-center justify-center">
                                    <p className="text-2xl sm:text-3xl font-bold text-white text-center font-headline" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>
                                        {sponsor.name}
                                    </p>
                                </div>
                            )}
                             <p className="text-lg sm:text-xl font-bold text-white text-center font-headline" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}>
                                {sponsor.name}
                            </p>
                        </div>
                    ))}
                </div>
            </main>
        </m.div>
    );
};


const CountdownSlide = ({ tournament }: { tournament: Tournament }) => {
    const [timeLeft, setTimeLeft] = useState(tournament.date.getTime() - Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            const newTimeLeft = tournament.date.getTime() - Date.now();
            if (newTimeLeft <= 0) {
                setTimeLeft(0);
                clearInterval(interval);
            } else {
                setTimeLeft(newTimeLeft);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [tournament.date]);
    
    const TimeBox = ({ value, label }: { value: number, label: string }) => (
        <div className="flex flex-col items-center justify-center bg-white/10 p-2 rounded-lg w-20 h-20 sm:w-32 sm:h-32 md:w-40 md:h-40 sm:p-4 md:rounded-2xl">
            <span className="text-3xl sm:text-5xl md:text-6xl font-black text-white font-headline" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{value.toString().padStart(2, '0')}</span>
            <span className="text-xs sm:text-base md:text-lg text-slate-300 font-headline mt-1">{label}</span>
        </div>
    );

    if (timeLeft <= 0) return null;

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    return (
        <m.div
            className="h-full flex flex-col justify-center items-center p-4 sm:p-8 text-white text-center bg-black/30 rounded-2xl border border-white/20"
            initial={{opacity: 0, scale: 0.95}}
            animate={{opacity: 1, scale: 1}}
            transition={{duration: 0.5}}
        >
            <header className="text-center mb-6 sm:mb-10" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white font-headline flex items-center justify-center gap-2 sm:gap-4">
                    <Clock className="h-8 w-8 sm:h-10 sm:w-10 text-yellow-400" />
                    Tournament Countdown
                </h2>
            </header>
            <main className="flex items-center justify-center gap-2 sm:gap-4 md:gap-8">
                <TimeBox value={days} label="Days" />
                <TimeBox value={hours} label="Hours" />
                <TimeBox value={minutes} label="Minutes" />
                <TimeBox value={seconds} label="Seconds" />
            </main>
        </m.div>
    );
};


export function PresenterShell() {
  const { toast } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teamCounts, setTeamCounts] = useState<Record<TeamType, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [api, setApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  const autoplayPlugin = useMemo(() => Autoplay({ delay: 15000, stopOnInteraction: false }), []);


  useEffect(() => {
    const matchesQuery = query(collection(db, 'matches'));
    const tournamentQuery = query(collection(db, 'tournaments'));
    const teamsQuery = query(collection(db, 'teams'));
    const orgsQuery = query(collection(db, 'organizations'));
    const sponsorsQuery = query(collection(db, 'sponsors'), orderBy('name'));

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
            date: (docData.date as Timestamp)?.toDate(),
        } as Tournament;
        setTournament(tourneyData);
      } else {
        setTournament(null);
      }
      setIsLoading(false);
    });

    const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
        const teamData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
        setTeams(teamData);
        const counts: Record<TeamType, number> = { singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0 };
        teamData.forEach(team => {
            if (counts[team.type] !== undefined) counts[team.type]++;
        });
        setTeamCounts(counts);
    });
    
    const unsubscribeOrgs = onSnapshot(orgsQuery, (snapshot) => {
        const orgData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));
        setOrganizations(orgData);
    });

    const unsubscribeSponsors = onSnapshot(sponsorsQuery, (snapshot) => {
        const sponsorData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sponsor));
        setSponsors(sponsorData);
    });


    return () => {
      unsubscribeMatches();
      unsubscribeTournament();
      unsubscribeTeams();
      unsubscribeOrgs();
      unsubscribeSponsors();
    };
  }, [toast]);
  

  const slides = useMemo(() => {
    const now = Date.now();
    const slideComponents = [];

    slideComponents.push({ key: "welcome", component: <WelcomeSlide tournament={tournament} /> });

    if (tournament?.status === 'PENDING') {
        if (tournament.date && tournament.date.getTime() > now) {
            slideComponents.push({ key: "countdown", component: <CountdownSlide tournament={tournament} /> });
        }

        const orgMap = new Map(organizations.map(o => [o.id, o.name]));
        const teamsWithLots = teams
            .filter(t => t.lotNumber)
            .map(t => ({...t, organizationId: orgMap.get(t.organizationId) || t.organizationId }));
        
        const teamsByEvent = teamsWithLots.reduce((acc, team) => {
            if (!acc[team.type]) acc[team.type] = [];
            acc[team.type].push(team);
            return acc;
        }, {} as Record<TeamType, Team[]>);

        const LOTTERY_CHUNK_SIZE = 8;
        const eventOrder: TeamType[] = ['mens_doubles', 'womens_doubles', 'mixed_doubles', 'singles'];

        for (const eventType of eventOrder) {
            if (teamsByEvent[eventType]) {
                const eventTeams = teamsByEvent[eventType].sort((a,b) => (a.lotNumber || 0) - (b.lotNumber || 0));
                for (let i = 0; i < eventTeams.length; i += LOTTERY_CHUNK_SIZE) {
                    const chunk = eventTeams.slice(i, i + LOTTERY_CHUNK_SIZE);
                    slideComponents.push({
                        key: `lottery-${eventType}-${i}`,
                        component: <LotteryDrawSlide teams={chunk} eventType={eventType} />
                    });
                }
            }
        }
    }
    
    if (sponsors && sponsors.length > 0) {
        const SPONSOR_CHUNK_SIZE = 10;
        for (let i = 0; i < sponsors.length; i += SPONSOR_CHUNK_SIZE) {
            const chunk = sponsors.slice(i, i + SPONSOR_CHUNK_SIZE);
            slideComponents.push({
                key: `sponsor-chunk-${i}`,
                component: <SponsorsSlide sponsors={chunk} />
            });
        }
    }


    if (tournament?.status === 'IN_PROGRESS' || tournament?.status === 'COMPLETED') {
        const liveMatches = matches.filter(m => m.status === 'IN_PROGRESS' && m.courtName).sort((a,b) => (a.courtName || '').localeCompare(b.courtName || ''));
        const scheduledFixtures = matches.filter(m => m.status === 'SCHEDULED' && m.courtName).sort((a, b) => (a.startTime as any) - (b.startTime as any));
        const unassignedFixtures = matches.filter(m => m.status === 'PENDING').sort((a, b) => (a.round || 0) - (b.round || 0));
        
        const allCompleted = matches.filter(m => m.status === 'COMPLETED' && m.winnerId && m.team2Id !== 'BYE').sort((a, b) => (b.lastUpdateTime?.getTime() || 0) - (a.lastUpdateTime?.getTime() || 0));
        const recentWinners = allCompleted.filter(m => m.lastUpdateTime && (now - m.lastUpdateTime.getTime()) < 5 * 60 * 1000);
        
        const COMPLETED_CHUNK_SIZE = 5;
        const olderCompletedChunks = [];
        const olderCompleted = allCompleted.filter(m => !recentWinners.find(rw => rw.id === m.id));
        for (let i = 0; i < olderCompleted.length; i += COMPLETED_CHUNK_SIZE) {
            olderCompletedChunks.push(olderCompleted.slice(i, i + COMPLETED_CHUNK_SIZE));
        }

        const UNASSIGNED_CHUNK_SIZE = 6;
        for (let i = 0; i < unassignedFixtures.length; i += UNASSIGNED_CHUNK_SIZE) {
            const chunk = unassignedFixtures.slice(i, i + UNASSIGNED_CHUNK_SIZE);
            slideComponents.push({
                key: `unassigned-chunk-${i}`,
                component: <UnassignedFixtureSlide matches={chunk} teamCounts={teamCounts} />
            });
        }

        recentWinners.forEach(match => slideComponents.push({
            key: `winner-${match.id}`,
            component: <WinnerSlide match={match} />
        }));

        liveMatches.forEach(match => slideComponents.push({
            key: `live-${match.id}`,
            component: <LiveMatchSlide match={match} teamCounts={teamCounts}/>
        }));
        
        scheduledFixtures.forEach(match => slideComponents.push({
            key: `fixture-${match.id}`,
            component: <FixtureSlide match={match} teamCounts={teamCounts} />
        }));
        
        olderCompletedChunks.forEach((chunk, index) => {
            if (chunk.length > 0) {
                 slideComponents.push({
                    key: `completed-chunk-${index}`,
                    component: <CompletedMatchesSlide matches={chunk} teamCounts={teamCounts} />
                 });
            }
        });
    }
    
    if (slideComponents.length <= 1) {
        return [{ key: "welcome", component: <WelcomeSlide tournament={tournament} /> }];
    }

    return slideComponents;
  }, [matches, tournament, teams, organizations, teamCounts, sponsors]);

   useEffect(() => {
    if (!api) return;
    api.reInit();
   }, [slides, api]);


  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white">
        <div className="animate-spin h-16 w-16 border-4 border-primary border-t-transparent rounded-full" />
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
    <div className="h-screen w-screen animated-gradient-background font-sans flex flex-col p-4 relative">
       {slides.length <= 1 && slides[0]?.key === 'welcome' ? (
            <WelcomeSlide tournament={tournament} />
        ) : (
             <Carousel 
                setApi={setApi}
                className="h-full w-full"
                plugins={[autoplayPlugin]}
                opts={{ loop: true }}
             >
                <CarouselContent className="h-full">
                    {slides.map(slide => (
                        <CarouselItem key={slide.key}>
                            {slide.component}
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>
        )}
    </div>
  );
}
