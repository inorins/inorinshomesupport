import { useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { DashboardView } from '@/components/views/DashboardView';
import { CreateTicketModal } from '@/components/views/CreateTicketModal';
import { TeamBoardView } from '@/components/views/TeamBoardView';
import { TicketDetailView } from '@/components/views/TicketDetailView';

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

  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeView = useMemo(() => {
    const { pathname } = location;
    if (pathname.startsWith('/staff/board')) return 'board';
    if (pathname.startsWith('/staff/settings')) return 'settings';
    if (pathname.startsWith('/staff/tickets')) return 'tickets';
    return 'dashboard';
  }, [location.pathname]);

  const handleNavigate = (view: string) => {
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
      default:
        navigate('/staff/dashboard');
    }
  };

  const handleViewTicket = (id: string) => {
    navigate(`/staff/tickets/${id}`);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface">
      <AppSidebar activeView={activeView} onNavigate={handleNavigate} />
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
            <Route
              path="settings"
              element={(
                <div className="p-6">
                  <h1 className="text-2xl font-bold text-foreground">Settings</h1>
                  <p className="text-sm text-muted-foreground mt-1">Application settings and configuration</p>
                </div>
              )}
            />
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
