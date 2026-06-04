import { pool } from '../config/database.js';

function toJs(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id ?? null,
    userName: row.user_name ?? null,
    userEmail: row.user_email ?? null,
    role: row.role,
    department: row.department ?? null,
    canViewHistoricalTickets: Boolean(row.can_view_historical_tickets),
    historicalTicketDays: Number(row.historical_ticket_days),
    allowedBanks: row.allowed_banks ?? null,
    canViewOthersOpen: Boolean(row.can_view_others_open),
    canViewOthersInProgress: row.can_view_others_in_progress !== undefined ? Boolean(row.can_view_others_in_progress) : true,
    canViewOthersResolved: Boolean(row.can_view_others_resolved),
    canViewOthersClosed: Boolean(row.can_view_others_closed),
    canCreateTickets: Boolean(row.can_create_tickets),
    canAssignTickets: Boolean(row.can_assign_tickets),
    canUpdateTickets: Boolean(row.can_update_tickets),
    canCloseTickets: Boolean(row.can_close_tickets),
    canViewSystemChanges: row.can_view_system_changes !== undefined ? Boolean(row.can_view_system_changes) : true,
    canManageSystemChanges: row.can_manage_system_changes !== undefined ? Boolean(row.can_manage_system_changes) : true,
  };
}

const SELECT_SQL = `
  SELECT rp.*, u.name AS user_name, u.email AS user_email
  FROM role_permissions rp
  LEFT JOIN users u ON rp.user_id = u.id
`;

const PERM_COLS = `can_view_historical_tickets, historical_ticket_days, allowed_banks,
  can_view_others_open, can_view_others_in_progress, can_view_others_resolved, can_view_others_closed,
  can_create_tickets, can_assign_tickets, can_update_tickets, can_close_tickets,
  can_view_system_changes, can_manage_system_changes`;

function permVals(d) {
  return [
    d.canViewHistoricalTickets ? 1 : 0,
    d.historicalTicketDays ?? 365,
    d.allowedBanks ? JSON.stringify(d.allowedBanks) : null,
    d.canViewOthersOpen ? 1 : 0,
    d.canViewOthersInProgress !== false ? 1 : 0,
    d.canViewOthersResolved ? 1 : 0,
    d.canViewOthersClosed ? 1 : 0,
    d.canCreateTickets ? 1 : 0,
    d.canAssignTickets ? 1 : 0,
    d.canUpdateTickets ? 1 : 0,
    d.canCloseTickets ? 1 : 0,
    d.canViewSystemChanges !== false ? 1 : 0,
    d.canManageSystemChanges !== false ? 1 : 0,
  ];
}

const SET_COLS = `
  can_view_historical_tickets = ?,
  historical_ticket_days      = ?,
  allowed_banks               = ?,
  can_view_others_open        = ?,
  can_view_others_in_progress = ?,
  can_view_others_resolved    = ?,
  can_view_others_closed      = ?,
  can_create_tickets          = ?,
  can_assign_tickets          = ?,
  can_update_tickets          = ?,
  can_close_tickets           = ?,
  can_view_system_changes     = ?,
  can_manage_system_changes   = ?`;

export const PermissionModel = {
  async findAll() {
    const [rows] = await pool.query(
      `${SELECT_SQL} ORDER BY rp.user_id IS NULL DESC, rp.role, rp.department, u.name`
    );
    return rows.map(toJs);
  },

  async findById(id) {
    const [rows] = await pool.query(`${SELECT_SQL} WHERE rp.id = ?`, [id]);
    return rows[0] ? toJs(rows[0]) : null;
  },

  async findByUser(userId) {
    const [rows] = await pool.query(`${SELECT_SQL} WHERE rp.user_id = ?`, [userId]);
    return rows[0] ? toJs(rows[0]) : null;
  },

  async findByRoleDept(role, department) {
    const [rows] = await pool.query(
      `${SELECT_SQL} WHERE rp.role = ? AND rp.user_id IS NULL
       AND (rp.department = ? OR rp.department IS NULL)
       ORDER BY rp.department DESC LIMIT 1`,
      [role, department ?? null]
    );
    return rows[0] ? toJs(rows[0]) : null;
  },

  /** Upsert a user-specific permission rule. */
  async upsertForUser(userId, role, data) {
    const [existing] = await pool.query(
      `SELECT id FROM role_permissions WHERE user_id = ?`, [userId]
    );
    if (existing.length > 0) {
      await pool.query(
        `UPDATE role_permissions SET role = ?, ${SET_COLS} WHERE id = ?`,
        [role, ...permVals(data), existing[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO role_permissions (user_id, role, ${PERM_COLS}) VALUES (?, ?, ${permVals(data).map(() => '?').join(', ')})`,
        [userId, role, ...permVals(data)]
      );
    }
    return PermissionModel.findByUser(userId);
  },

  /** Upsert a role/department-level permission rule. */
  async upsertForRole(role, department, data) {
    const deptClause = department ? 'department = ?' : 'department IS NULL';
    const deptParams = department ? [role, department] : [role];
    const [existing] = await pool.query(
      `SELECT id FROM role_permissions WHERE role = ? AND ${deptClause} AND user_id IS NULL`,
      deptParams
    );
    if (existing.length > 0) {
      await pool.query(
        `UPDATE role_permissions SET ${SET_COLS} WHERE id = ?`,
        [...permVals(data), existing[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO role_permissions (user_id, role, department, ${PERM_COLS}) VALUES (NULL, ?, ?, ${permVals(data).map(() => '?').join(', ')})`,
        [role, department ?? null, ...permVals(data)]
      );
    }
    return PermissionModel.findByRoleDept(role, department);
  },

  async delete(id) {
    const [result] = await pool.query('DELETE FROM role_permissions WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};
