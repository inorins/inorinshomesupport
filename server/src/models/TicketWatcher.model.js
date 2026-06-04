import { pool } from '../config/database.js';

export const TicketWatcherModel = {
  async findByTicket(ticketId) {
    const [rows] = await pool.query(
      `SELECT tw.id, tw.ticket_id, tw.user_id, tw.added_at,
              u.name AS user_name, u.email AS user_email
       FROM ticket_watchers tw
       JOIN users u ON u.id = tw.user_id
       WHERE tw.ticket_id = ?
       ORDER BY tw.added_at ASC`,
      [ticketId]
    );
    return rows.map((r) => ({
      id: r.id,
      ticketId: r.ticket_id,
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      addedAt: r.added_at,
    }));
  },

  async findByUser(userId) {
    const [rows] = await pool.query(
      `SELECT ticket_id FROM ticket_watchers WHERE user_id = ?`,
      [userId]
    );
    return rows.map((r) => r.ticket_id);
  },

  async add(ticketId, userId) {
    await pool.query(
      `INSERT IGNORE INTO ticket_watchers (ticket_id, user_id) VALUES (?, ?)`,
      [ticketId, userId]
    );
  },

  async remove(ticketId, userId) {
    await pool.query(
      `DELETE FROM ticket_watchers WHERE ticket_id = ? AND user_id = ?`,
      [ticketId, userId]
    );
  },

  async isWatching(ticketId, userId) {
    const [rows] = await pool.query(
      `SELECT 1 FROM ticket_watchers WHERE ticket_id = ? AND user_id = ? LIMIT 1`,
      [ticketId, userId]
    );
    return rows.length > 0;
  },

  async getWatcherUserIds(ticketId) {
    const [rows] = await pool.query(
      `SELECT user_id FROM ticket_watchers WHERE ticket_id = ?`,
      [ticketId]
    );
    return rows.map((r) => r.user_id);
  },
};
