import { pool } from '../config/database.js';

function toJs(row) {
  return {
    id: row.id,
    changeId: row.change_id,
    bankName: row.bank_name,
    status: row.status,
    note: row.note ?? null,
    updatedBy: row.updater_name ?? null,
    updatedAt: row.updated_at,
  };
}

export const SystemChangeBankModel = {
  async findByChange(changeId) {
    const [rows] = await pool.query(
      `SELECT scb.*, u.name AS updater_name
       FROM system_change_banks scb
       LEFT JOIN users u ON scb.updated_by = u.id
       WHERE scb.change_id = ?
       ORDER BY scb.bank_name ASC`,
      [changeId]
    );
    return rows.map(toJs);
  },

  /** Upsert a single bank entry. */
  async upsert(changeId, bankName, status, note, userId) {
    await pool.query(
      `INSERT INTO system_change_banks (change_id, bank_name, status, note, updated_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note), updated_by = VALUES(updated_by)`,
      [changeId, bankName, status, note ?? null, userId ?? null]
    );
    const [rows] = await pool.query(
      `SELECT scb.*, u.name AS updater_name
       FROM system_change_banks scb
       LEFT JOIN users u ON scb.updated_by = u.id
       WHERE scb.change_id = ? AND scb.bank_name = ?`,
      [changeId, bankName]
    );
    return rows[0] ? toJs(rows[0]) : null;
  },

  /** Replace the full bank list for a change. */
  async setAll(changeId, banks, userId) {
    // banks: Array<{ bankName, status, note? }>
    if (!banks.length) {
      await pool.query('DELETE FROM system_change_banks WHERE change_id = ?', [changeId]);
      return [];
    }
    const values = banks.map((b) => [changeId, b.bankName, b.status ?? 'Pending', b.note ?? null, userId ?? null]);
    // Delete banks not in the new list
    const names = banks.map((b) => b.bankName);
    await pool.query(
      `DELETE FROM system_change_banks WHERE change_id = ? AND bank_name NOT IN (${names.map(() => '?').join(',')})`,
      [changeId, ...names]
    );
    for (const v of values) {
      await pool.query(
        `INSERT INTO system_change_banks (change_id, bank_name, status, note, updated_by)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note), updated_by = VALUES(updated_by)`,
        v
      );
    }
    return SystemChangeBankModel.findByChange(changeId);
  },

  async delete(changeId, bankName) {
    const [result] = await pool.query(
      'DELETE FROM system_change_banks WHERE change_id = ? AND bank_name = ?',
      [changeId, bankName]
    );
    return result.affectedRows > 0;
  },
};
