import { pool } from '../config/database.js';
import { toMessageTimestamp } from '../utils/time.js';

function toJs(row) {
  return {
    id: row.id,
    author: row.author,
    role: row.role,
    content: row.content,
    timestamp: typeof row.created_at === 'string'
      ? row.created_at
      : toMessageTimestamp(new Date(row.created_at)),
    isInternal: Boolean(row.is_internal),
    attachments: row.attachments ?? [],
  };
}

export const MessageModel = {
  async findByTicketId(ticketId, includeInternal = true) {
    const sql = includeInternal
      ? 'SELECT * FROM messages WHERE ticket_id = ? ORDER BY created_at ASC'
      : 'SELECT * FROM messages WHERE ticket_id = ? AND is_internal = FALSE ORDER BY created_at ASC';
    const [rows] = await pool.query(sql, [ticketId]);
    return rows.map(toJs);
  },

  async create(ticketId, data) {
    const id = `${ticketId}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const now = new Date();
    await pool.query(
      `INSERT INTO messages (id, ticket_id, author, author_id, role, content, is_internal, attachments, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, ticketId, data.author, data.authorId ?? null, data.role,
        data.content, data.isInternal ? 1 : 0,
        JSON.stringify(data.attachments ?? []), now,
      ]
    );
    const [rows] = await pool.query('SELECT * FROM messages WHERE id = ?', [id]);
    return toJs(rows[0]);
  },
};
