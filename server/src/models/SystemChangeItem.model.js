import { pool } from '../config/database.js';

function toJs(row) {
  if (!row) return null;
  return {
    id: row.id,
    changeId: row.change_id,
    sortOrder: row.sort_order,
    changeType: row.change_type,
    objectName: row.object_name,
    beforeState: row.before_state,
    afterState: row.after_state,
    attachmentName: row.attachment_name ?? undefined,
    attachmentUrl: row.attachment_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const SystemChangeItemModel = {
  async findByChange(changeId) {
    const [rows] = await pool.query(
      `SELECT * FROM system_change_items WHERE change_id = ? ORDER BY sort_order ASC, id ASC`,
      [changeId]
    );
    return rows.map(toJs);
  },

  async create(changeId, data) {
    const [rows] = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM system_change_items WHERE change_id = ?`,
      [changeId]
    );
    const sortOrder = rows[0].next_order ?? 0;
    const [result] = await pool.query(
      `INSERT INTO system_change_items (change_id, sort_order, change_type, object_name, before_state, after_state)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [changeId, sortOrder, data.changeType ?? null, data.objectName ?? null, data.beforeState ?? null, data.afterState ?? null]
    );
    const [inserted] = await pool.query(`SELECT * FROM system_change_items WHERE id = ?`, [result.insertId]);
    return toJs(inserted[0]);
  },

  async update(id, data) {
    const sets = [];
    const vals = [];
    if (data.changeType !== undefined) { sets.push('change_type = ?'); vals.push(data.changeType); }
    if (data.objectName !== undefined) { sets.push('object_name = ?'); vals.push(data.objectName); }
    if (data.beforeState !== undefined) { sets.push('before_state = ?'); vals.push(data.beforeState); }
    if (data.afterState !== undefined) { sets.push('after_state = ?'); vals.push(data.afterState); }
    if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); vals.push(data.sortOrder); }
    if (sets.length === 0) {
      const [rows] = await pool.query(`SELECT * FROM system_change_items WHERE id = ?`, [id]);
      return rows[0] ? toJs(rows[0]) : null;
    }
    vals.push(id);
    await pool.query(`UPDATE system_change_items SET ${sets.join(', ')} WHERE id = ?`, vals);
    const [rows] = await pool.query(`SELECT * FROM system_change_items WHERE id = ?`, [id]);
    return rows[0] ? toJs(rows[0]) : null;
  },

  async delete(id) {
    const [result] = await pool.query(`DELETE FROM system_change_items WHERE id = ?`, [id]);
    return result.affectedRows > 0;
  },

  /** Replace all items for a change in one call (used by set-all). */
  async setAll(changeId, items) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`DELETE FROM system_change_items WHERE change_id = ?`, [changeId]);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await conn.query(
          `INSERT INTO system_change_items (change_id, sort_order, change_type, object_name, before_state, after_state, attachment_name, attachment_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [changeId, i, item.changeType ?? null, item.objectName ?? null, item.beforeState ?? null, item.afterState ?? null, item.attachmentName ?? null, item.attachmentUrl ?? null]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return SystemChangeItemModel.findByChange(changeId);
  },
};
