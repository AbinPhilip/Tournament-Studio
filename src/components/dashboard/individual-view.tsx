
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { User, Team, Match, TeamType, Organization } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getRoundName } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export default function IndividualView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [myMatches, setMyMatches] = useState<Record<string, Match[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [teamCounts, setTeamCounts] = useState<Record<TeamType, number>>({
    singles: 0,
    mens_doubles: 0,
    womens_doubles: 0,
    mixed_doubles: 0,
  });

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [orgsSnap, teamsSnap] = await Promise.all([
          getDocs(collection(db, 'organizations')),
          getDocs(collection(db, 'teams'))
        ]);
        
        setOrganizations(orgsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization)));
        
        const allTeams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));

        // 1. Find teams the user is part of
        let userTeams = allTeams.filter(t => t.player1Name === user.name || t.player2Name === user.name);

        // Deduplicate teams in case user name was entered in both fields
        userTeams = userTeams.filter((team, index, self) =>
            index === self.findIndex((t) => (t.id === team.id))
        )
        setMyTeams(userTeams);
        
        // 2. Fetch matches for those teams
        if (userTeams.length > 0) {
          const teamIds = userTeams.map(t => t.id);
          const matchesAsTeam1Query = query(collection(db, 'matches'), where('team1Id', 'in', teamIds));
          const matchesAsTeam2Query = query(collection(db, 'matches'), where('team2Id', 'in', teamIds));

          const [matches1Snap, matches2Snap] = await Promise.all([
            getDocs(matchesAsTeam1Query),
            getDocs(matchesAsTeam2Query)
          ]);
          
          let allMatches = [
            ...matches1Snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match)),
            ...matches2Snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match)),
          ];
          
          // Deduplicate matches
          allMatches = allMatches.filter((match, index, self) =>
            index === self.findIndex((m) => m.id === match.id)
          );
          
          allMatches.sort((a,b) => (a.round || 0) - (b.round || 0));

          const matchesByTeam: Record<string, Match[]> = {};
          userTeams.forEach(team => {
            matchesByTeam[team.id] = allMatches.filter(m => m.team1Id === team.id || m.team2Id === team.id);
          });
          setMyMatches(matchesByTeam);
        }
        
        // 3. Get team counts for round name calculation
         const counts: Record<TeamType, number> = { singles: 0, mens_doubles: 0, womens_doubles: 0, mixed_doubles: 0 };
         allTeams.forEach(team => {
            if (counts[team.type] !== undefined) {
                counts[team.type]++;
            }
         });
         setTeamCounts(counts);

      } catch (err) {
        toast({ title: 'Error', description: 'Failed to fetch your match history.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, toast]);

  const orgNameMap = useMemo(() => {
    return new Map(organizations.map(org => [org.id, org.name]));
  }, [organizations]);
  
  const getOpponentOrgName = (match: Match, myTeamId: string) => {
    const opponentTeamId = match.team1Id === myTeamId ? match.team2Id : match.team1Id;
    const team = myTeams.find(t => t.id === opponentTeamId);
    // Fallback to match data if team not in `myTeams` (which it shouldn't be)
    return team ? orgNameMap.get(team.organizationId) : (match.team1Id === myTeamId ? match.team2OrgName : match.team1OrgName) || 'N/A';
  };
  
  if (isLoading) {
      return (
          <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
      );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Welcome, {user?.name}</h1>
      <p className="text-muted-foreground mb-8">View your registered teams and their match schedules below.</p>
      
      {myTeams.length === 0 ? (
         <Card>
            <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">You are not currently registered in any teams.</p>
            </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
            {myTeams.map(team => (
                <Card key={team.id}>
                    <CardHeader>
                        <CardTitle className="capitalize">{team.type.replace(/_/g, ' ')}</CardTitle>
                        <CardDescription>
                           Team: {team.player1Name} {team.player2Name && `& ${team.player2Name}`} ({orgNameMap.get(team.organizationId)})
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Round</TableHead>
                                    <TableHead>Opponent</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Court</TableHead>
                                    <TableHead>Result</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                               {myMatches[team.id]?.length > 0 ? (
                                    myMatches[team.id].map(match => {
                                        const opponentIsTeam1 = match.team1Id !== team.id;
                                        const opponentName = opponentIsTeam1 ? match.team1Name : match.team2Name;
                                        const isWinner = match.winnerId === team.id;
                                        return (
                                            <TableRow key={match.id}>
                                                <TableCell>{getRoundName(match.round || 0, match.eventType, teamCounts[match.eventType])}</TableCell>
                                                <TableCell>
                                                    <div>
                                                        <span>{opponentName}</span>
                                                        <p className="font-bold">{getOpponentOrgName(match, team.id)}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                     <Badge variant={match.status === 'COMPLETED' ? 'default' : (match.status === 'IN_PROGRESS' || match.status === 'SCHEDULED') ? 'secondary' : 'outline'}>
                                                        {match.status}
                                                     </Badge>
                                                </TableCell>
                                                <TableCell>{match.courtName || 'N/A'}</TableCell>
                                                <TableCell>
                                                    {match.status === 'COMPLETED' && (
                                                        <Badge variant={isWinner ? 'default' : 'destructive'}>
                                                            {isWinner ? `Won (${match.score})` : `Lost (${match.score})`}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                               ) : (
                                 <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground">No matches scheduled for this team yet.</TableCell>
                                 </TableRow>
                               )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            ))}
        </div>
      )}
    </div>
  );
}
