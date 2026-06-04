import { pool } from '../config/database.js';
import { SystemChangeItemModel } from './SystemChangeItem.model.js';

function toJs(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    system: row.system,
    module: row.module,
    bankName: row.bank_name,
    status: row.status,
    changeType: row.change_type,
    objectName: row.object_name,
    beforeState: row.before_state,
    afterState: row.after_state,
    createdBy: row.created_by_name,
    createdById: row.created_by,
    updatedBy: row.updated_by_name,
    updatedById: row.updated_by,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_SQL = `
  SELECT sc.*,
    cu.name AS created_by_name,
    uu.name AS updated_by_name
  FROM system_changes sc
  LEFT JOIN users cu ON sc.created_by = cu.id
  LEFT JOIN users uu ON sc.updated_by = uu.id
`;

export const SystemChangeModel = {
  async findAll(filters = {}) {
    const conditions = [];
    const vals = [];
    if (filters.status) { conditions.push('sc.status = ?'); vals.push(filters.status); }
    if (filters.system) { conditions.push('sc.`system` = ?'); vals.push(filters.system); }
    if (filters.bankName) { conditions.push('sc.bank_name = ?'); vals.push(filters.bankName); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(`${SELECT_SQL} ${where} ORDER BY sc.created_at DESC`, vals);
    const changes = rows.map(toJs);
    // Attach items for each change
    await Promise.all(changes.map(async (c) => {
      c.items = await SystemChangeItemModel.findByChange(c.id);
    }));
    return changes;
  },

  async findById(id) {
    const [rows] = await pool.query(`${SELECT_SQL} WHERE sc.id = ?`, [id]);
    if (!rows[0]) return null;
    const change = toJs(rows[0]);
    change.items = await SystemChangeItemModel.findByChange(change.id);
    return change;
  },

  async create(data, userId) {
    const [result] = await pool.query(
      `INSERT INTO system_changes (title, description, \`system\`, module, bank_name, status, change_type, object_name, before_state, after_state, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title, data.description ?? null,
        data.system ?? null, data.module ?? null,
        data.bankName ?? null, data.status ?? 'Not Started',
        data.changeType ?? null, data.objectName ?? null,
        data.beforeState ?? null, data.afterState ?? null,
        userId ?? null, userId ?? null,
      ]
    );
    return SystemChangeModel.findById(result.insertId);
  },

  async update(id, data, userId) {
    const allowed = ['title', 'description', 'system', 'module', 'bank_name', 'status', 'change_type', 'object_name', 'before_state', 'after_state'];
    const sets = ['updated_by = ?'];
    const vals = [userId ?? null];
    const snakeToJs = {
      bank_name: 'bankName', change_type: 'changeType',
      object_name: 'objectName', before_state: 'beforeState', after_state: 'afterState',
    };
    for (const key of allowed) {
      const jsKey = snakeToJs[key] ?? key;
      if (data[jsKey] !== undefined || data[key] !== undefined) {
        const val = data[jsKey] ?? data[key];
        const col = key === 'system' ? '`system`' : key;
        sets.push(`${col} = ?`);
        vals.push(val);
      }
    }
    if (data.status === 'Completed') {
      sets.push('completed_at = IFNULL(completed_at, NOW())');
    } else if (data.status && data.status !== 'Completed') {
      sets.push('completed_at = NULL');
    }
    vals.push(id);
    await pool.query(`UPDATE system_changes SET ${sets.join(', ')} WHERE id = ?`, vals);
    return SystemChangeModel.findById(id);
  },

  async delete(id) {
    const [result] = await pool.query('DELETE FROM system_changes WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};
