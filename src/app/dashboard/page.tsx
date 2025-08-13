"use client";

import { useAuth } from '@/hooks/use-auth';
import AdminView from '@/components/dashboard/admin-view';
import IndividualView from '@/components/dashboard/individual-view';
import InquiryView from '@/components/dashboard/inquiry-view';
import UpdateUserView from '@/components/dashboard/update-user-view';

export default function DashboardPage() {
  const { user } = useAuth();

  const renderDashboardByRole = () => {
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
      default:
        return <p>No role assigned. Please contact support.</p>;
    }
  };

  return <div className="container mx-auto">{renderDashboardByRole()}</div>;
}
