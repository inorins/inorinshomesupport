import { pool } from '../config/database.js';

export const TicketLinkModel = {
  async findByTicket(ticketId) {
    const [rows] = await pool.query(
      `SELECT tl.*,
        t1.title AS primary_title, t1.status AS primary_status, t1.priority AS primary_priority, t1.bank_name AS primary_bank,
        t2.title AS linked_title,  t2.status AS linked_status,  t2.priority AS linked_priority,  t2.bank_name AS linked_bank,
        u.name AS linked_by_name
       FROM ticket_links tl
       JOIN tickets t1 ON tl.primary_ticket_id = t1.id
       JOIN tickets t2 ON tl.linked_ticket_id  = t2.id
       LEFT JOIN users u ON tl.linked_by = u.id
       WHERE tl.primary_ticket_id = ? OR tl.linked_ticket_id = ?
       ORDER BY tl.created_at DESC`,
      [ticketId, ticketId]
    );
    return rows.map((r) => ({
      id: r.id,
      primaryTicketId: r.primary_ticket_id,
      linkedTicketId: r.linked_ticket_id,
      linkType: r.link_type,
      note: r.note,
      linkedBy: r.linked_by_name,
      createdAt: r.created_at,
      primaryTicket: { id: r.primary_ticket_id, title: r.primary_title, status: r.primary_status, priority: r.primary_priority, bankName: r.primary_bank },
      linkedTicket:  { id: r.linked_ticket_id,  title: r.linked_title,  status: r.linked_status,  priority: r.linked_priority,  bankName: r.linked_bank  },
    }));
  },

  async create(primaryTicketId, linkedTicketId, linkType, note, linkedBy) {
    const [result] = await pool.query(
      `INSERT INTO ticket_links (primary_ticket_id, linked_ticket_id, link_type, note, linked_by)
       VALUES (?, ?, ?, ?, ?)`,
      [primaryTicketId, linkedTicketId, linkType ?? 'related', note ?? null, linkedBy ?? null]
    );
    return result.insertId;
  },

  async delete(id) {
    const [result] = await pool.query('DELETE FROM ticket_links WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async exists(primaryTicketId, linkedTicketId) {
    const [rows] = await pool.query(
      `SELECT id FROM ticket_links
       WHERE (primary_ticket_id = ? AND linked_ticket_id = ?)
          OR (primary_ticket_id = ? AND linked_ticket_id = ?)`,
      [primaryTicketId, linkedTicketId, linkedTicketId, primaryTicketId]
    );
    return rows.length > 0;
  },
};
