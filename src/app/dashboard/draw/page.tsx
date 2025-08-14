
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, Timestamp } from 'firebase/firestore';
import type { Match, Team, TeamType } from '@/types';
import { Loader2 } from 'lucide-react';
import { getRoundName } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export default function DrawPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [matches, setMatches] = useState<Match[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [tournamentType, setTournamentType] = useState<'knockout' | 'round-robin'>('knockout');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [matchesSnap, teamsSnap, tournamentSnap] = await Promise.all([
                    getDocs(query(collection(db, 'matches'))),
                    getDocs(collection(db, 'teams')),
                    getDocs(collection(db, 'tournaments')),
                ]);

                const matchesData = matchesSnap.docs.map(doc => {
                    const data = doc.data() as Omit<Match, 'startTime'> & {startTime: Timestamp | null};
                    return { id: doc.id, ...data, startTime: data.startTime?.toDate() ?? new Date() } as Match;
                });
                setMatches(matchesData);
                
                const teamsData = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
                setTeams(teamsData);

                if (!tournamentSnap.empty) {
                    setTournamentType(tournamentSnap.docs[0].data().tournamentType);
                }

            } catch (error) {
                console.error("Error fetching draw data:", error);
                toast({ title: 'Error', description: 'Failed to fetch tournament draw data.', variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [toast]);

    const teamCounts = useMemo(() => {
        return teams.reduce((acc, team) => {
            if (!acc[team.type]) {
                acc[team.type] = 0;
            }
            acc[team.type]++;
            return acc;
        }, {} as Record<TeamType, number>);
    }, [teams]);

    const groupedMatches = useMemo(() => {
        const byEvent = matches.reduce((acc, match) => {
            if (!acc[match.eventType]) {
                acc[match.eventType] = [];
            }
            acc[match.eventType].push(match);
            return acc;
        }, {} as Record<TeamType, Match[]>);

        for (const eventType in byEvent) {
            byEvent[eventType as TeamType].sort((a, b) => {
                if ((a.round ?? 0) !== (b.round ?? 0)) {
                    return (a.round ?? 0) - (b.round ?? 0);
                }
                const aLot1 = teams.find(t => t.id === a.team1Id)?.lotNumber ?? Infinity;
                const bLot1 = teams.find(t => t.id === b.team1Id)?.lotNumber ?? Infinity;
                return aLot1 - bLot1;
            });
        }
        return byEvent;
    }, [matches, teams]);
    
    const matchesByRound = useMemo(() => {
         return Object.entries(groupedMatches).reduce((acc, [eventType, eventMatches]) => {
            const rounds = eventMatches.reduce((roundAcc, match) => {
                const round = match.round || 1;
                if (!roundAcc[round]) {
                    roundAcc[round] = [];
                }
                roundAcc[round].push(match);
                return roundAcc;
            }, {} as Record<number, Match[]>);
            acc[eventType as TeamType] = rounds;
            return acc;
        }, {} as Record<TeamType, Record<number, Match[]>>);
    }, [groupedMatches]);

    const eventOrder: TeamType[] = ['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles'];
    const availableEvents = eventOrder.filter(event => groupedMatches[event] && groupedMatches[event].length > 0);


    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
             <div className="p-4 md:p-0">
                <h1 className="text-4xl font-bold tracking-tight mb-2">Tournament Draw</h1>
                <p className="text-lg text-muted-foreground">
                    {tournamentType === 'knockout' 
                        ? "Visualize each team's path to the finals in the knockout bracket."
                        : "View all scheduled round-robin matches for each event."
                    }
                </p>
            </div>
            
            {matches.length === 0 && !isLoading ? (
                 <Card>
                    <CardContent className="pt-6 text-center">
                        <p className="text-lg text-muted-foreground">The tournament draw has not been generated yet.</p>
                    </CardContent>
                </Card>
            ) : (
                <Tabs defaultValue={availableEvents[0]} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
                        {availableEvents.map(eventType => (
                            <TabsTrigger key={eventType} value={eventType} className="capitalize text-base py-2.5">
                                {eventType.replace(/_/g, ' ')}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {availableEvents.map(eventType => {
                        const eventRounds = matchesByRound[eventType];
                        if (!eventRounds || Object.keys(eventRounds).length === 0) return null;
                        const totalTeams = teamCounts[eventType] || 0;

                        return (
                            <TabsContent key={eventType} value={eventType}>
                                <Card className="bg-card/50">
                                    <CardHeader>
                                        <CardTitle className="text-3xl capitalize">{eventType.replace(/_/g, ' ')}</CardTitle>
                                        <CardDescription className="text-base">{totalTeams} teams competing.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ScrollArea>
                                            <div className="flex gap-4 md:gap-8 pb-4">
                                                {Object.keys(eventRounds).sort((a,b) => Number(a) - Number(b)).map(roundNumberStr => {
                                                    const roundNumber = Number(roundNumberStr);
                                                    const roundMatches = eventRounds[roundNumber];
                                                    return (
                                                        <div key={roundNumber} className="flex flex-col gap-6 min-w-[320px]">
                                                            <h4 className="text-xl font-bold text-center text-primary tracking-wider uppercase mb-2">{getRoundName(roundNumber, eventType, totalTeams)}</h4>
                                                            <div className="space-y-4">
                                                                {roundMatches.map(match => (
                                                                    <div key={match.id} className="border-2 rounded-xl p-4 text-base bg-background shadow-md transition-all hover:shadow-lg">
                                                                        <div className={`flex flex-col ${match.winnerId === match.team1Id ? 'font-extrabold text-foreground' : 'text-muted-foreground'}`}>
                                                                            <span className="text-lg">{match.team1Name}</span>
                                                                            <span className="text-sm font-bold">{match.team1OrgName}</span>
                                                                        </div>
                                                                        <div className="flex items-center my-3">
                                                                            <div className="flex-grow border-t border-dashed"></div>
                                                                            <span className="flex-shrink mx-3 text-sm font-bold text-muted-foreground">VS</span>
                                                                            <div className="flex-grow border-t border-dashed"></div>
                                                                        </div>
                                                                        <div className={`flex flex-col ${match.winnerId === match.team2Id ? 'font-extrabold text-foreground' : 'text-muted-foreground'}`}>
                                                                             <span className="text-lg">{match.team2Name}</span>
                                                                             <span className="text-sm font-bold">{match.team2OrgName}</span>
                                                                        </div>
                                                                        {match.status === 'COMPLETED' && (
                                                                             <div className="text-center mt-3 pt-3 border-t">
                                                                                <Badge variant="secondary" className="text-base px-4 py-1">{match.score}</Badge>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            <ScrollBar orientation="horizontal" />
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        )
                    })}
                </Tabs>
            )}
        </div>
    )
}
