
"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';


export default function UpdateUserView() {
  const { user } = useAuth();
  const router = useRouter();


  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Welcome, {user?.name}</h1>
      <p className="text-muted-foreground mb-8">You have update access. Use the navigation to manage matches.</p>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button onClick={() => router.push('/dashboard/umpire')} className="p-4 border rounded-lg hover:bg-muted">Umpire View</button>
            <button onClick={() => router.push('/dashboard/draw')} className="p-4 border rounded-lg hover:bg-muted">Tournament Draw</button>
            <button onClick={() => router.push('/dashboard/match-history')} className="p-4 border rounded-lg hover:bg-muted">Match History</button>
            <button onClick={() => router.push('/presenter')} className="p-4 border rounded-lg hover:bg-muted">Presenter View</button>
       </div>
    </div>
  );
}
