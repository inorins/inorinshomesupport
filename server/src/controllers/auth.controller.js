import crypto from 'crypto';
import { UserModel } from '../models/User.model.js';
import { verifyPassword, hashPassword } from '../utils/crypto.js';
import { createSessionToken, getSessionUser } from '../utils/token.js';
import { getEffectivePermissions, isSuperAdmin } from '../services/permission.service.js';
import { pool } from '../config/database.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const AuthController = {
  async login(req, res) {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const user = await UserModel.findByEmail(email.trim());
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    if (user.is_active === 0 || user.is_active === false) {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact an administrator.' });
    }
    const safe = UserModel.sanitize(user);
    const token = createSessionToken(user);
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().slice(0, 45);
    const ua = (req.headers['user-agent'] || '').slice(0, 500);
    pool.query(
      `INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE last_seen_at = NOW()`,
      [user.id, hashToken(token), ip, ua]
    ).catch(() => {});
    return res.json({ user: safe, token });
  },

  async getUser(req, res) {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json(UserModel.sanitize(user));
  },

  async getDemoUsers(_req, res) {
    const users = await UserModel.findAll();
    return res.json(users);
  },

  async changePassword(req, res) {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ message: 'Authentication required.' });

    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ message: 'Current and new password are required.' });
    }
    if (newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    if (newPassword.length > 128) return res.status(400).json({ message: 'New password must be at most 128 characters.' });

    const user = await UserModel.findById(sessionUser.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect.' });

    await UserModel.update(user.id, { password_hash: await hashPassword(newPassword) });
    return res.json({ message: 'Password changed successfully.' });
  },

  async myPermissions(req, res) {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ message: 'Authentication required.' });
    const userRecord = await UserModel.findById(sessionUser.id);
    if (!userRecord) return res.status(404).json({ message: 'User not found.' });
    // Super-admin gets all permissions unrestricted
    if (isSuperAdmin(sessionUser, userRecord.email)) {
      return res.json({
        canViewHistoricalTickets: true, historicalTicketDays: 3650, allowedBanks: null,
        canViewOthersOpen: true, canViewOthersInProgress: true,
        canViewOthersResolved: true, canViewOthersClosed: true,
        canCreateTickets: true, canAssignTickets: true,
        canUpdateTickets: true, canCloseTickets: true,
        canViewSystemChanges: true, canManageSystemChanges: true,
      });
    }
    const perms = await getEffectivePermissions(sessionUser.id, sessionUser.role, userRecord.department ?? null);
    return res.json(perms);
  },
};
