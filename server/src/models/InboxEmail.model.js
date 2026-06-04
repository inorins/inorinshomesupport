import { pool } from '../config/database.js';

function toJs(row) {
  return {
    id: row.id,
    accountEmail: row.account_email,
    gmailUid: row.gmail_uid,
    messageId: row.message_id,
    senderName: row.sender_name,
    senderEmail: row.sender_email,
    replyTo: row.reply_to,
    subject: row.subject,
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    receivedAt: row.received_at,
    status: row.status,
    ticketId: row.ticket_id,
    processedBy: row.processed_by,
    processedAt: row.processed_at,
    createdAt: row.created_at,
  };
}

export const InboxEmailModel = {
  async findAll({ status, limit = 50, offset = 0 } = {}) {
    const where = status ? 'WHERE status = ?' : '';
    const params = status ? [status, limit, offset] : [limit, offset];
    const [rows] = await pool.query(
      `SELECT * FROM inbox_emails ${where} ORDER BY received_at DESC LIMIT ? OFFSET ?`,
      params
    );
    return rows.map(toJs);
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM inbox_emails WHERE id = ?', [id]);
    return rows[0] ? toJs(rows[0]) : null;
  },

  async countPending() {
    const [rows] = await pool.query("SELECT COUNT(*) AS cnt FROM inbox_emails WHERE status = 'pending'");
    return rows[0].cnt;
  },

  async upsert(data) {
    await pool.query(
      `INSERT INTO inbox_emails
        (account_email, gmail_uid, message_id, sender_name, sender_email, reply_to, subject, body_text, body_html, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE account_email = account_email`,
      [
        data.accountEmail, data.gmailUid, data.messageId ?? null, data.senderName ?? null,
        data.senderEmail, data.replyTo ?? null, data.subject ?? null,
        data.bodyText ?? null, data.bodyHtml ?? null, data.receivedAt,
      ]
    );
  },

  async markAsTicket(id, ticketId, processedBy) {
    await pool.query(
      `UPDATE inbox_emails SET status = 'ticket_created', ticket_id = ?, processed_by = ?, processed_at = NOW() WHERE id = ?`,
      [ticketId, processedBy, id]
    );
  },

  async dismiss(id, processedBy) {
    await pool.query(
      `UPDATE inbox_emails SET status = 'dismissed', processed_by = ?, processed_at = NOW() WHERE id = ?`,
      [processedBy, id]
    );
  },
};
