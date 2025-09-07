
"use client";

import { useAuth } from '@/hooks/use-auth';
import dynamic from 'next/dynamic';
import { LoadingShuttlecock } from '@/components/ui/loading-shuttlecock';

const AdminView = dynamic(() => import('@/app/dashboard/admin-view'), { loading: () => <LoadingShuttlecock /> });
const IndividualView = dynamic(() => import('@/components/dashboard/individual-view'), { loading: () => <LoadingShuttlecock /> });
const InquiryView = dynamic(() => import('@/components/dashboard/inquiry-view'), { loading: () => <LoadingShuttlecock /> });
const UpdateUserView = dynamic(() => import('@/components/dashboard/update-user-view'), { loading: () => <LoadingShuttlecock /> });
const CourtUmpireView = dynamic(() => import('@/app/dashboard/court-umpire-view'), { loading: () => <LoadingShuttlecock /> });


export default function DashboardPage() {
  const { user } = useAuth();

  const renderDashboardByRole = () => {
    if (!user) {
        return <LoadingShuttlecock className="h-full" />;
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
