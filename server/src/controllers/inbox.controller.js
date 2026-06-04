import { InboxEmailModel } from '../models/InboxEmail.model.js';
import { TicketModel } from '../models/Ticket.model.js';
import { EmailService } from '../services/email.service.js';
import { syncAllAccounts } from '../services/gmail.service.js';

export const InboxController = {
  async list(req, res) {
    const status = req.query.status; // pending | ticket_created | dismissed | (omit for all)
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const emails = await InboxEmailModel.findAll({ status, limit, offset });
    const pending = await InboxEmailModel.countPending();
    return res.json({ emails, pending });
  },

  async toTicket(req, res) {
    const email = await InboxEmailModel.findById(req.params.id);
    if (!email) return res.status(404).json({ message: 'Email not found.' });
    if (email.status !== 'pending') {
      return res.status(400).json({ message: 'This email has already been processed.' });
    }

    const payload = req.body ?? {};
    const title = String(payload.title ?? email.subject ?? '').trim() || '(Untitled)';
    const system = String(payload.system ?? '').trim() || 'CBS';
    const module = String(payload.module ?? '').trim() || 'General';
    const form = String(payload.form ?? '').trim() || 'Email';
    const priority = String(payload.priority ?? 'Medium');
    const environment = String(payload.environment ?? 'UAT');

    const ticket = await TicketModel.create({
      title,
      system,
      module,
      form,
      priority,
      environment,
      requestType: 'Issue',
      source: 'email',
      reporter: email.senderName || email.senderEmail,
      reporterEmail: email.replyTo || email.senderEmail,
      description: email.bodyText || '(Email content)',
      bankName: payload.bankName ?? '',
    });

    await InboxEmailModel.markAsTicket(email.id, ticket.id, req.sessionUser.id);

    EmailService.sendNewTicketAlert(ticket).catch((err) => console.error('[email] sendNewTicketAlert failed:', err.message));
    EmailService.sendClientConfirmation(ticket).catch((err) => console.error('[email] sendClientConfirmation failed:', err.message));

    return res.status(201).json({ ticket, emailId: email.id });
  },

  async dismiss(req, res) {
    const email = await InboxEmailModel.findById(req.params.id);
    if (!email) return res.status(404).json({ message: 'Email not found.' });
    await InboxEmailModel.dismiss(email.id, req.sessionUser.id);
    return res.json({ ok: true });
  },

  async sync(_req, res) {
    syncAllAccounts().catch((err) => console.error('[gmail] Manual sync failed:', err.message));
    return res.json({ message: 'Sync started.' });
  },
};
