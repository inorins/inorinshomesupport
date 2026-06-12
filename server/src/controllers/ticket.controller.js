import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { pool } from '../config/database.js';
import { TicketModel } from '../models/Ticket.model.js';
import { MessageModel } from '../models/Message.model.js';
import { NotificationModel } from '../models/Notification.model.js';
import { UserModel } from '../models/User.model.js';
import { EmailService } from '../services/email.service.js';
import { getSessionUser } from '../utils/token.js';
import { UPLOADS_ROOT, ALLOWED_EXTENSIONS } from '../middleware/upload.js';
import { getEffectivePermissions, filterTicketsByPermissions, isSuperAdmin } from '../services/permission.service.js';
import { TicketLinkModel } from '../models/TicketLink.model.js';

const FIELD_MAX = {
  title: 200, description: 5000, moduleDetails: 2000, reporter: 100,
  reporterEmail: 200, contactName: 100, contactDesignation: 100, contactPhone: 30, contactEmail: 255,
  resolutionSummary: 3000, resolutionCause: 3000, resolutionPrevention: 3000,
};
const PRIORITIES = new Set(['Critical', 'High', 'Medium', 'Low']);
const STATUSES = new Set(['Open', 'In Progress', 'Pending Client', 'Resolved', 'Closed']);
const SETTABLE_STATUSES = new Set(['Open', 'In Progress', 'Pending Client', 'Resolved']);

/**
 * Load effective permissions for the current request's user.
 * Returns null if no session user or user is super-admin.
 */
async function resolvePerms(sessionUser) {
  if (!sessionUser?.id) return null;
  try {
    const userRecord = await UserModel.findById(sessionUser.id);
    if (isSuperAdmin(sessionUser, userRecord?.email)) return null;
    return await getEffectivePermissions(sessionUser.id, sessionUser.role, userRecord?.department ?? null);
  } catch (err) {
    console.error('[permissions] resolvePerms failed — falling back to defaults:', err.message);
    return null; // null = no restrictions (same as super-admin path)
  }
}

function clientCanAccess(sessionUser, ticket) {
  if (!sessionUser || sessionUser.role !== 'client') return true;
  const domain = (sessionUser.bankDomain ?? '').toLowerCase();
  const bankName = (sessionUser.bankName ?? '').toLowerCase();
  const email = String(ticket.reporterEmail ?? '').toLowerCase();
  return (domain && email.endsWith(`@${domain}`)) || (bankName && String(ticket.bankName ?? '').toLowerCase() === bankName);
}

async function saveAttachments(attachments, ticketId, prefix = '') {
  const saved = [];
  if (!Array.isArray(attachments)) return saved;
  const uploadDir = path.join(UPLOADS_ROOT, ticketId);
  await fs.mkdir(uploadDir, { recursive: true });
  for (const item of attachments) {
    if (!item || typeof item.name !== 'string' || typeof item.size !== 'number') continue;
    const att = { name: item.name, size: item.size, type: item.type };
    if (typeof item.content === 'string') {
      const safeName = path.basename(item.name).replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = path.extname(safeName).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;
      const savedName = `${prefix}${Date.now()}-${safeName}`;
      const filePath = path.join(uploadDir, savedName);
      if (!path.resolve(filePath).startsWith(path.resolve(uploadDir))) continue;
      await fs.writeFile(filePath, Buffer.from(item.content.split(',').pop() ?? '', 'base64'));
      att.url = `/api/download/${ticketId}/${encodeURIComponent(savedName)}`;
    }
    saved.push(att);
  }
  return saved;
}

