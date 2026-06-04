import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { InboxController } from '../controllers/inbox.controller.js';

const router = Router();

router.use(requireRole('inorins'));
router.get('/', InboxController.list);
router.post('/sync', InboxController.sync);
router.post('/:id/to-ticket', InboxController.toTicket);
router.delete('/:id', InboxController.dismiss);

export default router;
