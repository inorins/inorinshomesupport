import { useMemo } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ClientHeader } from '@/components/client/ClientHeader';
import { ClientSidebar } from '@/components/client/ClientSidebar';
import { ClientTicketListView } from '@/components/views/ClientTicketListView';
import { ClientTicketDetailView } from '@/components/views/ClientTicketDetailView';
import { ClientNewTicketView } from '@/components/views/ClientNewTicketView';
import { useTickets } from '@/hooks/useTicketsData';
import { useAuth } from '@/context/AuthContext';
import { HelpCircle } from 'lucide-react';

function ClientTicketDetailRoute() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();

  if (!ticketId) {
    return <Navigate to="/client/tickets" replace />;
  }

  return (
    <ClientTicketDetailView
      ticketId={ticketId}
      onBack={() => navigate('/client/tickets')}
    />
  );
}

export function ClientPortal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { tickets } = useTickets();

  const activeView = useMemo(() => {
    const { pathname } = location;
    if (pathname.startsWith('/client/tickets/new')) return 'new-ticket';
    if (pathname.startsWith('/client/faq')) return 'faq';
    return 'my-tickets';
  }, [location.pathname]);

  const myTickets = useMemo(() => {
    if (!user?.bankDomain && !user?.bankName) return [];
    const bankDomain = user?.bankDomain?.toLowerCase();
    const bankName = user?.bankName?.toLowerCase();

    return tickets.filter((t) => {
      const reporterEmail = t.reporterEmail.toLowerCase();
      const emailMatches = bankDomain ? reporterEmail.endsWith(`@${bankDomain}`) : false;
      const bankNameMatches = bankName ? String(t.bankName ?? '').toLowerCase() === bankName : false;
      return emailMatches || bankNameMatches;
    });
  }, [tickets, user]);

  const openCount = myTickets.filter((t) => t.status === 'Open' || t.status === 'In Progress').length;

  const handleViewTicket = (id: string) => {
    navigate(`/client/tickets/${id}`);
  };

  const handleNavigate = (view: string) => {
    switch (view) {
      case 'my-tickets':
        navigate('/client/tickets');
        return;
      case 'new-ticket':
        navigate('/client/tickets/new');
        return;
      case 'faq':
        navigate('/client/faq');
        return;
      default:
        navigate('/client/tickets');
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface">
      <ClientSidebar
        activeView={activeView}
        onNavigate={handleNavigate}
        openTicketCount={openCount}
      />
      <div className="flex-1 flex flex-col h-screen">
        <ClientHeader onNewTicket={() => navigate('/client/tickets/new')} />
        <main className="flex-1 min-h-0 overflow-auto">
          <Routes>
            <Route path="tickets" element={<ClientTicketListView onViewTicket={handleViewTicket} onNewRequest={() => navigate('/client/tickets/new')} />} />
            <Route path="tickets/new" element={<ClientNewTicketView onSuccess={() => navigate('/client/tickets')} />} />
            <Route path="tickets/:ticketId" element={<ClientTicketDetailRoute />} />
            <Route path="faq" element={<FaqView />} />
            <Route path="*" element={<Navigate to="/client/tickets" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function FaqView() {
  const faqs = [
    
    {
      q: 'What is the difference between UAT and Production tickets?',
      a: 'UAT issues affect your test environment. Production issues affect live operations and receive higher priority.',
    },
    {
      q: 'Can I add attachments after submitting a ticket?',
      a: 'No — attachments must be added during the submission of the tickets.',
    },
    {
      q: 'Who should I contact for urgent escalation?',
      a: 'Reply to your ticket with "ESCALATE" and a description of the business impact. Our support lead will be notified immediately.',
    },
    {
      q: 'How do I check if the issue is from the CBS, ECL or DCH system?',
      a: 'CBS covers core banking (accounts, loans, users). ECL is for provisioning and reporting. DCH handles reconciliation and settlement.',
    },
  ];

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">FAQ & Guides</h1>
        <p className="text-sm text-muted-foreground mt-1">Common questions about using the Inorins support portal</p>
      </div>
      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <div key={i} className="bg-card rounded-lg border border-border p-5">
            <div className="flex gap-3">
              <HelpCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground mb-1.5">{faq.q}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
