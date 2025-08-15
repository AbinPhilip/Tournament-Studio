
"use client";

import { useState, useEffect } from 'react';
import type { Match, Tournament } from '@/types';
import { AnimatePresence, m } from 'framer-motion';
import { getRoundName } from '@/lib/utils';
import { Logo } from '../logo';
import { EventBadge } from '../ui/event-badge';

const SlideWrapper = ({ children, keyId }: { children: React.ReactNode; keyId: string }) => (
  <AnimatePresence>
    <m.div
      key={keyId}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 flex flex-col items-center justify-center text-center p-8"
    >
      {children}
    </m.div>
  </AnimatePresence>
);

const UpcomingMatch = ({ match }: { match: Match }) => (
    <>
        <h2 className="text-5xl font-light text-gray-400 mb-4">Coming Up Next on {match.courtName}</h2>
        <div className="grid grid-cols-2 gap-8 items-center w-full max-w-4xl">
            <div className="flex flex-col items-center">
                 <h3 className="text-6xl font-bold mb-2">{match.team1Name}</h3>
                 <p className="text-3xl text-gray-300">{match.team1OrgName}</p>
            </div>
             <div className="flex flex-col items-center">
                 <h3 className="text-6xl font-bold mb-2">{match.team2Name}</h3>
                 <p className="text-3xl text-gray-300">{match.team2OrgName}</p>
            </div>
        </div>
        <div className="mt-8">
            <EventBadge eventType={match.eventType} className="text-2xl px-6 py-2" />
        </div>
    </>
);

const LastResult = ({ match }: { match: Match }) => {
    const winnerName = match.winnerId === match.team1Id ? match.team1Name : match.team2Name;
    const winnerOrg = match.winnerId === match.team1Id ? match.team1OrgName : match.team2OrgName;
    return (
        <>
            <h2 className="text-5xl font-light text-gray-400 mb-6">Result from {match.courtName}</h2>
            <div className="text-6xl font-bold mb-2">
                <span className="text-yellow-400">WINNER:</span> {winnerName}
            </div>
            <p className="text-4xl text-gray-300 mb-6">{winnerOrg}</p>
            <div className="text-7xl font-black bg-gray-800 px-8 py-4 rounded-lg">
                {match.score}
            </div>
        </>
    );
}

const WelcomeSlide = ({ tournament }: { tournament: Tournament }) => (
  <>
    <div className="mb-8 scale-150">
      <Logo />
    </div>
    <h1 className="text-8xl font-extrabold mb-4">{tournament.location}</h1>
    <p className="text-4xl text-gray-400">Welcome to the Tournament</p>
  </>
);

export function HubView({ matches, selectedCourt, tournament }: { matches: Match[]; selectedCourt: string | null; tournament: Tournament | null }) {
  const [slideIndex, setSlideIndex] = useState(0);

  const upcomingMatch = selectedCourt ? matches.find(m => m.courtName === selectedCourt && m.status === 'SCHEDULED') : null;
  const lastResult = selectedCourt ? matches.filter(m => m.courtName === selectedCourt && m.status === 'COMPLETED').sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0] : null;

  const slides = [];
  if (tournament) slides.push({ id: 'welcome', component: <WelcomeSlide tournament={tournament} /> });
  if (upcomingMatch) slides.push({ id: `upcoming-${upcomingMatch.id}`, component: <UpcomingMatch match={upcomingMatch} /> });
  if (lastResult) slides.push({ id: `result-${lastResult.id}`, component: <LastResult match={lastResult} /> });


  useEffect(() => {
    if (slides.length <= 1) return;

    const interval = setInterval(() => {
      setSlideIndex(prevIndex => (prevIndex + 1) % slides.length);
    }, 10000); // Rotate every 10 seconds

    return () => clearInterval(interval);
  }, [slides.length]);
  
  if (!selectedCourt || !tournament) {
      return (
          <div className="h-full flex items-center justify-center">
              <p className="text-3xl text-gray-500">Please select a court.</p>
          </div>
      )
  }

  if (slides.length === 0) {
    return (
        <div className="h-full flex flex-col items-center justify-center p-8">
            <h1 className="text-7xl font-bold mb-4">Court {selectedCourt}</h1>
            <p className="text-4xl text-gray-400">No upcoming matches or recent results to display.</p>
        </div>
    )
  }

  const currentSlide = slides[slideIndex];

  return (
    <div className="relative h-full w-full">
        {currentSlide && <SlideWrapper keyId={currentSlide.id}>{currentSlide.component}</SlideWrapper>}
    </div>
  );
}
