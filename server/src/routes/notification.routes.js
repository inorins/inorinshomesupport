import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { NotificationController } from '../controllers/notification.controller.js';

const router = Router();

router.get('/', requireAuth, NotificationController.list);
router.patch('/read-all', requireAuth, NotificationController.markAllRead);
router.patch('/:id/read', requireAuth, NotificationController.markOneRead);

export default router;
