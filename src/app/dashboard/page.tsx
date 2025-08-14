
"use client";

import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const AdminView = dynamic(() => import('@/app/dashboard/admin-view'), { loading: () => <Loader2 className="h-12 w-12 animate-spin" /> });
const IndividualView = dynamic(() => import('@/components/dashboard/individual-view'), { loading: () => <Loader2 className="h-12 w-12 animate-spin" /> });
const InquiryView = dynamic(() => import('@/components/dashboard/inquiry-view'), { loading: () => <Loader2 className="h-12 w-12 animate-spin" /> });
const UpdateUserView = dynamic(() => import('@/components/dashboard/update-user-view'), { loading: () => <Loader2 className="h-12 w-12 animate-spin" /> });
const CourtUmpireView = dynamic(() => import('@/app/dashboard/court-umpire-view'), { loading: () => <Loader2 className="h-12 w-12 animate-spin" /> });


export default function DashboardPage() {
  const { user } = useAuth();

  const renderDashboardByRole = () => {
    if (!user) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
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