export const TicketController = {
  // Returns every ticket with no permission filtering — for the Team Board (inorins only).
  async listAll(_req, res) {
    return res.json(await TicketModel.findAll());
  },

  async list(req, res) {
    const sessionUser = getSessionUser(req);
    let tickets = await TicketModel.findAll();

    if (sessionUser) {
      const userRecord = sessionUser.id ? await UserModel.findById(sessionUser.id) : null;
      const userEmail  = userRecord?.email ?? null;
      const department = userRecord?.department ?? null;

      // Super-admin skips all restrictions
      if (!isSuperAdmin(sessionUser, userEmail)) {
        // For clients: always restrict to their bank first
        if (sessionUser.role === 'client') {
          const domain   = (sessionUser.bankDomain ?? '').toLowerCase();
          const bankName = (sessionUser.bankName ?? '').toLowerCase();
          tickets = tickets.filter((t) => {
            const email = String(t.reporterEmail ?? '').toLowerCase();
            return (domain && email.endsWith(`@${domain}`))
                || (bankName && String(t.bankName ?? '').toLowerCase() === bankName);
          });
        }

        // Apply configured permission rules on top
        const perms = await getEffectivePermissions(sessionUser.id, sessionUser.role, department);
        tickets = filterTicketsByPermissions(tickets, sessionUser, perms, userEmail);
      }
    }

    return res.json(tickets);
  },

  async getById(req, res) {
    const ticket = await TicketModel.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
    const sessionUser = getSessionUser(req);
    if (!clientCanAccess(sessionUser, ticket)) return res.status(403).json({ message: 'Access denied.' });
    return res.json(ticket);
  },

  async create(req, res) {
    const sessionUser = getSessionUser(req);
    const perms = await resolvePerms(sessionUser);
    if (perms && !perms.canCreateTickets) {
      return res.status(403).json({ message: 'You do not have permission to create tickets.' });
    }

    const payload = req.body ?? {};
    const title = String(payload.title ?? '').trim();
    const system = String(payload.system ?? '').trim();
    const module = String(payload.module ?? '').trim();
    const form = String(payload.form ?? '').trim();

    if (!title || !system || !module || !form) {
      return res.status(400).json({ message: 'Title, system, module, and form are required.' });
    }
    if (title.length > FIELD_MAX.title) return res.status(400).json({ message: `Title must be at most ${FIELD_MAX.title} chars.` });
    const desc = String(payload.description ?? '');
    if (desc.length > FIELD_MAX.description) return res.status(400).json({ message: `Description must be at most ${FIELD_MAX.description} chars.` });

    const priority = PRIORITIES.has(payload.priority) ? payload.priority : 'Medium';
    const environment = payload.environment === 'Production' ? 'Production' : 'UAT';
    const requestType = ['Issue', 'Add Form', 'Add Report', 'Update'].includes(payload.requestType) ? payload.requestType : 'Issue';

    const reporterEmail = String(payload.reporterEmail ?? '').trim();
    let bankName = String(payload.bankName ?? '').trim();
    if (!bankName && reporterEmail.includes('@')) {
      const domain = reporterEmail.split('@')[1]?.toLowerCase();
      const matched = domain ? await UserModel.findByDomain(domain) : null;
      bankName = matched?.bank_name ?? '';
    }

    // Generate the ticket ID first so we can save attachments
    const ticketId = await TicketModel.nextId();
    const attachments = await saveAttachments(payload.attachments, ticketId);

    const ticket = await TicketModel.create({
      ...payload,
      id: ticketId,
      title, system, module, form, priority, environment, requestType,
      bankName: bankName || undefined,
      reporterEmail,
      reporter: String(payload.reporter ?? 'Unknown Reporter'),
      description: desc,
      moduleDetails: typeof payload.moduleDetails === 'string' ? payload.moduleDetails : undefined,
      requestedDelivery: typeof payload.requestedDelivery === 'string' ? payload.requestedDelivery : undefined,
      contactEmail: typeof payload.contactEmail === 'string' ? payload.contactEmail.trim().slice(0, 255) : undefined,
      contactName: typeof payload.contactName === 'string' ? payload.contactName.trim().slice(0, FIELD_MAX.contactName) : undefined,
      contactDesignation: typeof payload.contactDesignation === 'string' ? payload.contactDesignation.trim().slice(0, FIELD_MAX.contactDesignation) : undefined,
      contactPhone: typeof payload.contactPhone === 'string' ? payload.contactPhone.trim().slice(0, FIELD_MAX.contactPhone) : undefined,
      attachments,
    });

    // Notify all inorins staff in-app
    const allUsers = await UserModel.findAll();
    const staff = allUsers.filter((x) => x.role === 'inorins');
    for (const s of staff) {
      NotificationModel.create(s.id, 'new_ticket', ticket.id, ticket.title,
        `New ticket from ${ticket.bankName || ticket.reporter}: ${ticket.title}`
      ).catch(() => {});
    }

    // Email alerts (fire & forget)
    EmailService.sendNewTicketAlert(ticket).catch((err) => console.error('[email] sendNewTicketAlert failed:', err.message));
    EmailService.sendClientConfirmation(ticket).catch((err) => console.error('[email] sendClientConfirmation failed:', err.message));

    return res.status(201).json(ticket);
  },

  async updateStatus(req, res) {
    const status = req.body?.status;
    if (!SETTABLE_STATUSES.has(status)) return res.status(400).json({ message: 'Invalid status value.' });

    const sessionUser = getSessionUser(req);
    const perms = await resolvePerms(sessionUser);
    if (perms) {
      if (!perms.canUpdateTickets) {
        return res.status(403).json({ message: 'You do not have permission to update tickets.' });
      }
      if (status === 'Resolved' && !perms.canCloseTickets) {
        return res.status(403).json({ message: 'You do not have permission to resolve tickets.' });
      }
    }

    const existing = await TicketModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Ticket not found.' });
    const oldStatus = existing.status;

    const updated = await TicketModel.updateStatus(req.params.id, status);

    // Notify reporter in-app
    if (updated.reporterEmail) {
      const reporter = await UserModel.findByEmail(updated.reporterEmail);
      if (reporter) {
        NotificationModel.create(reporter.id, 'status_changed', updated.id, updated.title,
          `Your ticket "${updated.title}" status changed to: ${status}`
        ).catch(() => {});
      }
    }

    // Email: heads + client
    const changer = sessionUser ? await UserModel.findById(sessionUser.id) : null;
    EmailService.sendStatusUpdateToHeads(updated, oldStatus, changer?.name).catch((err) => console.error('[email] sendStatusUpdateToHeads failed:', err.message));
    // Email-sourced tickets: always notify the sender on any status change
    const shouldEmailClient = updated.source === 'email'
      || ['In Progress', 'Resolved', 'Pending Client'].includes(status);
    if (shouldEmailClient) {
      EmailService.sendClientStatusUpdate(updated).catch((err) => console.error('[email] sendClientStatusUpdate failed:', err.message));
    }

    // Propagate status to unresolved duplicate-linked tickets
    try {
      const links = await TicketLinkModel.findByTicket(req.params.id);
      const duplicates = links.filter((l) => l.linkType === 'duplicate');
      for (const link of duplicates) {
        const otherId = link.primaryTicketId === req.params.id ? link.linkedTicketId : link.primaryTicketId;
        const other = link.primaryTicketId === req.params.id ? link.linkedTicket : link.primaryTicket;
        if (other.status !== 'Resolved' && other.status !== 'Closed' && other.status !== status) {
          await TicketModel.updateStatus(otherId, status).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[linked-propagation] updateStatus propagation failed:', err.message);
    }

    return res.json(updated);
  },

  async resolve(req, res) {
    const status = req.body?.status;
    if (status !== 'Resolved') {
      return res.status(400).json({ message: 'Status must be Resolved.' });
    }

    const sessionUser = getSessionUser(req);
    const perms = await resolvePerms(sessionUser);
    if (perms && !perms.canCloseTickets) {
      return res.status(403).json({ message: 'You do not have permission to resolve or close tickets.' });
    }

    const note = req.body?.resolutionNote;
    const summary = typeof note?.summary === 'string' ? note.summary.trim() : '';
    if (!summary) return res.status(400).json({ message: 'Resolution summary is required.' });

    const existing = await TicketModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Ticket not found.' });

    const attachments = await saveAttachments(note.attachments, req.params.id, 'resolution-');
    const resolutionNote = {
      summary: summary.slice(0, FIELD_MAX.resolutionSummary),
      cause: typeof note.cause === 'string' ? note.cause.trim().slice(0, FIELD_MAX.resolutionCause) : undefined,
      preventionSteps: typeof note.preventionSteps === 'string' ? note.preventionSteps.trim().slice(0, FIELD_MAX.resolutionPrevention) : undefined,
    };

    const updated = await TicketModel.resolve(req.params.id, status, resolutionNote, attachments);

    const changer = sessionUser ? await UserModel.findById(sessionUser.id) : null;
    EmailService.sendStatusUpdateToHeads(updated, existing.status, changer?.name).catch((err) => console.error('[email] sendStatusUpdateToHeads (resolve) failed:', err.message));
    EmailService.sendClientStatusUpdate(updated).catch((err) => console.error('[email] sendClientStatusUpdate (resolve) failed:', err.message));

    // Propagate resolution to unresolved duplicate-linked tickets with the same message
    try {
      const links = await TicketLinkModel.findByTicket(req.params.id);
      const duplicates = links.filter((l) => l.linkType === 'duplicate');
      for (const link of duplicates) {
        const otherId = link.primaryTicketId === req.params.id ? link.linkedTicketId : link.primaryTicketId;
        const other = link.primaryTicketId === req.params.id ? link.linkedTicket : link.primaryTicket;
        if (other.status !== 'Resolved' && other.status !== 'Closed') {
          await TicketModel.resolve(otherId, 'Resolved', resolutionNote, []).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[linked-propagation] resolve propagation failed:', err.message);
    }

    return res.json(updated);
  },

  async assign(req, res) {
    const sessionUser = getSessionUser(req);
    const perms = await resolvePerms(sessionUser);
    if (perms && !perms.canAssignTickets) {
      return res.status(403).json({ message: 'You do not have permission to assign tickets.' });
    }

    const assigneeName = String(req.body?.assignee ?? '').trim();
    const existing = await TicketModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Ticket not found.' });

    // Resolve name to ID
    let assigneeId = null;
    if (assigneeName) {
      const allStaff = await UserModel.findAll();
      const found = allStaff.find((u) => u.name === assigneeName || u.email === assigneeName);
      assigneeId = found?.id ?? null;
      if (found) {
        NotificationModel.create(found.id, 'ticket_assigned', existing.id, existing.title,
          `You have been assigned ticket: ${existing.title}`
        ).catch(() => {});
      }
    }

    const updated = await TicketModel.updateAssignee(req.params.id, assigneeId);
    EmailService.sendAssignmentAlertToHeads(updated, assigneeName).catch((err) => console.error('[email] sendAssignmentAlertToHeads failed:', err.message));
    return res.json(updated);
  },

  async forward(req, res) {
    const sessionUser = getSessionUser(req);
    if (!sessionUser || sessionUser.role !== 'inorins') {
      return res.status(403).json({ message: 'Only Inorins staff can forward tickets.' });
    }
    const forwardedTo = String(req.body?.forwardedTo ?? '').trim();
    const forwardNote = String(req.body?.forwardNote ?? '').trim().slice(0, 1000);
    const forwardedBy = String(req.body?.forwardedBy ?? '').trim();
    if (!forwardedTo) return res.status(400).json({ message: 'forwardedTo is required.' });

    const existing = await TicketModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Ticket not found.' });

    const allUsers = await UserModel.findAll();
    const toUser = allUsers.find((u) => u.name === forwardedTo || u.email === forwardedTo);
    const byUser = allUsers.find((u) => u.name === forwardedBy || u.email === forwardedBy);

    const updated = await TicketModel.forward(req.params.id, toUser?.id ?? null, byUser?.id ?? null, forwardNote || undefined);

    // In-app notification for the recipient
    if (toUser?.id) {
      NotificationModel.create(
        toUser.id, 'ticket_assigned', existing.id, existing.title,
        `${byUser?.name || 'A colleague'} forwarded ticket "${existing.title}" to you`
      ).catch(() => {});
    }

    // Email only to the recipient — not the client
    const byName = byUser?.name || forwardedBy || 'A colleague';
    EmailService.sendForwardNotification(updated, toUser, byName, forwardNote || undefined)
      .catch((err) => console.error('[email] sendForwardNotification failed:', err.message));

    return res.json(updated);
  },

  async clearForward(req, res) {
    const sessionUser = getSessionUser(req);
    if (!sessionUser || sessionUser.role !== 'inorins') return res.status(403).json({ message: 'Access denied.' });
    const existing = await TicketModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Ticket not found.' });
    const updated = await TicketModel.clearForward(req.params.id);
    return res.json(updated);
  },

  async editByClient(req, res) {
    const sessionUser = getSessionUser(req);
    if (!sessionUser || sessionUser.role !== 'client') {
      return res.status(403).json({ message: 'Only clients can edit tickets.' });
    }

    const perms = await resolvePerms(sessionUser);
    if (perms && !perms.canUpdateTickets) {
      return res.status(403).json({ message: 'You do not have permission to edit tickets.' });
    }

    const ticket = await TicketModel.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
    if (!['Open', 'Pending Client'].includes(ticket.status)) {
      return res.status(400).json({ message: 'Ticket can only be edited when Open or Pending Client.' });
    }
    if (!clientCanAccess(sessionUser, ticket)) return res.status(403).json({ message: 'Access denied.' });

    const payload = req.body ?? {};
    const allowed = ['title', 'description', 'priority', 'requestType', 'requestedDelivery',
      'system', 'module', 'form', 'moduleDetails', 'contactName', 'contactDesignation', 'contactPhone', 'contactEmail'];
    const updates = {};
    for (const field of allowed) {
      if (field in payload && typeof payload[field] === 'string') {
        updates[field] = payload[field].trim().slice(0, FIELD_MAX[field] ?? 500);
      }
    }
    if (payload.priority && PRIORITIES.has(payload.priority)) updates.priority = payload.priority;

    const updated = await TicketModel.edit(req.params.id, updates);

    await MessageModel.create(req.params.id, {
      author: 'System', role: 'employee',
      content: 'Ticket details were edited by the client.',
      isInternal: false,
    });

    // Notify assignee or all staff
    if (ticket.assigneeId) {
      NotificationModel.create(ticket.assigneeId, 'ticket_edited', ticket.id, ticket.title,
        `Client edited ticket details: ${ticket.title}`
      ).catch(() => {});
    } else {
      const staff = await UserModel.findAll().then((u) => u.filter((x) => x.role === 'inorins'));
      for (const s of staff) {
        NotificationModel.create(s.id, 'ticket_edited', ticket.id, ticket.title,
          `Client edited ticket: ${ticket.title}`
        ).catch(() => {});
      }
    }

    return res.json(updated);
  },

  async getStats(_req, res) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [rows] = await pool.query(`
      SELECT
        SUM(status = 'Open') AS openTickets,
        SUM(status = 'In Progress') AS pendingOurAction,
        SUM(status = 'Resolved' AND updated_at >= ?) AS resolvedThisWeek
      FROM tickets
    `, [weekAgo]);
    return res.json({
      openTickets: Number(rows[0].openTickets ?? 0),
      resolvedThisWeek: Number(rows[0].resolvedThisWeek ?? 0),
      pendingOurAction: Number(rows[0].pendingOurAction ?? 0),
    });
  },

  async getStatsBreakdown(_req, res) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [[byStatus], [byPriority], [byBank], [slaTrend]] = await Promise.all([
      pool.query(`
        SELECT status, COUNT(*) AS count
        FROM tickets
        WHERE status NOT IN ('Closed')
        GROUP BY status
      `),
      pool.query(`
        SELECT priority, COUNT(*) AS count
        FROM tickets
        WHERE status NOT IN ('Resolved','Closed')
        GROUP BY priority
        ORDER BY FIELD(priority,'Critical','High','Medium','Low')
      `),
      pool.query(`
        SELECT COALESCE(NULLIF(bank_name,''), 'Inorins') AS bank, COUNT(*) AS count
        FROM tickets
        WHERE status NOT IN ('Resolved','Closed')
        GROUP BY bank
        ORDER BY count DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT DATE(created_at) AS date, SUM(sla_breach = 1) AS breaches, COUNT(*) AS total
        FROM tickets
        WHERE created_at >= ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [thirtyDaysAgo]),
    ]);

    return res.json({ byStatus, byPriority, byBank, slaTrend });
  },

  async bulkUpdate(req, res) {
    const sessionUser = getSessionUser(req);
    const perms = await resolvePerms(sessionUser);
    if (perms && !perms.canUpdateTickets) {
      return res.status(403).json({ message: 'You do not have permission to update tickets.' });
    }

    const { ids, action, value } = req.body ?? {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required.' });
    }
    if (ids.length > 100) return res.status(400).json({ message: 'Cannot bulk-update more than 100 tickets at once.' });

    const safeIds = ids.map(String).filter(Boolean);

    if (action === 'status') {
      if (!STATUSES.has(value)) return res.status(400).json({ message: 'Invalid status.' });
      if (value === 'Closed' && perms && !perms.canCloseTickets) {
        return res.status(403).json({ message: 'You do not have permission to close tickets.' });
      }
      const placeholders = safeIds.map(() => '?').join(',');
      await pool.query(
        `UPDATE tickets SET status = ?, updated_at = ? WHERE id IN (${placeholders})`,
        [value, new Date(), ...safeIds]
      );
      return res.json({ updated: safeIds.length });
    }

    if (action === 'assign') {
      if (perms && !perms.canAssignTickets) {
        return res.status(403).json({ message: 'You do not have permission to assign tickets.' });
      }
      const allStaff = await UserModel.findAll();
      const found = allStaff.find((u) => u.name === value || u.email === value);
      const assigneeId = found?.id ?? null;
      const placeholders = safeIds.map(() => '?').join(',');
      await pool.query(
        `UPDATE tickets SET assignee_id = ?, updated_at = ? WHERE id IN (${placeholders})`,
        [assigneeId, new Date(), ...safeIds]
      );
      return res.json({ updated: safeIds.length });
    }

    return res.status(400).json({ message: 'action must be "status" or "assign".' });
  },

  async reopen(req, res) {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ message: 'Unauthenticated.' });

    const ticket = await TicketModel.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

    if (ticket.status !== 'Resolved' && ticket.status !== 'Closed') {
      return res.status(400).json({ message: 'Only Resolved or Closed tickets can be reopened.' });
    }

    if (sessionUser.role === 'client' && !clientCanAccess(sessionUser, ticket)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const reopenNote = String(req.body?.reopenNote ?? '').trim().slice(0, 1000);
    if (!reopenNote) return res.status(400).json({ message: 'A reopen note is required.' });

    await pool.query(
      `UPDATE tickets SET status='Open', resolved_at=NULL, resolution_summary=NULL,
       resolution_cause=NULL, resolution_prevention=NULL, resolution_attachments=NULL,
       reopen_count = reopen_count + 1, updated_at=? WHERE id=?`,
      [new Date(), ticket.id]
    );

    await MessageModel.create(ticket.id, {
      author: 'System',
      role: 'employee',
      content: `Ticket reopened. Reason: ${reopenNote}`,
      isInternal: false,
    });

    // Notify assignee or all staff
    if (ticket.assigneeId) {
      NotificationModel.create(ticket.assigneeId, 'status_changed', ticket.id, ticket.title,
        `Ticket reopened by client: ${ticket.title}`
      ).catch(() => {});
    } else {
      const staff = await UserModel.findAll().then((u) => u.filter((x) => x.role === 'inorins'));
      for (const s of staff) {
        NotificationModel.create(s.id, 'status_changed', ticket.id, ticket.title,
          `Ticket reopened: ${ticket.title}`
        ).catch(() => {});
      }
    }

    const refreshed = await TicketModel.findById(ticket.id);
    return res.json(refreshed);
  },

  async getArchive(req, res) {
    const sessionUser = getSessionUser(req);
    if (!sessionUser || sessionUser.role !== 'inorins') return res.status(403).json({ message: 'Access denied.' });
    const user = await UserModel.findById(sessionUser.id);
    if (!user || user.email?.toLowerCase() !== 'inorins@inorins.com') {
      return res.status(403).json({ message: 'Access denied. Archive is only available to the admin account.' });
    }
    const all = await TicketModel.findAll();
    const archived = all
      .filter((t) => t.status === 'Resolved' || t.status === 'Closed')
      .sort((a, b) => new Date(b.resolvedAt ?? b.updatedAt ?? 0) - new Date(a.resolvedAt ?? a.updatedAt ?? 0));
    return res.json(archived);
  },
};
