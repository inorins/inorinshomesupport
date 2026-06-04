import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
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
import { InboxView } from '@/components/views/InboxView';
import { GmailInboxView } from '@/components/views/GmailInboxView';
import { SystemChangesView } from '@/components/views/SystemChangesView';
import { PermissionsView } from '@/components/views/PermissionsView';
import { AuditLogView } from '@/components/views/AuditLogView';
import { SessionManagementView } from '@/components/views/SessionManagementView';
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
    if (pathname.startsWith('/staff/chat')) return 'chat';
    if (pathname.startsWith('/staff/inbox')) return 'inbox';
    if (pathname.startsWith('/staff/system-changes')) return 'system-changes';
    if (pathname.startsWith('/staff/permissions')) return 'permissions';
    if (pathname.startsWith('/staff/audit-log')) return 'audit-log';
    if (pathname.startsWith('/staff/sessions')) return 'sessions';
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
      case 'chat':
        navigate('/staff/chat');
        return;
      case 'inbox':
        navigate('/staff/inbox');
        return;
      case 'system-changes':
        navigate('/staff/system-changes');
        return;
      case 'permissions':
        navigate('/staff/permissions');
        return;
      case 'audit-log':
        navigate('/staff/audit-log');
        return;
      case 'sessions':
        navigate('/staff/sessions');
        return;
      default:
        navigate('/staff/dashboard');
    }
  };

  const handleViewTicket = (id: string) => {
    navigate(`/staff/tickets/${id}`);
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 md:relative md:z-auto md:translate-x-0 transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        <AppSidebar activeView={activeView} onNavigate={(v) => { handleNavigate(v); setSidebarOpen(false); }} isAdmin={isAdmin} />
      </div>
      <div className="flex-1 flex flex-col h-screen min-w-0">
        <AppHeader
          onNewTicket={() => setShowCreateTicket(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onMenuClick={() => setSidebarOpen(true)}
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
            {user?.role === 'inorins' && (
              <Route path="system-changes" element={<SystemChangesView />} />
            )}
            {isAdmin && (
              <Route path="permissions" element={<PermissionsView />} />
            )}
            {isAdmin && (
              <Route path="audit-log" element={<AuditLogView />} />
            )}
            {isAdmin && (
              <Route path="sessions" element={<SessionManagementView />} />
            )}
            <Route path="chat" element={<InboxView />} />
            <Route path="inbox" element={<GmailInboxView />} />
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
