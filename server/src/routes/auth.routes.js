import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', AuthController.login);
router.get('/demo-users', AuthController.getDemoUsers);
router.get('/users/:id', AuthController.getUser);
router.post('/change-password', AuthController.changePassword);
router.get('/me/permissions', AuthController.myPermissions);

export default router;
