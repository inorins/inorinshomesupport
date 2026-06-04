import { TicketWatcherModel } from '../models/TicketWatcher.model.js';
import { TicketModel } from '../models/Ticket.model.js';
import { getSessionUser } from '../utils/token.js';

export const WatcherController = {
  async list(req, res) {
    const watchers = await TicketWatcherModel.findByTicket(req.params.ticketId);
    return res.json(watchers);
  },

  async add(req, res) {
    const sessionUser = getSessionUser(req);
    if (!sessionUser || sessionUser.role !== 'inorins') {
      return res.status(403).json({ message: 'Only Inorins staff can watch tickets.' });
    }
    const ticket = await TicketModel.findById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

    await TicketWatcherModel.add(req.params.ticketId, sessionUser.id);
    const watchers = await TicketWatcherModel.findByTicket(req.params.ticketId);
    return res.json(watchers);
  },

  async remove(req, res) {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ message: 'Unauthenticated.' });

    const targetUserId = req.params.userId === 'me' ? sessionUser.id : parseInt(req.params.userId, 10);
    if (sessionUser.role !== 'inorins' && targetUserId !== sessionUser.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    await TicketWatcherModel.remove(req.params.ticketId, targetUserId);
    const watchers = await TicketWatcherModel.findByTicket(req.params.ticketId);
    return res.json(watchers);
  },
};
