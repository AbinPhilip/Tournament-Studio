
"use client";

import { useAuth } from '@/hooks/use-auth';
import dynamic from 'next/dynamic';
import { LoadingShuttlecock } from '@/components/ui/loading-shuttlecock';

const AdminView = dynamic(() => import('@/app/dashboard/admin-view'), { loading: () => <div className="flex h-full w-full items-center justify-center"><div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" /></div> });
const IndividualView = dynamic(() => import('@/components/dashboard/individual-view'), { loading: () => <div className="flex h-full w-full items-center justify-center"><div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" /></div> });
const InquiryView = dynamic(() => import('@/components/dashboard/inquiry-view'), { loading: () => <div className="flex h-full w-full items-center justify-center"><div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" /></div> });
const UpdateUserView = dynamic(() => import('@/components/dashboard/update-user-view'), { loading: () => <div className="flex h-full w-full items-center justify-center"><div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" /></div> });
const CourtUmpireView = dynamic(() => import('@/app/dashboard/court-umpire-view'), { loading: () => <div className="flex h-full w-full items-center justify-center"><div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" /></div> });


export default function DashboardPage() {
  const { user } = useAuth();

  const renderDashboardByRole = () => {
    if (!user) {
        return <div className="flex h-full w-full items-center justify-center"><div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" /></div>;
    }
    
    switch (user?.role) {
      case 'admin':
      case 'super':
        return <AdminView />;
      case 'individual':
        return <IndividualView />;
      case 'inquiry':
        return <InquiryView />;
      case 'update':
        return <UpdateUserView />;
      case 'court':
        return <CourtUmpireView />;
      default:
        return <p>No role assigned. Please contact support.</p>;
    }
  };

  return <div className="container mx-auto h-full">{renderDashboardByRole()}</div>;
}
