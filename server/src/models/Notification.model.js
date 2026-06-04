import { pool } from '../config/database.js';

function toJs(row) {
  return {
    id: row.id,
    type: row.type,
    ticketId: row.ticket_id,
    ticketTitle: row.ticket_title,
    message: row.message,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  };
}

export const NotificationModel = {
  async findByUserId(userId) {
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [userId]
    );
    return rows.map(toJs);
  },

  async create(userId, type, ticketId, ticketTitle, message) {
    const id = `notif-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    await pool.query(
      `INSERT INTO notifications (id, user_id, type, ticket_id, ticket_title, message, is_read)
       VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
      [id, userId, type, ticketId, ticketTitle, message]
    );
    // Keep max 100 per user
    await pool.query(
      `DELETE FROM notifications WHERE user_id = ? AND id NOT IN (
         SELECT id FROM (
           SELECT id FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100
         ) sub
       )`,
      [userId, userId]
    );
  },

  async markAllRead(userId) {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [userId]);
  },

  async markOneRead(userId, notifId) {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND id = ?', [userId, notifId]);
  },
};
