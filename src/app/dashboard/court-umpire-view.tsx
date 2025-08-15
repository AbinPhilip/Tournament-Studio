
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import type { Match, Team, TeamType } from '@/types';
import { Loader2, Gamepad2, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { getRoundName } from '@/lib/utils';
import { EventBadge } from '@/components/ui/event-badge';

export default function CourtUmpireView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamCounts, setTeamCounts] = useState<Record<TeamType, number>>({
    singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0,
  });

  const courtName = user?.courtName;

  useEffect(() => {
    if (!courtName) {
        setIsLoading(false);
        return;
    };

    setIsLoading(true);

    const matchesQuery = query(collection(db, 'matches'), where('courtName', '==', courtName));
    
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
        
        matchesData.sort((a, b) => (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0));
        setMatches(matchesData);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching matches:", error);
        toast({ title: 'Error', description: 'Failed to fetch match data in real-time.', variant: 'destructive' });
        setIsLoading(false);
    });
    
    const unsubscribeTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
        const counts: Record<TeamType, number> = { singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0 };
        snapshot.forEach(doc => {
            const team = doc.data() as Team;
            if (counts[team.type] !== undefined) {
                counts[team.type]++;
            }
        });
        setTeamCounts(counts);
    }, (error) => {
         console.error("Error fetching team counts:", error);
        toast({ title: 'Error', description: 'Failed to fetch team counts.', variant: 'destructive' });
    });


    return () => {
        unsubscribeMatches();
        unsubscribeTeams();
    };
  }, [courtName, toast]);

  const handleScorerClick = (match: Match) => {
    if (match.status === 'COMPLETED') {
      toast({ title: 'Match Completed', description: 'This match has already been scored.' });
      return;
    }
    router.push(`/dashboard/umpire/${match.id}`);
  };

  if (isLoading) {
    return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><ShieldCheck /> Court: {courtName}</CardTitle>
            <CardDescription>View assigned matches. Click the scorer icon to begin.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {matches.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No matches currently assigned to this court.</p>
          </div>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Round</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map(match => (
                  <TableRow key={match.id} className={match.status === 'IN_PROGRESS' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                    <TableCell><EventBadge eventType={match.eventType} /></TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{getRoundName(match.round || 0, match.eventType, teamCounts[match.eventType])}</TableCell>
                    <TableCell className="min-w-[250px]">
                        <div className={match.winnerId === match.team1Id ? 'font-bold' : ''}>
                            <span>{match.team1Name}</span>
                            <p className="text-sm text-muted-foreground">{match.team1OrgName}</p>
                        </div>
                        <div className="text-muted-foreground my-1">vs</div>
                        <div className={match.winnerId === match.team2Id ? 'font-bold' : ''}>
                            <span>{match.team2Name}</span>
                            <p className="text-sm text-muted-foreground">{match.team2OrgName}</p>
                        </div>
                    </TableCell>
                    <TableCell>{match.score || ''}</TableCell>
                    <TableCell>
                      <Badge variant={match.status === 'COMPLETED' ? 'default' : (match.status === 'IN_PROGRESS' || match.status === 'SCHEDULED') ? 'secondary' : 'outline'}>
                        {match.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleScorerClick(match)} disabled={match.status === 'COMPLETED'}>
                        <Gamepad2 className="h-5 w-5"/>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
