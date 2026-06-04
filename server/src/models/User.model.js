import { pool } from '../config/database.js';

function sanitize(user) {
  if (!user) return null;
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title ?? null,
    department: user.department ?? null,
    isActive: Boolean(user.is_active ?? user.isActive ?? true),
    isDepartmentHead: Boolean(user.is_department_head ?? user.isDepartmentHead ?? false),
    defaultMail: user.default_mail ?? user.defaultMail ?? null,
    bankName: user.bank_name ?? user.bankName ?? null,
    bankDomain: user.bank_domain ?? user.bankDomain ?? null,
    bankShortCode: user.bank_short_code ?? user.bankShortCode ?? null,
  };
}

/** Returns the address to deliver outgoing email to — prefers default_mail over email. */
export function deliveryAddress(user) {
  return user?.default_mail || user?.defaultMail || user?.email || null;
}

export const UserModel = {
  async findAll() {
    const [rows] = await pool.query('SELECT * FROM users ORDER BY created_at ASC');
    return rows.map(sanitize);
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] ?? null;
  },

  async findByExternalId(externalId) {
    const [rows] = await pool.query('SELECT * FROM users WHERE external_id = ?', [externalId]);
    return rows[0] ?? null;
  },

  async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    return rows[0] ?? null;
  },

  async findDepartmentHeads() {
    try {
      const [rows] = await pool.query(
        'SELECT email, name, default_mail FROM users WHERE is_department_head = TRUE AND is_active = TRUE'
      );
      return rows;
    } catch (err) {
      // Graceful fallback if default_mail column hasn't been added yet
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        const [rows] = await pool.query(
          'SELECT email, name FROM users WHERE is_department_head = TRUE AND is_active = TRUE'
        );
        return rows;
      }
      throw err;
    }
  },

  async findByDomain(domain) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE LOWER(bank_domain) = LOWER(?)',
      [domain]
    );
    return rows[0] ?? null;
  },

  async create(data) {
    const {
      external_id, name, email, password_hash, role, title, department,
      is_active = true, is_department_head = false, default_mail,
      bank_name, bank_domain, bank_short_code,
    } = data;
    const [result] = await pool.query(
      `INSERT INTO users
        (external_id, name, email, password_hash, role, title, department, is_active, is_department_head,
         default_mail, bank_name, bank_domain, bank_short_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [external_id ?? null, name, email, password_hash, role, title ?? null, department ?? null,
       is_active, is_department_head, default_mail ?? null,
       bank_name ?? null, bank_domain ?? null, bank_short_code ?? null]
    );
    return UserModel.findById(result.insertId);
  },

  async update(id, data) {
    const allowed = ['name', 'email', 'password_hash', 'role', 'title', 'department', 'is_active',
      'is_department_head', 'default_mail', 'bank_name', 'bank_domain', 'bank_short_code'];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (key in data) {
        sets.push(`${key} = ?`);
        vals.push(data[key]);
      }
    }
    if (sets.length === 0) return UserModel.findById(id);
    vals.push(id);
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
    return UserModel.findById(id);
  },

  sanitize,
};
