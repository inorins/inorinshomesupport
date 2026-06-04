import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { AdminController } from '../controllers/admin.controller.js';
import { PermissionController } from '../controllers/permission.controller.js';

const router = Router();

router.use(requireAdmin);
router.get('/users', AdminController.listUsers);
router.post('/users', AdminController.createUser);
router.patch('/users/:id', AdminController.updateUser);
router.patch('/users/:id/reset-password', AdminController.resetPassword);
router.delete('/users/:id', AdminController.deactivateUser);

// Role-based permissions
router.get('/permissions', PermissionController.list);
router.put('/permissions', PermissionController.upsert);
router.delete('/permissions/:id', PermissionController.delete);

// Session management
router.get('/sessions', AdminController.listSessions);
router.delete('/sessions/:id', AdminController.revokeSession);
router.delete('/sessions/user/:userId', AdminController.revokeAllSessions);

// Audit logs
router.get('/audit-logs', AdminController.getAuditLogs);

export default router;
