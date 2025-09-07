
"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { Team, Organization, Registration, Tournament } from '@/types';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { Logo } from '@/components/logo';

type ReceiptData = {
    team: Team;
    organization: Organization;
    registration: Registration;
    tournament: Tournament;
}

export default function ReceiptPage() {
    const params = useParams();
    const teamId = params.teamId as string;
    const [data, setData] = useState<ReceiptData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!teamId) return;

        const fetchData = async () => {
            try {
                const teamRef = doc(db, 'teams', teamId);
                const regRef = doc(db, 'registrations', teamId);

                const [teamSnap, regSnap, orgsSnap, tourneySnap] = await Promise.all([
                    getDoc(teamRef),
                    getDoc(regRef),
                    getDocs(collection(db, 'organizations')),
                    getDocs(collection(db, 'tournaments')),
                ]);

                if (!teamSnap.exists() || !regSnap.exists() || tourneySnap.empty) {
                    throw new Error("Required data not found.");
                }

                const team = { id: teamSnap.id, ...teamSnap.data() } as Team;
                const registration = { id: regSnap.id, ...regSnap.data() } as Registration;
                
                const orgMap = new Map(orgsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as Organization]));
                const organization = orgMap.get(team.organizationId);
                
                const tourneyDoc = tourneySnap.docs[0];
                const tournament = {
                    id: tourneyDoc.id,
                    ...tourneyDoc.data(),
                    date: (tourneyDoc.data().date as Timestamp).toDate(),
                } as Tournament;

                if (!organization || !tournament) {
                    throw new Error("Organization or Tournament data is missing.");
                }

                setData({ team, organization, registration, tournament });

            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [teamId]);

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" /></div>;
    }
    if (error) {
        return <div className="flex h-screen items-center justify-center text-red-500">{error}</div>;
    }
    if (!data) {
        return <div className="flex h-screen items-center justify-center">No data available for this receipt.</div>;
    }

    const { team, organization, registration, tournament } = data;

    return (
        <div className="bg-gray-100 min-h-screen p-4 sm:p-8 print:p-0 print:bg-white">
            <div className="max-w-2xl mx-auto bg-white shadow-lg rounded-lg p-8 print:shadow-none print:rounded-none">
                <header className="flex justify-between items-start pb-6 border-b">
                    <div>
                        <Logo />
                        <h1 className="text-2xl font-bold text-gray-800 mt-4">{tournament.name}</h1>
                        <p className="text-gray-500">{tournament.hostName}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-3xl font-bold text-primary uppercase">Receipt</h2>
                        <p className="text-gray-500 mt-1">Receipt #{team.id.substring(0, 8).toUpperCase()}</p>
                        <p className="text-gray-500">Date: {registration.paymentDate ? format((registration.paymentDate as Timestamp).toDate(), 'PPP') : 'N/A'}</p>
                    </div>
                </header>

                <main className="grid grid-cols-2 gap-8 my-8">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Billed To</h3>
                        <p className="font-bold text-gray-800">{organization.name}</p>
                        <p className="text-gray-600">{team.player1Name}{team.player2Name && ` & ${team.player2Name}`}</p>
                    </div>
                </main>

                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="p-3 text-sm font-semibold text-gray-600 uppercase">Description</th>
                            <th className="p-3 text-sm font-semibold text-gray-600 uppercase text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b">
                            <td className="p-3">
                                <p className="font-medium text-gray-800">Tournament Registration Fee</p>
                                <p className="text-sm text-gray-500 capitalize">{team.type.replace(/_/g, ' ')} Event</p>
                            </td>
                            <td className="p-3 text-right">${registration.paymentAmount?.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
                
                <div className="flex justify-end mt-8">
                    <div className="w-full max-w-xs">
                        <div className="flex justify-between py-2">
                            <span className="text-gray-600">Subtotal</span>
                            <span className="text-gray-800">${registration.paymentAmount?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between py-2 border-t-2 border-gray-200">
                            <span className="font-bold text-gray-800">Total Paid</span>
                            <span className="font-bold text-gray-800">${registration.paymentAmount?.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <footer className="mt-12 text-center text-gray-500 text-sm print:hidden">
                    <p>Thank you for your participation!</p>
                     <Button onClick={() => window.print()} className="mt-4">
                        <Printer className="mr-2" /> Print Receipt
                    </Button>
                </footer>
            </div>
        </div>
    );
}
