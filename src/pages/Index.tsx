import { useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { DashboardView } from '@/components/views/DashboardView';
import { CreateTicketModal } from '@/components/views/CreateTicketModal';
import { TeamBoardView } from '@/components/views/TeamBoardView';
import { TicketDetailView } from '@/components/views/TicketDetailView';
import { SettingsView } from '@/components/views/SettingsView';
import { ArchiveView } from '@/components/views/ArchiveView';
import { AdminUsersView } from '@/components/views/AdminUsersView';
import { useAuth } from '@/context/AuthContext';

function StaffTicketDetailRoute() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();

  if (!ticketId) {
    return <Navigate to="/staff/tickets" replace />;
  }

  return (
    <TicketDetailView
      ticketId={ticketId}
      onBack={() => navigate('/staff/tickets')}
    />
  );
}

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = user?.email?.toLowerCase() === 'inorins@inorins.com';

  const activeView = useMemo(() => {
    const { pathname } = location;
    if (pathname.startsWith('/staff/board')) return 'board';
    if (pathname.startsWith('/staff/settings')) return 'settings';
    if (pathname.startsWith('/staff/archive')) return 'archive';
    if (pathname.startsWith('/staff/admin-users')) return 'admin-users';
    if (pathname.startsWith('/staff/tickets')) return 'tickets';
    return 'dashboard';
  }, [location.pathname]);

  const handleNavigate = (view: string) => {
    if (view.startsWith('ticket-')) {
      navigate(`/staff/tickets/${view.slice(7)}`);
      return;
    }
    switch (view) {
      case 'dashboard':
        navigate('/staff/dashboard');
        return;
      case 'tickets':
        navigate('/staff/tickets');
        return;
      case 'board':
        navigate('/staff/board');
        return;
      case 'settings':
        navigate('/staff/settings');
        return;
      case 'archive':
        navigate('/staff/archive');
        return;
      case 'admin-users':
        navigate('/staff/admin-users');
        return;
      default:
        navigate('/staff/dashboard');
    }
  };

  const handleViewTicket = (id: string) => {
    navigate(`/staff/tickets/${id}`);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface">
      <AppSidebar activeView={activeView} onNavigate={handleNavigate} isAdmin={isAdmin} />
      <div className="flex-1 flex flex-col h-screen">
        <AppHeader
          onNewTicket={() => setShowCreateTicket(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <main className="flex-1 min-h-0 overflow-auto">
          <Routes>
            <Route
              path="dashboard"
              element={<DashboardView onViewTicket={handleViewTicket} searchQuery={searchQuery} />}
            />
            <Route
              path="tickets"
              element={<DashboardView onViewTicket={handleViewTicket} searchQuery={searchQuery} />}
            />
            <Route path="board" element={<TeamBoardView onViewTicket={handleViewTicket} />} />
            <Route path="settings" element={<SettingsView />} />
            {isAdmin && (
              <Route path="archive" element={<ArchiveView onViewTicket={handleViewTicket} />} />
            )}
            {isAdmin && (
              <Route path="admin-users" element={<AdminUsersView />} />
            )}
            <Route path="tickets/:ticketId" element={<StaffTicketDetailRoute />} />
            <Route path="*" element={<Navigate to="/staff/dashboard" replace />} />
          </Routes>
        </main>
      </div>
      <CreateTicketModal open={showCreateTicket} onClose={() => setShowCreateTicket(false)} />
    </div>
  );
};

export default Index;
