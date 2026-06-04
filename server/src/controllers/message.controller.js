import { TicketModel } from '../models/Ticket.model.js';
import { MessageModel } from '../models/Message.model.js';
import { NotificationModel } from '../models/Notification.model.js';
import { UserModel } from '../models/User.model.js';
import { TicketWatcherModel } from '../models/TicketWatcher.model.js';
import { getSessionUser } from '../utils/token.js';
import { UPLOADS_ROOT, ALLOWED_EXTENSIONS } from '../middleware/upload.js';
import path from 'path';
import fs from 'fs/promises';

function parseMentions(content) {
  const matches = content.match(/@([A-Za-z][A-Za-z\s]{0,48}?)(?=\s|$|[^A-Za-z\s])/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).trim()))];
}

const CONTENT_MAX = 10_000;
const MESSAGE_ROLES = new Set(['employee', 'client']);

async function saveAttachments(attachments, ticketId) {
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
      const savedName = `msg-${Date.now()}-${safeName}`;
      const filePath = path.join(uploadDir, savedName);
      if (!path.resolve(filePath).startsWith(path.resolve(uploadDir))) continue;
      await fs.writeFile(filePath, Buffer.from(item.content.split(',').pop() ?? '', 'base64'));
      att.url = `/api/download/${ticketId}/${encodeURIComponent(savedName)}`;
    }
    saved.push(att);
  }
  return saved;
}

function clientCanAccess(sessionUser, ticket) {
  if (!sessionUser || sessionUser.role !== 'client') return true;
  const domain = (sessionUser.bankDomain ?? '').toLowerCase();
  const bankName = (sessionUser.bankName ?? '').toLowerCase();
  const email = String(ticket.reporterEmail ?? '').toLowerCase();
  return (domain && email.endsWith(`@${domain}`)) || (bankName && String(ticket.bankName ?? '').toLowerCase() === bankName);
}

export const MessageController = {
  async list(req, res) {
    const ticket = await TicketModel.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
    const sessionUser = getSessionUser(req);
    if (!clientCanAccess(sessionUser, ticket)) return res.status(403).json({ message: 'Access denied.' });
    const includeInternal = !sessionUser || sessionUser.role !== 'client';
    return res.json(await MessageModel.findByTicketId(req.params.id, includeInternal));
  },

  async create(req, res) {
    const ticket = await TicketModel.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

    const content = String(req.body?.content ?? '').trim();
    if (!content) return res.status(400).json({ message: 'Message content is required.' });
    if (content.length > CONTENT_MAX) return res.status(400).json({ message: `Content must be at most ${CONTENT_MAX} characters.` });

    const role = MESSAGE_ROLES.has(req.body?.role) ? req.body.role : 'employee';
    const author = String(req.body?.author ?? (role === 'client' ? 'Client' : 'Inorins Support')).trim();

    const sessionUser = getSessionUser(req);
    let authorId = null;
    if (sessionUser?.id) authorId = sessionUser.id;

    const attachments = await saveAttachments(req.body?.attachments, req.params.id);
    const message = await MessageModel.create(req.params.id, {
      author: author || (role === 'client' ? 'Client' : 'Inorins Support'),
      authorId, role, content,
      isInternal: Boolean(req.body?.isInternal),
      attachments,
    });

    // Update ticket's updatedAt
    await TicketModel.updateStatus(req.params.id, ticket.status);

    const allUsers = await UserModel.findAll();
    const notifiedIds = new Set();

    // Cross-notify
    if (!message.isInternal) {
      if (role === 'client') {
        if (ticket.assigneeId) {
          NotificationModel.create(ticket.assigneeId, 'new_client_reply', ticket.id, ticket.title,
            `Client replied on ticket: ${ticket.title}`).catch(() => {});
          notifiedIds.add(ticket.assigneeId);
        } else {
          const staff = allUsers.filter((u) => u.role === 'inorins');
          for (const s of staff) {
            NotificationModel.create(s.id, 'new_client_reply', ticket.id, ticket.title,
              `Client replied on ticket: ${ticket.title}`).catch(() => {});
            notifiedIds.add(s.id);
          }
        }
      } else {
        if (ticket.reporterEmail) {
          const reporter = allUsers.find((u) => u.email?.toLowerCase() === ticket.reporterEmail.toLowerCase());
          if (reporter) {
            NotificationModel.create(reporter.id, 'new_staff_reply', ticket.id, ticket.title,
              `Support team replied on your ticket: ${ticket.title}`).catch(() => {});
            notifiedIds.add(reporter.id);
          }
        }
      }
    }

    // @mention notifications — notify mentioned staff regardless of internal flag
    if (role !== 'client') {
      const mentionedNames = parseMentions(content);
      for (const name of mentionedNames) {
        const mentioned = allUsers.find((u) => u.name?.toLowerCase() === name.toLowerCase() && u.role === 'inorins');
        if (mentioned && !notifiedIds.has(mentioned.id)) {
          NotificationModel.create(mentioned.id, 'new_staff_reply', ticket.id, ticket.title,
            `${author} mentioned you in ticket: ${ticket.title}`).catch(() => {});
          notifiedIds.add(mentioned.id);
        }
      }
    }

    // Watcher notifications
    const watcherIds = await TicketWatcherModel.getWatcherUserIds(ticket.id);
    for (const watcherId of watcherIds) {
      if (!notifiedIds.has(watcherId) && watcherId !== authorId) {
        NotificationModel.create(watcherId, role === 'client' ? 'new_client_reply' : 'new_staff_reply',
          ticket.id, ticket.title,
          `Update on watched ticket: ${ticket.title}`).catch(() => {});
        notifiedIds.add(watcherId);
      }
    }

    return res.status(201).json(message);
  },
};
