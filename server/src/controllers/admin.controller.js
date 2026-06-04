import { UserModel } from '../models/User.model.js';
import { hashPassword } from '../utils/crypto.js';
import { pool } from '../config/database.js';

const ROLES = new Set(['inorins', 'client']);

async function requireSuperAdmin(req, res) {
  const user = await UserModel.findById(req.sessionUser.id);
  if (!user || user.email?.toLowerCase() !== 'inorins@inorins.com') {
    res.status(403).json({ message: 'Access denied.' });
    return null;
  }
  return user;
}

export const AdminController = {
  async listUsers(req, res) {
    if (!(await requireSuperAdmin(req, res))) return;
    return res.json(await UserModel.findAll());
  },

  async createUser(req, res) {
    if (!(await requireSuperAdmin(req, res))) return;
    const { name, email, password, role, title, department, bankName, bankDomain, bankShortCode, isDepartmentHead, defaultMail } = req.body ?? {};
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required.' });
    }
    if (!ROLES.has(role)) return res.status(400).json({ message: 'Invalid role.' });
    if (String(password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await UserModel.findByEmail(normalizedEmail);
    if (existing) return res.status(409).json({ message: 'A user with this email already exists.' });

    const newUser = await UserModel.create({
      name: String(name).trim().slice(0, 100),
      email: normalizedEmail,
      password_hash: await hashPassword(password),
      role,
      title: String(title ?? '').trim().slice(0, 100),
      department: role === 'inorins' ? String(department ?? '').trim().slice(0, 100) || null : null,
      is_active: true,
      is_department_head: role === 'inorins' && Boolean(isDepartmentHead),
      default_mail: String(defaultMail ?? '').trim().toLowerCase() || null,
      bank_name: role === 'client' ? String(bankName ?? '').trim() : null,
      bank_domain: role === 'client' ? String(bankDomain ?? '').trim().toLowerCase() : null,
      bank_short_code: role === 'client' ? String(bankShortCode ?? '').trim() : null,
    });
    return res.status(201).json(newUser);
  },

  async updateUser(req, res) {
    if (!(await requireSuperAdmin(req, res))) return;
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const { name, email, role, title, department, bankName, bankDomain, bankShortCode, isActive, isDepartmentHead, defaultMail } = req.body ?? {};
    const updates = {};
    if (name) updates.name = String(name).trim().slice(0, 100);
    if (email) updates.email = String(email).trim().toLowerCase();
    if (role && ROLES.has(role)) updates.role = role;
    if (title !== undefined) updates.title = String(title).trim().slice(0, 100);
    if (department !== undefined) updates.department = String(department).trim().slice(0, 100) || null;
    if (bankName !== undefined) updates.bank_name = String(bankName).trim();
    if (bankDomain !== undefined) updates.bank_domain = String(bankDomain).trim().toLowerCase();
    if (bankShortCode !== undefined) updates.bank_short_code = String(bankShortCode).trim();
    if (isActive !== undefined) updates.is_active = Boolean(isActive);
    if (isDepartmentHead !== undefined) updates.is_department_head = Boolean(isDepartmentHead);
    if (defaultMail !== undefined) updates.default_mail = String(defaultMail).trim().toLowerCase() || null;

    const updated = await UserModel.update(req.params.id, updates);
    return res.json(updated);
  },

  async resetPassword(req, res) {
    if (!(await requireSuperAdmin(req, res))) return;
    const { newPassword } = req.body ?? {};
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    await UserModel.update(req.params.id, { password_hash: await hashPassword(String(newPassword)) });
    return res.json({ message: 'Password reset successfully.' });
  },

  async deactivateUser(req, res) {
    if (!(await requireSuperAdmin(req, res))) return;
    if (req.params.id == req.sessionUser.id) {
      return res.status(400).json({ message: 'Cannot deactivate your own account.' });
    }
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    await UserModel.update(req.params.id, { is_active: false });
    return res.json({ message: 'User deactivated.' });
  },

  async listSessions(req, res) {
    if (!(await requireSuperAdmin(req, res))) return;
    const [rows] = await pool.query(
      `SELECT s.id, s.user_id, s.ip_address, s.user_agent, s.created_at, s.last_seen_at,
              u.name AS user_name, u.email AS user_email, u.role
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       ORDER BY s.last_seen_at DESC
       LIMIT 200`
    );
    return res.json(rows);
  },

  async revokeSession(req, res) {
    if (!(await requireSuperAdmin(req, res))) return;
    const { id } = req.params;
    await pool.query('DELETE FROM user_sessions WHERE id = ?', [id]);
    return res.json({ ok: true });
  },

  async revokeAllSessions(req, res) {
    if (!(await requireSuperAdmin(req, res))) return;
    const { userId } = req.params;
    await pool.query('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
    return res.json({ ok: true });
  },

  async getAuditLogs(req, res) {
    if (!(await requireSuperAdmin(req, res))) return;
    const page   = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit ?? '50', 10)));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (req.query.action)      { conditions.push('a.action = ?');           params.push(req.query.action); }
    if (req.query.entityType)  { conditions.push('a.entity_type = ?');      params.push(req.query.entityType); }
    if (req.query.entityId)    { conditions.push('a.entity_id = ?');        params.push(req.query.entityId); }
    if (req.query.userEmail)   { conditions.push('a.user_email LIKE ?');    params.push(`%${req.query.userEmail}%`); }
    if (req.query.dateFrom)    { conditions.push('DATE(a.created_at) >= ?'); params.push(req.query.dateFrom); }
    if (req.query.dateTo)      { conditions.push('DATE(a.created_at) <= ?'); params.push(req.query.dateTo); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM audit_logs a ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id,
              a.user_email, a.old_values, a.new_values, a.created_at
       FROM audit_logs a
       ${where}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({ logs: rows, total: Number(total), page, limit });
  },
};
