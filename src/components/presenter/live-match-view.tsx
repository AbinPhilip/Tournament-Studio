
import type { Match, Tournament } from '@/types';
import { getRoundName } from '@/lib/utils';
import { AnimatePresence, m } from 'framer-motion';

const Score = ({ score }: { score: number | string }) => (
    <AnimatePresence mode="popLayout">
        <m.div
            key={score}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-8xl md:text-9xl lg:text-[12rem] font-black leading-none"
        >
            {score}
        </m.div>
    </AnimatePresence>
);

const PlayerPanel = ({ name, setsWon, isServing, photoUrl }: { name: string, setsWon: number, isServing: boolean, photoUrl?: string }) => {
    return (
        <div className={`flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-300 ${isServing ? 'bg-yellow-500/20' : 'bg-gray-800/50'}`}>
            {photoUrl && <img data-ai-hint="badminton players" src={photoUrl} alt={name} className="w-24 h-24 rounded-full object-cover border-4 border-white mb-4" />}
            <h2 className="text-3xl lg:text-5xl font-bold text-center break-words w-full">{name}</h2>
            <div className="mt-2 text-2xl lg:text-4xl font-semibold text-gray-300">Games: {setsWon}</div>
            <div className="h-8 mt-4">
                {isServing && <div className="text-2xl font-bold text-yellow-400 animate-pulse">SERVING</div>}
            </div>
        </div>
    );
};

export function LiveMatchView({ match, tournament }: { match: Match; tournament: Tournament }) {
    if (!match) return null;

    const { team1Points = 0, team2Points = 0, servingTeamId } = match.live || {};
    const team1SetsWon = match.scores?.filter(s => s.team1 > s.team2).length || 0;
    const team2SetsWon = match.scores?.filter(s => s.team2 > s.team1).length || 0;

    return (
        <div className="h-full w-full flex flex-col items-center justify-center p-4 md:p-8">
            <header className="text-center mb-6">
                <h1 className="text-4xl font-bold">{tournament.location}</h1>
                <h2 className="text-2xl text-gray-400 capitalize">
                    {match.eventType.replace(/_/g, ' ')} - {getRoundName(match.round || 1, match.eventType, 0)} - Court {match.courtName}
                </h2>
            </header>
            
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-8 w-full max-w-7xl mx-auto">
                <PlayerPanel name={match.team1Name} setsWon={team1SetsWon} isServing={servingTeamId === match.team1Id} />
                <div className="flex items-center justify-center gap-4 md:gap-8">
                    <Score score={team1Points} />
                    <span className="text-6xl md:text-8xl font-light text-gray-600">-</span>
                    <Score score={team2Points} />
                </div>
                <PlayerPanel name={match.team2Name} setsWon={team2SetsWon} isServing={servingTeamId === match.team2Id} />
            </div>

            <footer className="mt-6 text-center text-gray-500">
                Live from Battledore Tournament Manager
            </footer>
        </div>
    );
}
