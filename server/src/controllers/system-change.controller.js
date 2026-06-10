import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { SystemChangeModel } from '../models/SystemChange.model.js';
import { SystemChangeBankModel } from '../models/SystemChangeBank.model.js';
import { SystemChangeItemModel } from '../models/SystemChangeItem.model.js';
import { SystemChangeTicketModel } from '../models/SystemChangeTicket.model.js';
import { getSessionUser } from '../utils/token.js';
import { getEffectivePermissions, isSuperAdmin } from '../services/permission.service.js';
import { UserModel } from '../models/User.model.js';
import { UPLOADS_ROOT, ALLOWED_EXTENSIONS } from '../middleware/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function saveItemFile(changeId, fileName, base64Content) {
  const uploadDir = path.join(UPLOADS_ROOT, `sc-${changeId}`);
  await fs.mkdir(uploadDir, { recursive: true });
  const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = path.extname(safeName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) throw new Error(`File type ${ext} is not allowed.`);
  const savedName = `${Date.now()}-${safeName}`;
  const filePath = path.join(uploadDir, savedName);
  if (!path.resolve(filePath).startsWith(path.resolve(uploadDir) + path.sep)) throw new Error('Invalid file path.');
  const content = base64Content.includes(',') ? base64Content.split(',').pop() : base64Content;
  await fs.writeFile(filePath, Buffer.from(content ?? '', 'base64'));
  return `/api/download/sc-${changeId}/${encodeURIComponent(savedName)}`;
}

async function canManage(req) {
  const sessionUser = getSessionUser(req);
  if (!sessionUser) return false;
  const userRecord = await UserModel.findById(sessionUser.id);
  if (isSuperAdmin(sessionUser, userRecord?.email)) return true;
  const perms = await getEffectivePermissions(sessionUser.id, sessionUser.role, userRecord?.department ?? null);
  return perms.canManageSystemChanges !== false;
}

const VALID_STATUSES = new Set(['Not Started', 'In Progress', 'Completed']);

