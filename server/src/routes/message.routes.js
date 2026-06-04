import { Router } from 'express';
import { MessageController } from '../controllers/message.controller.js';

const router = Router({ mergeParams: true });

router.get('/', MessageController.list);
router.post('/', MessageController.create);

export default router;
