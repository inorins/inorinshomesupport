import { Router } from 'express';
import { SystemChangeController } from '../controllers/system-change.controller.js';
import { requireAdmin, requireRole } from '../middleware/auth.js';

const router = Router();

// All inorins staff can read system changes
router.get('/', requireRole('inorins'), SystemChangeController.list);
router.get('/:id', requireRole('inorins'), SystemChangeController.getById);

// All inorins staff can write — canManageSystemChanges is checked in the controller
router.post('/', requireRole('inorins'), SystemChangeController.create);
router.patch('/:id', requireRole('inorins'), SystemChangeController.update);
router.delete('/:id', requireRole('inorins'), SystemChangeController.delete);

// Bank tracking — all inorins staff
router.get('/:id/banks', requireRole('inorins'), SystemChangeController.listBanks);
router.put('/:id/banks', requireRole('inorins'), SystemChangeController.setBanks);
router.patch('/:id/banks/:bankName', requireRole('inorins'), SystemChangeController.updateBank);
router.delete('/:id/banks/:bankName', requireRole('inorins'), SystemChangeController.deleteBank);

// Sub-items — all inorins staff
router.get('/:id/items', requireRole('inorins'), SystemChangeController.listItems);
router.put('/:id/items', requireRole('inorins'), SystemChangeController.setItems);
router.post('/:id/items', requireRole('inorins'), SystemChangeController.createItem);
router.patch('/:id/items/:itemId', requireRole('inorins'), SystemChangeController.updateItem);
router.delete('/:id/items/:itemId', requireRole('inorins'), SystemChangeController.deleteItem);

// Ticket links — all inorins staff can read, write is permission-checked in controller
router.get('/:id/tickets', requireRole('inorins'), SystemChangeController.listTickets);
router.post('/:id/tickets', requireRole('inorins'), SystemChangeController.linkTicket);
router.delete('/:id/tickets/:ticketId', requireRole('inorins'), SystemChangeController.unlinkTicket);

export default router;