export const SystemChangeController = {
  async list(req, res) {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.system) filters.system = req.query.system;
    if (req.query.bankName) filters.bankName = req.query.bankName;
    const changes = await SystemChangeModel.findAll(filters);
    return res.json(changes);
  },

  async getById(req, res) {
    const change = await SystemChangeModel.findById(Number(req.params.id));
    if (!change) return res.status(404).json({ message: 'System change not found.' });
    return res.json(change);
  },

  async create(req, res) {
    if (!await canManage(req)) return res.status(403).json({ message: 'You do not have permission to create system changes.' });
    const payload = req.body ?? {};
    const title = String(payload.title ?? '').trim();
    if (!title) return res.status(400).json({ message: 'Title is required.' });
    if (title.length > 255) return res.status(400).json({ message: 'Title must be at most 255 characters.' });
    if (payload.status && !VALID_STATUSES.has(payload.status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }
    const sessionUser = getSessionUser(req);
    const change = await SystemChangeModel.create(payload, sessionUser?.id ?? null);
    return res.status(201).json(change);
  },

  async update(req, res) {
    if (!await canManage(req)) return res.status(403).json({ message: 'You do not have permission to update system changes.' });
    const id = Number(req.params.id);
    const existing = await SystemChangeModel.findById(id);
    if (!existing) return res.status(404).json({ message: 'System change not found.' });

    const payload = req.body ?? {};
    if (payload.status && !VALID_STATUSES.has(payload.status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }
    const sessionUser = getSessionUser(req);
    const updated = await SystemChangeModel.update(id, payload, sessionUser?.id ?? null);
    return res.json(updated);
  },

  async delete(req, res) {
    if (!await canManage(req)) return res.status(403).json({ message: 'You do not have permission to delete system changes.' });
    const id = Number(req.params.id);
    const deleted = await SystemChangeModel.delete(id);
    if (!deleted) return res.status(404).json({ message: 'System change not found.' });
    return res.json({ ok: true });
  },

  // ── Bank tracking ──────────────────────────────────────────────────────────

  async listBanks(req, res) {
    const id = Number(req.params.id);
    const change = await SystemChangeModel.findById(id);
    if (!change) return res.status(404).json({ message: 'System change not found.' });
    const banks = await SystemChangeBankModel.findByChange(id);
    return res.json(banks);
  },

  async setBanks(req, res) {
    if (!await canManage(req)) return res.status(403).json({ message: 'You do not have permission to manage system changes.' });
    const id = Number(req.params.id);
    const change = await SystemChangeModel.findById(id);
    if (!change) return res.status(404).json({ message: 'System change not found.' });

    const banks = req.body?.banks;
    if (!Array.isArray(banks)) return res.status(400).json({ message: 'banks array is required.' });
    const sessionUser = getSessionUser(req);
    const result = await SystemChangeBankModel.setAll(id, banks, sessionUser?.id ?? null);
    return res.json(result);
  },

  async updateBank(req, res) {
    if (!await canManage(req)) return res.status(403).json({ message: 'You do not have permission to manage system changes.' });
    const id = Number(req.params.id);
    const { bankName } = req.params;
    const { status, note } = req.body ?? {};
    if (!['Pending', 'Done'].includes(status)) {
      return res.status(400).json({ message: 'status must be Pending or Done.' });
    }
    const sessionUser = getSessionUser(req);
    const entry = await SystemChangeBankModel.upsert(id, bankName, status, note, sessionUser?.id ?? null);
    return res.json(entry);
  },

  async deleteBank(req, res) {
    if (!await canManage(req)) return res.status(403).json({ message: 'You do not have permission to manage system changes.' });
    const id = Number(req.params.id);
    const { bankName } = req.params;
    const deleted = await SystemChangeBankModel.delete(id, bankName);
    if (!deleted) return res.status(404).json({ message: 'Bank entry not found.' });
    return res.json({ ok: true });
  },

  // ── Change Items (sub-items) ───────────────────────────────────────────────

  async listItems(req, res) {
    const id = Number(req.params.id);
    const change = await SystemChangeModel.findById(id);
    if (!change) return res.status(404).json({ message: 'System change not found.' });
    return res.json(change.items ?? []);
  },

  async setItems(req, res) {
    if (!await canManage(req)) return res.status(403).json({ message: 'You do not have permission to manage system changes.' });
    const id = Number(req.params.id);
    const change = await SystemChangeModel.findById(id);
    if (!change) return res.status(404).json({ message: 'System change not found.' });
    const items = req.body?.items;
    if (!Array.isArray(items)) return res.status(400).json({ message: 'items array is required.' });
    const processedItems = await Promise.all(items.map(async (item) => {
      if (typeof item.attachmentContent === 'string' && item.attachmentName) {
        try {
          const url = await saveItemFile(id, item.attachmentName, item.attachmentContent);
          return { ...item, attachmentUrl: url, attachmentContent: undefined };
        } catch {
          return { ...item, attachmentContent: undefined };
        }
      }
      return item;
    }));
    const result = await SystemChangeItemModel.setAll(id, processedItems);
    return res.json(result);
  },

  async createItem(req, res) {
    if (!await canManage(req)) return res.status(403).json({ message: 'You do not have permission to manage system changes.' });
    const id = Number(req.params.id);
    const change = await SystemChangeModel.findById(id);
    if (!change) return res.status(404).json({ message: 'System change not found.' });
    const item = await SystemChangeItemModel.create(id, req.body ?? {});
    return res.status(201).json(item);
  },

  async updateItem(req, res) {
    if (!await canManage(req)) return res.status(403).json({ message: 'You do not have permission to manage system changes.' });
    const itemId = Number(req.params.itemId);
    const item = await SystemChangeItemModel.update(itemId, req.body ?? {});
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    return res.json(item);
  },

  async deleteItem(req, res) {
    if (!await canManage(req)) return res.status(403).json({ message: 'You do not have permission to manage system changes.' });
    const itemId = Number(req.params.itemId);
    const deleted = await SystemChangeItemModel.delete(itemId);
    if (!deleted) return res.status(404).json({ message: 'Item not found.' });
    return res.json({ ok: true });
  },

  // ── Ticket links ───────────────────────────────────────────────────────────

  async listTickets(req, res) {
    const id = Number(req.params.id);
    const links = await SystemChangeTicketModel.findByChange(id);
    return res.json(links);
  },

  async linkTicket(req, res) {
    if (!await canManage(req)) return res.status(403).json({ message: 'You do not have permission to manage system changes.' });
    const id = Number(req.params.id);
    const ticketId = String(req.body?.ticketId ?? '').trim();
    const note = req.body?.note ?? null;
    if (!ticketId) return res.status(400).json({ message: 'ticketId is required.' });
    const sessionUser = getSessionUser(req);
    const links = await SystemChangeTicketModel.link(id, ticketId, note, sessionUser?.id ?? null);
    return res.json(links);
  },

  async unlinkTicket(req, res) {
    if (!await canManage(req)) return res.status(403).json({ message: 'You do not have permission to manage system changes.' });
    const id = Number(req.params.id);
    const { ticketId } = req.params;
    const unlinked = await SystemChangeTicketModel.unlink(id, ticketId);
    if (!unlinked) return res.status(404).json({ message: 'Link not found.' });
    return res.json({ ok: true });
  },

  // ── System changes for a ticket (called from ticket side) ──────────────────
  async listForTicket(req, res) {
    const links = await SystemChangeTicketModel.findByTicket(req.params.ticketId);
    return res.json(links);
  },

  async linkFromTicket(req, res) {
    const ticketId = req.params.ticketId;
    const changeId = Number(req.body?.changeId);
    const note = req.body?.note ?? null;
    if (!changeId) return res.status(400).json({ message: 'changeId is required.' });
    const change = await SystemChangeModel.findById(changeId);
    if (!change) return res.status(404).json({ message: 'System change not found.' });
    if (!await canManage(req)) return res.status(403).json({ message: 'You do not have permission to manage system changes.' });
    const sessionUser = getSessionUser(req);
    await SystemChangeTicketModel.link(changeId, ticketId, note, sessionUser?.id ?? null);
    return res.json(await SystemChangeTicketModel.findByTicket(ticketId));
  },

  async unlinkFromTicket(req, res) {
    if (!await canManage(req)) return res.status(403).json({ message: 'You do not have permission to manage system changes.' });
    const { ticketId, changeId } = req.params;
    const unlinked = await SystemChangeTicketModel.unlink(Number(changeId), ticketId);
    if (!unlinked) return res.status(404).json({ message: 'Link not found.' });
    return res.json({ ok: true });
  },
};
