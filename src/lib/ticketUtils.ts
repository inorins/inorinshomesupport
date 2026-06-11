import type { Ticket } from '@/data/mockData';

export const EMAIL_BANK_MAP: Record<string, string> = {
  'guheshwori.com.np': 'Guheshwori',
  'reliancebank.com.np': 'Reliance',
  'progressivebank.com.np': 'Progressive',
  'ganapatibank.com.np': 'Ganapati',
  'goodwillbank.com.np': 'Goodwill',
  'shreefinance.com.np': 'Shree Finance',
};

export function resolveTicketBankName(ticket: Ticket): string {
  if (ticket.bankName?.trim()) {
    return ticket.bankName;
  }
  const email = String(ticket.reporterEmail ?? '').toLowerCase();
  const domain = email.includes('@') ? email.split('@')[1] : '';
  return EMAIL_BANK_MAP[domain] ?? 'Inorins';
}
