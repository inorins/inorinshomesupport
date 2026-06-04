import { TicketLinkModel } from '../models/TicketLink.model.js';
import { TicketModel } from '../models/Ticket.model.js';
import { getSessionUser } from '../utils/token.js';

const RESOLVED_STATUSES = new Set(['Resolved', 'Closed']);

export const TicketLinkController = {
  async list(req, res) {
    const { id } = req.params;
    const ticket = await TicketModel.findById(id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
    const links = await TicketLinkModel.findByTicket(id);
    return res.json(links);
  },

  async create(req, res) {
    const { id } = req.params;
    const { linkedTicketId, linkType, note } = req.body ?? {};

    if (!linkedTicketId) return res.status(400).json({ message: 'linkedTicketId is required.' });
    if (id === linkedTicketId) return res.status(400).json({ message: 'Cannot link a ticket to itself.' });
    if (!['duplicate', 'related'].includes(linkType)) return res.status(400).json({ message: 'linkType must be duplicate or related.' });

    const [primary, linked] = await Promise.all([
      TicketModel.findById(id),
      TicketModel.findById(linkedTicketId),
    ]);
    if (!primary) return res.status(404).json({ message: 'Primary ticket not found.' });
    if (!linked) return res.status(404).json({ message: 'Linked ticket not found.' });

    const already = await TicketLinkModel.exists(id, linkedTicketId);
    if (already) return res.status(409).json({ message: 'These tickets are already linked.' });

    const sessionUser = getSessionUser(req);
    const linkId = await TicketLinkModel.create(id, linkedTicketId, linkType, note, sessionUser?.id ?? null);

    // If linking as duplicate and one side is already resolved, resolve the other with the same note
    if (linkType === 'duplicate') {
      try {
        if (RESOLVED_STATUSES.has(linked.status) && !RESOLVED_STATUSES.has(primary.status) && linked.resolutionNote?.summary) {
          await TicketModel.resolve(id, 'Resolved', linked.resolutionNote, []).catch(() => {});
        } else if (RESOLVED_STATUSES.has(primary.status) && !RESOLVED_STATUSES.has(linked.status) && primary.resolutionNote?.summary) {
          await TicketModel.resolve(linkedTicketId, 'Resolved', primary.resolutionNote, []).catch(() => {});
        }
      } catch (err) {
        console.error('[linked-propagation] link-create propagation failed:', err.message);
      }
    }

    const allLinks = await TicketLinkModel.findByTicket(id);
    return res.status(201).json({ id: linkId, links: allLinks });
  },

  async delete(req, res) {
    const { linkId } = req.params;
    const deleted = await TicketLinkModel.delete(Number(linkId));
    if (!deleted) return res.status(404).json({ message: 'Link not found.' });
    return res.json({ ok: true });
  },
};
