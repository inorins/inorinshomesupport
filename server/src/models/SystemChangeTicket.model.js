import { pool } from '../config/database.js';

const SELECT_FOR_CHANGE = `
  SELECT sct.id, sct.change_id, sct.ticket_id, sct.note, sct.created_at,
    u.name  AS linked_by_name,
    t.title AS ticket_title, t.status AS ticket_status,
    t.priority AS ticket_priority, t.bank_name AS ticket_bank_name,
    t.system AS ticket_system, t.module AS ticket_module
  FROM system_change_tickets sct
  LEFT JOIN users u   ON sct.linked_by = u.id
  LEFT JOIN tickets t ON sct.ticket_id = t.id
  WHERE sct.change_id = ?
  ORDER BY sct.created_at DESC
`;

const SELECT_FOR_TICKET = `
  SELECT sct.id, sct.change_id, sct.ticket_id, sct.note, sct.created_at,
    u.name    AS linked_by_name,
    sc.title  AS change_title, sc.status AS change_status,
    sc.system AS change_system, sc.module AS change_module
  FROM system_change_tickets sct
  LEFT JOIN users u          ON sct.linked_by = u.id
  LEFT JOIN system_changes sc ON sct.change_id = sc.id
  WHERE sct.ticket_id = ?
  ORDER BY sct.created_at DESC
`;

export const SystemChangeTicketModel = {
  async findByChange(changeId) {
    const [rows] = await pool.query(SELECT_FOR_CHANGE, [changeId]);
    return rows.map((r) => ({
      id: r.id,
      changeId: r.change_id,
      ticketId: r.ticket_id,
      note: r.note ?? null,
      linkedBy: r.linked_by_name ?? null,
      createdAt: r.created_at,
      ticket: {
        id: r.ticket_id,
        title: r.ticket_title,
        status: r.ticket_status,
        priority: r.ticket_priority,
        bankName: r.ticket_bank_name,
        system: r.ticket_system,
        module: r.ticket_module,
      },
    }));
  },

  async findByTicket(ticketId) {
    const [rows] = await pool.query(SELECT_FOR_TICKET, [ticketId]);
    return rows.map((r) => ({
      id: r.id,
      changeId: r.change_id,
      ticketId: r.ticket_id,
      note: r.note ?? null,
      linkedBy: r.linked_by_name ?? null,
      createdAt: r.created_at,
      change: {
        id: r.change_id,
        title: r.change_title,
        status: r.change_status,
        system: r.change_system,
        module: r.change_module,
      },
    }));
  },

  async link(changeId, ticketId, note, userId) {
    await pool.query(
      `INSERT INTO system_change_tickets (change_id, ticket_id, note, linked_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE note = VALUES(note), linked_by = VALUES(linked_by)`,
      [changeId, ticketId, note ?? null, userId ?? null]
    );
    const [rows] = await pool.query(SELECT_FOR_CHANGE, [changeId]);
    return rows.map((r) => ({
      id: r.id, changeId: r.change_id, ticketId: r.ticket_id,
      note: r.note ?? null, linkedBy: r.linked_by_name ?? null, createdAt: r.created_at,
      ticket: { id: r.ticket_id, title: r.ticket_title, status: r.ticket_status, priority: r.ticket_priority, bankName: r.ticket_bank_name },
    }));
  },

  async unlink(changeId, ticketId) {
    const [result] = await pool.query(
      `DELETE FROM system_change_tickets WHERE change_id = ? AND ticket_id = ?`,
      [changeId, ticketId]
    );
    return result.affectedRows > 0;
  },
};
