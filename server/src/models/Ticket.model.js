import { pool } from '../config/database.js';
import { withLastUpdated } from '../utils/time.js';

function toJs(row) {
  if (!row) return null;
  return {
    id: row.id,
    source: row.source ?? 'portal',
    sourceMessageId: row.ie_message_id ?? null,
    sourceAccountEmail: row.ie_account_email ?? null,
    title: row.title,
    bankName: row.bank_name,
    system: row.system,
    module: row.module,
    moduleDetails: row.module_details,
    form: row.form,
    requestType: row.request_type ?? 'Issue',
    requestedDelivery: row.requested_delivery,
    priority: row.priority,
    status: row.status,
    environment: row.environment,
    reporter: row.reporter,
    reporterEmail: row.reporter_email,
    contactEmail: row.contact_email,
    contactName: row.contact_name,
    contactDesignation: row.contact_designation,
    contactPhone: row.contact_phone,
    assignee: row.assignee_name ?? '',
    assigneeId: row.assignee_id,
    description: row.description,
    attachments: row.attachments ?? [],
    slaBreach: Boolean(row.sla_breach),
    slaBreachNotifiedAt: row.sla_breach_notified_at,
    resolutionNote: row.resolution_summary
      ? {
          summary: row.resolution_summary,
          cause: row.resolution_cause,
          preventionSteps: row.resolution_prevention,
          attachments: row.resolution_attachments ?? [],
        }
      : undefined,
    forwardedTo: row.forwarded_to_name,
    forwardedBy: row.forwarded_by_name,
    forwardNote: row.forward_note,
    reopenCount: row.reopen_count ?? 0,
    isEdited: Boolean(row.is_edited),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    resolvedAt: row.resolved_at,
    editedAt: row.edited_at,
  };
}

const SELECT_SQL = `
  SELECT t.*,
    assignee.name    AS assignee_name,
    fwd_to.name      AS forwarded_to_name,
    fwd_by.name      AS forwarded_by_name,
    ie.message_id    AS ie_message_id,
    ie.account_email AS ie_account_email
  FROM tickets t
  LEFT JOIN users assignee ON t.assignee_id = assignee.id
  LEFT JOIN users fwd_to   ON t.forwarded_to = fwd_to.id
  LEFT JOIN users fwd_by   ON t.forwarded_by = fwd_by.id
  LEFT JOIN inbox_emails ie ON ie.ticket_id = t.id
`;

export const TicketModel = {
  async findAll() {
    const [rows] = await pool.query(`${SELECT_SQL} ORDER BY CAST(SUBSTRING_INDEX(t.id, '-', -1) AS UNSIGNED) DESC`);
    return rows.map((r) => withLastUpdated(toJs(r)));
  },

  async findById(id) {
    const [rows] = await pool.query(`${SELECT_SQL} WHERE t.id = ?`, [id]);
    return rows[0] ? withLastUpdated(toJs(rows[0])) : null;
  },

  async findOpen() {
    const [rows] = await pool.query(
      `${SELECT_SQL} WHERE t.status IN ('Open', 'In Progress') AND t.sla_breach_notified_at IS NULL`
    );
    return rows.map((r) => toJs(r));
  },

  async nextId() {
    const [rows] = await pool.query(
      "SELECT MAX(CAST(SUBSTRING_INDEX(id, '-', -1) AS UNSIGNED)) AS maxNum FROM tickets"
    );
    const max = rows[0]?.maxNum ?? 2400;
    return `TKT-${max + 1}`;
  },

  async create(data) {
    const id = data.id ?? await TicketModel.nextId();
    const now = new Date();
    const source = data.source === 'email' ? 'email' : 'portal';
    await pool.query(
      `INSERT INTO tickets
        (id, source, title, bank_name, \`system\`, module, module_details, form, request_type,
         requested_delivery, priority, status, environment, reporter, reporter_email, contact_email,
         contact_name, contact_designation, contact_phone, assignee_id, description,
         attachments, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, source, data.title, data.bankName ?? null, data.system, data.module,
        data.moduleDetails ?? null, data.form, data.requestType ?? 'Issue',
        data.requestedDelivery ?? null, data.priority, data.environment,
        data.reporter, data.reporterEmail, data.contactEmail ?? null,
        data.contactName ?? null, data.contactDesignation ?? null, data.contactPhone ?? null,
        data.assigneeId ?? null,
        data.description, JSON.stringify(data.attachments ?? []),
        now, now,
      ]
    );
    return TicketModel.findById(id);
  },

  async updateStatus(id, status) {
    const now = new Date();
    // Pass started_at explicitly so the BEFORE UPDATE trigger's IS NULL guard
    // skips overwriting it with MySQL's UTC NOW().
    const setStarted = status === 'In Progress'
      ? ', started_at = COALESCE(started_at, ?)'
      : '';
    const params = status === 'In Progress'
      ? [status, now, now, id]
      : [status, now, id];
    await pool.query(
      `UPDATE tickets SET status = ?, updated_at = ?${setStarted} WHERE id = ?`,
      params
    );
    return TicketModel.findById(id);
  },

  async updateAssignee(id, assigneeId) {
    await pool.query(
      'UPDATE tickets SET assignee_id = ?, updated_at = ? WHERE id = ?',
      [assigneeId ?? null, new Date(), id]
    );
    return TicketModel.findById(id);
  },

  async resolve(id, status, resolutionNote, attachments) {
    const now = new Date();
    await pool.query(
      `UPDATE tickets SET status = ?, resolution_summary = ?, resolution_cause = ?,
       resolution_prevention = ?, resolution_attachments = ?, resolved_at = COALESCE(resolved_at, ?),
       updated_at = ? WHERE id = ?`,
      [
        status,
        resolutionNote.summary,
        resolutionNote.cause ?? null,
        resolutionNote.preventionSteps ?? null,
        JSON.stringify(attachments ?? []),
        now,
        now,
        id,
      ]
    );
    return TicketModel.findById(id);
  },

  async forward(id, forwardedToId, forwardedById, forwardNote) {
    await pool.query(
      `UPDATE tickets SET assignee_id = ?, forwarded_to = ?, forwarded_by = ?,
       forward_note = ?, updated_at = ? WHERE id = ?`,
      [forwardedToId, forwardedToId, forwardedById, forwardNote ?? null, new Date(), id]
    );
    return TicketModel.findById(id);
  },

  async clearForward(id) {
    await pool.query(
      'UPDATE tickets SET forwarded_to = NULL, forwarded_by = NULL, forward_note = NULL, updated_at = ? WHERE id = ?',
      [new Date(), id]
    );
    return TicketModel.findById(id);
  },

  async edit(id, updates) {
    const allowed = ['title', 'description', 'priority', 'request_type', 'requested_delivery',
      'system', 'module', 'form', 'module_details', 'contact_name', 'contact_designation', 'contact_phone', 'contact_email'];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      const jsKey = toCamel(key);
      const val = updates[jsKey] ?? updates[key];
      if (val !== undefined) {
        const col = key === 'system' ? '`system`' : key;
        sets.push(`${col} = ?`);
        vals.push(val);
      }
    }
    const now = new Date();
    sets.push('is_edited = TRUE', 'edited_at = ?', 'updated_at = ?');
    vals.push(now, now, id);
    await pool.query(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`, vals);
    return TicketModel.findById(id);
  },

  async markSlaBreach(id) {
    await pool.query(
      'UPDATE tickets SET sla_breach = TRUE, sla_breach_notified_at = ? WHERE id = ?',
      [new Date(), id]
    );
  },
};

function toCamel(snake) {
  return snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
