import { Router } from 'express';
import { TicketController } from '../controllers/ticket.controller.js';
import { TicketLinkController } from '../controllers/ticket-link.controller.js';
import { SystemChangeController } from '../controllers/system-change.controller.js';
import { WatcherController } from '../controllers/watcher.controller.js';
import { requireAdmin, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', TicketController.list);
router.post('/', TicketController.create);
router.post('/bulk', TicketController.bulkUpdate);
router.get('/stats', TicketController.getStats);
router.get('/stats/breakdown', TicketController.getStatsBreakdown);
router.get('/archive', TicketController.getArchive);
router.get('/board-all', requireRole('inorins'), TicketController.listAll);
router.get('/:id', TicketController.getById);
router.patch('/:id/status', TicketController.updateStatus);
router.patch('/:id/resolve', TicketController.resolve);
router.patch('/:id/assign', TicketController.assign);
router.patch('/:id/forward', TicketController.forward);
router.delete('/:id/forward', TicketController.clearForward);
router.patch('/:id/edit', TicketController.editByClient);
router.patch('/:id/reopen', TicketController.reopen);

// Ticket linking (staff only)
router.get('/:id/links', requireAdmin, TicketLinkController.list);
router.post('/:id/links', requireAdmin, TicketLinkController.create);
router.delete('/:id/links/:linkId', requireAdmin, TicketLinkController.delete);

// Watchers
router.get('/:ticketId/watchers', WatcherController.list);
router.post('/:ticketId/watchers', WatcherController.add);
router.delete('/:ticketId/watchers/:userId', WatcherController.remove);

// System change links from ticket side
router.get('/:ticketId/system-changes', requireRole('inorins'), SystemChangeController.listForTicket);
router.post('/:ticketId/system-changes', requireRole('inorins'), SystemChangeController.linkFromTicket);
router.delete('/:ticketId/system-changes/:changeId', requireRole('inorins'), SystemChangeController.unlinkFromTicket);

export default router;
