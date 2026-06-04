import crypto from "crypto";
import express from "express";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const TICKETS_FILE = path.join(DATA_DIR, "tickets.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const NOTIFICATIONS_FILE = path.join(DATA_DIR, "notifications.json");

const PRIORITIES = new Set(["Critical", "High", "Medium", "Low"]);
const STATUSES = new Set(["Open", "In Progress", "Pending Client", "Resolved", "Closed"]);
const ROLES = new Set(["inorins", "client"]);
const MESSAGE_ROLES = new Set(["employee", "client"]);
const ALLOWED_UPLOAD_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.csv', '.xls', '.xlsx', '.txt', '.log']);

const FIELD_MAX_LENGTHS = { title: 200, description: 5000, moduleDetails: 2000, reporter: 100, reporterEmail: 200, content: 10000, contactName: 100, contactDesignation: 100, contactPhone: 30, resolutionSummary: 3000, resolutionCause: 3000, resolutionPrevention: 3000 };

// const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://inorins.com.np,http://103.90.86.252:5173,https://103.90.86.252:5173').split(',');
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(','); // allow all origins for demo purposes; replace with specific origins in production

// ─── Password hashing (C1/C2) ───────────────────────────────────────────────
const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };

function hashPassword(plaintext) {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(plaintext, salt, SCRYPT_KEYLEN, SCRYPT_OPTS, (err, key) => {
      if (err) reject(err);
      else resolve(`scrypt$${salt}$${key.toString('hex')}`);
    });
  });
}

function verifyPassword(plaintext, stored) {
  if (typeof stored !== 'string') return Promise.resolve(false);
  if (!stored.startsWith('scrypt$')) {
    return Promise.resolve(false);
  }
  const parts = stored.split('$');
  const salt = parts[1];
  const storedHex = parts[2];
  if (!salt || !storedHex) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    crypto.scrypt(plaintext, salt, SCRYPT_KEYLEN, SCRYPT_OPTS, (err, key) => {
      if (err) { reject(err); return; }
      try {
        const storedBuf = Buffer.from(storedHex, 'hex');
        if (storedBuf.length !== key.length) { resolve(false); return; }
        resolve(crypto.timingSafeEqual(storedBuf, key));
      } catch { resolve(false); }
    });
  });
}

async function migratePasswordsIfNeeded() {
  const users = await loadUsers();
  let migrated = 0;
  for (const user of users) {
    if (user.password && !user.password.startsWith('scrypt$')) {
      user.password = await hashPassword(user.password);
      migrated++;
    }
  }
  if (migrated > 0) {
    await writeJson(USERS_FILE, users);
    console.log(`Migrated ${migrated} plaintext password(s) to scrypt hashes.`);
  }
}

// ─── Session tokens (M5) ────────────────────────────────────────────────────
const SESSION_SECRET_FILE = path.join(DATA_DIR, '.session-secret');

async function loadOrCreateSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  try {
    const stored = (await fs.readFile(SESSION_SECRET_FILE, 'utf-8')).trim();
    if (stored.length >= 32) return stored;
  } catch { /* file doesn't exist yet */ }
  const s = crypto.randomBytes(32).toString('hex');
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SESSION_SECRET_FILE, s, 'utf-8');
  return s;
}

const SESSION_SECRET = await loadOrCreateSessionSecret();

function createSessionToken(user) {
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    role: user.role,
    bankDomain: user.bankDomain ?? null,
    bankName: user.bankName ?? null,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function parseSessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  try {
    const sigBuf = Buffer.from(sig, 'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  } catch { return null; }
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
  } catch { return null; }
}

function getSessionUser(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return parseSessionToken(auth.slice(7));
}

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json({ limit: '50mb' }));

// Serve uploads with proper Content-Type headers and caching disabled
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.csv': 'text/csv; charset=utf-8',
      '.txt': 'text/plain',
      '.log': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
  }
}));

function sanitizeUser(user) {
  if (!user) {
    return null;
  }
  const { password, ...safeUser } = user;
  return safeUser;
}

function toRelativeTime(isoDate) {
  const updatedAt = new Date(isoDate).getTime();
  if (Number.isNaN(updatedAt)) {
    return "just now";
  }

  const diffMs = Date.now() - updatedAt;
  if (diffMs < 60_000) {
    return "just now";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function toMessageTimestamp(date) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kathmandu",
  });
}

function withLastUpdated(ticket) {
  const updatedAt = ticket.updatedAt ?? ticket.createdAt;
  return {
    ...ticket,
    requestType: ticket.requestType ?? 'Issue',
    lastUpdated: toRelativeTime(updatedAt),
  };
}

async function readJson(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      if (fallbackValue !== undefined) {
        await writeJson(filePath, fallbackValue);
        return fallbackValue;
      }
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf-8");
  await fs.rename(tempPath, filePath);
}

async function loadUsers() {
  return readJson(USERS_FILE, []);
}

async function loadTickets() {
  return readJson(TICKETS_FILE, []);
}

async function loadMessages() {
  return readJson(MESSAGES_FILE, {});
}

function nextTicketId(tickets) {
  const maxTicketNumber = tickets.reduce((max, ticket) => {
    const maybeNumber = Number(String(ticket.id).split("-")[1]);
    if (Number.isNaN(maybeNumber)) {
      return max;
    }
    return Math.max(max, maybeNumber);
  }, 2400);

  return `TKT-${maxTicketNumber + 1}`;
}

async function deriveBankNameFromEmail(email) {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!normalized.includes('@')) return undefined;
  const [, domain] = normalized.split('@');
  const users = await loadUsers();
  const matched = users.find((user) => user.bankDomain?.toLowerCase() === domain);
  return matched?.bankName;
}

let _ticketFileLock = Promise.resolve();
function withTicketLock(fn) {
  const next = _ticketFileLock.then(fn, fn);
  _ticketFileLock = next.then(() => {}, () => {});
  return next;
}

async function updateTicketById(ticketId, updater) {
  return withTicketLock(async () => {
    const tickets = await loadTickets();
    const index = tickets.findIndex((ticket) => ticket.id === ticketId);
    if (index < 0) return null;
    const current = tickets[index];
    const next = updater(current);
    tickets[index] = next;
    await writeJson(TICKETS_FILE, tickets);
    return next;
  });
}

// ─── Notifications helpers ───────────────────────────────────────────────────
async function loadNotifications() {
  return readJson(NOTIFICATIONS_FILE, {});
}

async function createNotification(userId, type, ticketId, ticketTitle, message) {
  const notifs = await loadNotifications();
  if (!notifs[userId]) notifs[userId] = [];
  notifs[userId].unshift({
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    type,
    ticketId,
    ticketTitle,
    message,
    isRead: false,
    createdAt: new Date().toISOString(),
  });
  // Keep at most 100 notifications per user
  if (notifs[userId].length > 100) notifs[userId] = notifs[userId].slice(0, 100);
  await writeJson(NOTIFICATIONS_FILE, notifs);
}

async function notifyAllInorinsStaff(type, ticketId, ticketTitle, message) {
  const users = await loadUsers();
  const staff = users.filter((u) => u.role === 'inorins');
  await Promise.all(staff.map((u) => createNotification(u.id, type, ticketId, ticketTitle, message)));
}

async function notifyAdminOnly(type, ticketId, ticketTitle, message) {
  const users = await loadUsers();
  const admin = users.find((u) => u.email?.toLowerCase() === 'inorins@inorins.com');
  if (admin) await createNotification(admin.id, type, ticketId, ticketTitle, message);
}

// ─── SLA helpers ─────────────────────────────────────────────────────────────
const SLA_HOURS = { Critical: 4, High: 8, Medium: 24, Low: 72 };

async function runSlaCheck() {
  const tickets = await loadTickets();
  const now = Date.now();
  let updated = false;
  for (const ticket of tickets) {
    if (ticket.status !== 'Open' && ticket.status !== 'In Progress') continue;
    if (ticket.slaBreachNotifiedAt) continue;
    const slaHours = SLA_HOURS[ticket.priority];
    if (!slaHours) continue;
    const ageHours = (now - new Date(ticket.createdAt).getTime()) / 3600000;
    if (ageHours >= slaHours) {
      ticket.slaBreach = true;
      ticket.slaBreachNotifiedAt = new Date().toISOString();
      updated = true;
      const msg = `: ${ticket.title} (${ticket.priority}, ${Math.floor(ageHours)}h old)`;
      if (ticket.assignee) {
        const users = await loadUsers();
        const assigneeUser = users.find((u) => u.name === ticket.assignee || u.email === ticket.assignee);
        if (assigneeUser) {
          await createNotification(assigneeUser.id, 'sla_breach', ticket.id, ticket.title, msg);
        } else {
          await notifyAdminOnly('sla_breach', ticket.id, ticket.title, msg);
        }
      } else {
        await notifyAdminOnly('sla_breach', ticket.id, ticket.title, msg);
      }
    }
  }
  if (updated) await writeJson(TICKETS_FILE, tickets);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/demo-users", async (_req, res, next) => {
  try {
    const users = await loadUsers();
    res.json(users.map(sanitizeUser));
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/users/:id", async (req, res, next) => {
  try {
    const users = await loadUsers();
    const user = users.find((item) => item.id === req.params.id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    res.json(sanitizeUser(user));
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ message: "Email and password are required." });
      return;
    }

    const users = await loadUsers();
    const normalizedEmail = email.trim().toLowerCase();
    let found = null;
    for (const user of users) {
      if (user.email.toLowerCase() === normalizedEmail) {
        if (await verifyPassword(password, user.password)) {
          found = user;
          break;
        }
      }
    }

    if (!found) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }

    if (found.isActive === false) {
      res.status(403).json({ message: "Your account has been deactivated. Please contact an administrator." });
      return;
    }

    res.json({ user: sanitizeUser(found), token: createSessionToken(found) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/change-password", async (req, res, next) => {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ message: "Current and new password are required." });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ message: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword.length > 128) {
      res.status(400).json({ message: "New password must be at most 128 characters." });
      return;
    }
    const users = await loadUsers();
    const userIndex = users.findIndex((u) => u.id === sessionUser.id);
    if (userIndex < 0) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    const isValid = await verifyPassword(currentPassword, users[userIndex].password);
    if (!isValid) {
      res.status(401).json({ message: "Current password is incorrect." });
      return;
    }
    users[userIndex] = { ...users[userIndex], password: await hashPassword(newPassword) };
    await writeJson(USERS_FILE, users);
    res.json({ message: "Password changed successfully." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/archive", async (req, res, next) => {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser || sessionUser.role !== 'inorins') {
      res.status(403).json({ message: "Access denied." });
      return;
    }
    const users = await loadUsers();
    const user = users.find((u) => u.id === sessionUser.id);
    if (!user || user.email.toLowerCase() !== 'inorins@inorins.com') {
      res.status(403).json({ message: "Access denied. Archive is only available to the admin account." });
      return;
    }
    const tickets = await loadTickets();
    const archived = tickets
      .filter((t) => t.status === 'Resolved' || t.status === 'Closed')
      .map(withLastUpdated)
      .sort((a, b) => {
        const aDate = new Date(a.resolvedAt ?? a.updatedAt ?? 0).getTime();
        const bDate = new Date(b.resolvedAt ?? b.updatedAt ?? 0).getTime();
        return bDate - aDate;
      });
    res.json(archived);
  } catch (error) {
    next(error);
  }
});

app.get("/api/tickets", async (req, res, next) => {
  try {
    const tickets = await loadTickets();
    const sessionUser = getSessionUser(req);
    let normalized = tickets
      .map(withLastUpdated)
      .sort((a, b) => {
        const aNum = Number(String(a.id).split("-")[1]) || 0;
        const bNum = Number(String(b.id).split("-")[1]) || 0;
        return bNum - aNum;
      });

    if (sessionUser?.role === 'client') {
      const domain = (sessionUser.bankDomain ?? '').toLowerCase();
      const bankNameLower = (sessionUser.bankName ?? '').toLowerCase();
      normalized = normalized.filter((t) => {
        const email = String(t.reporterEmail ?? '').toLowerCase();
        const emailMatches = domain ? email.endsWith(`@${domain}`) : false;
        const bankMatches = bankNameLower
          ? String(t.bankName ?? '').toLowerCase() === bankNameLower
          : false;
        return emailMatches || bankMatches;
      });
    }

    res.json(normalized);
  } catch (error) {
    next(error);
  }
});

function clientCanAccessTicket(sessionUser, ticket) {
  if (sessionUser?.role !== 'client') return true;
  const domain = (sessionUser.bankDomain ?? '').toLowerCase();
  const bankNameLower = (sessionUser.bankName ?? '').toLowerCase();
  const email = String(ticket.reporterEmail ?? '').toLowerCase();
  const emailMatches = domain ? email.endsWith(`@${domain}`) : false;
  const bankMatches = bankNameLower ? String(ticket.bankName ?? '').toLowerCase() === bankNameLower : false;
  return emailMatches || bankMatches;
}

app.get("/api/tickets/:id", async (req, res, next) => {
  try {
    const tickets = await loadTickets();
    const ticket = tickets.find((item) => item.id === req.params.id);
    if (!ticket) {
      res.status(404).json({ message: "Ticket not found." });
      return;
    }
    const sessionUser = getSessionUser(req);
    if (!clientCanAccessTicket(sessionUser, ticket)) {
      res.status(403).json({ message: "Access denied." });
      return;
    }
    res.json(withLastUpdated(ticket));
  } catch (error) {
    next(error);
  }
});

app.post("/api/tickets", async (req, res, next) => {
  try {
    const now = new Date();
    const payload = req.body ?? {};

    const title = String(payload.title ?? "").trim();
    const requestedBankName = String(payload.bankName ?? "").trim();
    const reporterEmail = String(payload.reporterEmail ?? "").trim();
    const system = String(payload.system ?? "").trim();
    const module = String(payload.module ?? "").trim();
    const form = String(payload.form ?? "").trim();

    if (!title || !system || !module || !form) {
      res.status(400).json({ message: "Title, system, module, and form are required." });
      return;
    }

    if (title.length > FIELD_MAX_LENGTHS.title) {
      res.status(400).json({ message: `Title must be at most ${FIELD_MAX_LENGTHS.title} characters.` });
      return;
    }
    const descriptionValue = String(payload.description ?? "");
    if (descriptionValue.length > FIELD_MAX_LENGTHS.description) {
      res.status(400).json({ message: `Description must be at most ${FIELD_MAX_LENGTHS.description} characters.` });
      return;
    }

    const priority = PRIORITIES.has(payload.priority) ? payload.priority : "Medium";
    const environment = payload.environment === "Production" ? "Production" : "UAT";
    const requestType = ['Issue', 'Add Form', 'Add Report'].includes(payload.requestType) ? payload.requestType : 'Issue';
    const requestedDelivery = typeof payload.requestedDelivery === 'string' ? payload.requestedDelivery : '';
    const moduleDetails = typeof payload.moduleDetails === 'string' ? payload.moduleDetails : '';
    const inferredBankName = await deriveBankNameFromEmail(reporterEmail);
    const bankName = requestedBankName || inferredBankName || '';

    const tickets = await loadTickets();
    const ticketId = nextTicketId(tickets);
    const uploadDir = path.join(__dirname, 'uploads', ticketId);

    const attachments = [];
    if (Array.isArray(payload.attachments)) {
      await fs.mkdir(uploadDir, { recursive: true });
      for (const item of payload.attachments) {
        if (
          item &&
          typeof item.name === 'string' &&
          typeof item.size === 'number' &&
          typeof item.type === 'string'
        ) {
          const attachment = {
            name: item.name,
            size: item.size,
            type: item.type,
          };

          if (typeof item.content === 'string') {
            const safeName = path.basename(item.name).replace(/[^a-zA-Z0-9._-]/g, '_');
            const ext = path.extname(safeName).toLowerCase();
            if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
              continue;
            }
            const savedName = `${Date.now()}-${safeName}`;
            const filePath = path.join(uploadDir, savedName);
            if (!filePath.startsWith(uploadDir)) {
              continue;
            }
            const base64 = item.content.split(',').pop() ?? '';
            const buffer = Buffer.from(base64, 'base64');
            await fs.writeFile(filePath, buffer);
            attachment.url = `/api/download/${ticketId}/${encodeURIComponent(savedName)}`;
          }

          attachments.push(attachment);
        }
      }
    }

    const contactName = typeof payload.contactName === 'string' ? payload.contactName.trim().slice(0, FIELD_MAX_LENGTHS.contactName) : '';
    const contactDesignation = typeof payload.contactDesignation === 'string' ? payload.contactDesignation.trim().slice(0, FIELD_MAX_LENGTHS.contactDesignation) : '';
    const contactPhone = typeof payload.contactPhone === 'string' ? payload.contactPhone.trim().slice(0, FIELD_MAX_LENGTHS.contactPhone) : '';

    const ticket = {
      id: ticketId,
      title,
      bankName: bankName || undefined,
      system,
      module,
      moduleDetails: moduleDetails || undefined,
      form,
      requestType,
      requestedDelivery: requestedDelivery || undefined,
      priority,
      status: "Open",
      environment,
      reporter: String(payload.reporter ?? "Unknown Reporter"),
      reporterEmail: String(payload.reporterEmail ?? "unknown@inorins.local"),
      contactName: contactName || undefined,
      contactDesignation: contactDesignation || undefined,
      contactPhone: contactPhone || undefined,
      assignee: "",
      description: String(payload.description ?? ""),
      attachments,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    tickets.push(ticket);
    await writeJson(TICKETS_FILE, tickets);

    const messages = await loadMessages();
    if (!messages[ticket.id]) {
      messages[ticket.id] = [];
      await writeJson(MESSAGES_FILE, messages);
    }

    // Notify all inorins staff about new ticket
    notifyAllInorinsStaff('new_ticket', ticket.id, ticket.title,
      `New ticket from ${ticket.bankName || ticket.reporter}: ${ticket.title}`
    ).catch(() => {});

    res.status(201).json(withLastUpdated(ticket));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/tickets/:id/status", async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!STATUSES.has(status)) {
      res.status(400).json({ message: "Invalid status value." });
      return;
    }

    // Require an assignee before moving to In Progress or Pending Client
    if (status === 'In Progress' || status === 'Pending Client') {
      const tickets = await loadTickets();
      const ticket = tickets.find((t) => t.id === req.params.id);
      if (ticket && !ticket.assignee?.trim()) {
        res.status(400).json({ message: "Please assign this ticket to a team member before changing the status." });
        return;
      }
    }

    const now = new Date().toISOString();
    const updated = await updateTicketById(req.params.id, (ticket) => {
      const update = { ...ticket, status, updatedAt: now };
      if (status === 'In Progress' && !ticket.startedAt) update.startedAt = now;
      return update;
    });

    if (!updated) {
      res.status(404).json({ message: "Ticket not found." });
      return;
    }

    // Notify reporter (client) about status change
    if (updated.reporterEmail) {
      const users = await loadUsers();
      const reporter = users.find((u) => u.email?.toLowerCase() === updated.reporterEmail.toLowerCase());
      if (reporter) {
        createNotification(reporter.id, 'status_changed', updated.id, updated.title,
          `Your ticket "${updated.title}" status changed to: ${status}`
        ).catch(() => {});
      }
    }

    res.json(withLastUpdated(updated));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/tickets/:id/resolve", async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!['Resolved', 'Closed'].includes(status)) {
      res.status(400).json({ message: "Status must be Resolved or Closed." });
      return;
    }

    // Require an assignee before resolving
    const tickets = await loadTickets();
    const existingTicket = tickets.find((t) => t.id === req.params.id);
    if (existingTicket && !existingTicket.assignee?.trim()) {
      res.status(400).json({ message: "Please assign this ticket to a team member before resolving it." });
      return;
    }

    const note = req.body?.resolutionNote;
    const summary = typeof note?.summary === 'string' ? note.summary.trim() : '';
    if (!summary) {
      res.status(400).json({ message: "Resolution summary is required." });
      return;
    }

    const resolvedAt = new Date().toISOString();

    const attachments = [];
    if (Array.isArray(note.attachments)) {
      const uploadDir = path.join(__dirname, 'uploads', req.params.id);
      await fs.mkdir(uploadDir, { recursive: true });
      for (const item of note.attachments) {
        if (item && typeof item.name === 'string' && typeof item.size === 'number' && typeof item.type === 'string') {
          const attachment = { name: item.name, size: item.size, type: item.type };
          if (typeof item.content === 'string') {
            const safeName = path.basename(item.name).replace(/[^a-zA-Z0-9._-]/g, '_');
            const ext = path.extname(safeName).toLowerCase();
            if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) continue;
            const savedName = `resolution-${Date.now()}-${safeName}`;
            const filePath = path.join(uploadDir, savedName);
            if (!path.resolve(filePath).startsWith(path.resolve(uploadDir))) continue;
            const base64 = item.content.split(',').pop() ?? '';
            await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
            attachment.url = `/api/download/${req.params.id}/${encodeURIComponent(savedName)}`;
          }
          attachments.push(attachment);
        }
      }
    }

    const resolutionNote = {
      summary: summary.slice(0, FIELD_MAX_LENGTHS.resolutionSummary),
      ...(typeof note.cause === 'string' && note.cause.trim() ? { cause: note.cause.trim().slice(0, FIELD_MAX_LENGTHS.resolutionCause) } : {}),
      ...(typeof note.preventionSteps === 'string' && note.preventionSteps.trim() ? { preventionSteps: note.preventionSteps.trim().slice(0, FIELD_MAX_LENGTHS.resolutionPrevention) } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
    };

    const updated = await updateTicketById(req.params.id, (ticket) => ({
      ...ticket,
      status,
      resolutionNote,
      resolvedAt: ticket.resolvedAt ?? resolvedAt,
      updatedAt: resolvedAt,
    }));

    if (!updated) {
      res.status(404).json({ message: "Ticket not found." });
      return;
    }

    res.json(withLastUpdated(updated));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/tickets/:id/assign", async (req, res, next) => {
  try {
    const assignee = String(req.body?.assignee ?? "").trim();

    const updated = await updateTicketById(req.params.id, (ticket) => ({
      ...ticket,
      assignee,
      updatedAt: new Date().toISOString(),
    }));

    if (!updated) {
      res.status(404).json({ message: "Ticket not found." });
      return;
    }

    // Notify the newly assigned staff member
    if (assignee) {
      const users = await loadUsers();
      const assigneeUser = users.find((u) => u.name === assignee || u.email === assignee);
      if (assigneeUser) {
        createNotification(assigneeUser.id, 'ticket_assigned', updated.id, updated.title,
          `You have been assigned ticket: ${updated.title}`
        ).catch(() => {});
      }
    }

    res.json(withLastUpdated(updated));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/tickets/:id/forward", async (req, res, next) => {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser || sessionUser.role !== 'inorins') {
      res.status(403).json({ message: "Only Inorins staff can forward tickets." });
      return;
    }

    const forwardedTo = String(req.body?.forwardedTo ?? '').trim();
    const forwardNote = String(req.body?.forwardNote ?? '').trim().slice(0, 1000);
    const forwardedBy = String(req.body?.forwardedBy ?? '').trim();

    if (!forwardedTo) {
      res.status(400).json({ message: "forwardedTo is required." });
      return;
    }

    const updated = await updateTicketById(req.params.id, (ticket) => ({
      ...ticket,
      assignee: forwardedTo,
      forwardedTo,
      forwardedBy: forwardedBy || 'Team',
      forwardNote: forwardNote || undefined,
      updatedAt: new Date().toISOString(),
    }));

    if (!updated) {
      res.status(404).json({ message: "Ticket not found." });
      return;
    }

    res.json(withLastUpdated(updated));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/tickets/:id/forward", async (req, res, next) => {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser || sessionUser.role !== 'inorins') {
      res.status(403).json({ message: "Access denied." });
      return;
    }

    const updated = await updateTicketById(req.params.id, (ticket) => {
      const { forwardedTo, forwardedBy, forwardNote, ...rest } = ticket;
      return { ...rest, updatedAt: new Date().toISOString() };
    });

    if (!updated) {
      res.status(404).json({ message: "Ticket not found." });
      return;
    }

    res.json(withLastUpdated(updated));
  } catch (error) {
    next(error);
  }
});

app.get("/api/tickets/:id/messages", async (req, res, next) => {
  try {
    const tickets = await loadTickets();
    const ticket = tickets.find((t) => t.id === req.params.id);
    if (!ticket) {
      res.status(404).json({ message: "Ticket not found." });
      return;
    }
    const sessionUser = getSessionUser(req);
    if (!clientCanAccessTicket(sessionUser, ticket)) {
      res.status(403).json({ message: "Access denied." });
      return;
    }

    const messages = await loadMessages();
    res.json(messages[req.params.id] ?? []);
  } catch (error) {
    next(error);
  }
});

app.post("/api/tickets/:id/messages", async (req, res, next) => {
  try {
    const tickets = await loadTickets();
    const ticketExists = tickets.some((ticket) => ticket.id === req.params.id);
    if (!ticketExists) {
      res.status(404).json({ message: "Ticket not found." });
      return;
    }

    const content = String(req.body?.content ?? "").trim();
    if (!content) {
      res.status(400).json({ message: "Message content is required." });
      return;
    }
    if (content.length > FIELD_MAX_LENGTHS.content) {
      res.status(400).json({ message: `Message content must be at most ${FIELD_MAX_LENGTHS.content} characters.` });
      return;
    }

    const role = MESSAGE_ROLES.has(req.body?.role) ? req.body.role : "employee";
    const author = String(
      req.body?.author ?? (role === "client" ? "Client" : "Inorins Support"),
    ).trim();

    const attachments = [];
    if (Array.isArray(req.body?.attachments)) {
      const uploadDir = path.join(__dirname, 'uploads', req.params.id);
      await fs.mkdir(uploadDir, { recursive: true });
      for (const item of req.body.attachments) {
        if (item && typeof item.name === 'string' && typeof item.size === 'number' && typeof item.type === 'string') {
          const attachment = { name: item.name, size: item.size, type: item.type };
          if (typeof item.content === 'string') {
            const safeName = path.basename(item.name).replace(/[^a-zA-Z0-9._-]/g, '_');
            const ext = path.extname(safeName).toLowerCase();
            if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) continue;
            const savedName = `msg-${Date.now()}-${safeName}`;
            const filePath = path.join(uploadDir, savedName);
            if (!path.resolve(filePath).startsWith(path.resolve(uploadDir))) continue;
            const base64 = item.content.split(',').pop() ?? '';
            await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
            attachment.url = `/api/download/${req.params.id}/${encodeURIComponent(savedName)}`;
          }
          attachments.push(attachment);
        }
      }
    }

    const message = {
      id: `${req.params.id}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
      author: author || (role === "client" ? "Client" : "Inorins Support"),
      role,
      content,
      timestamp: toMessageTimestamp(new Date()),
      isInternal: Boolean(req.body?.isInternal),
      ...(attachments.length > 0 ? { attachments } : {}),
    };

    const messages = await loadMessages();
    const existing = messages[req.params.id] ?? [];
    messages[req.params.id] = [...existing, message];
    await writeJson(MESSAGES_FILE, messages);

    const updatedTicket = await updateTicketById(req.params.id, (ticket) => ({
      ...ticket,
      updatedAt: new Date().toISOString(),
    }));

    // Cross-notify: client reply → notify assignee (or all staff); staff reply → notify reporter
    if (updatedTicket && !message.isInternal) {
      const users = await loadUsers();
      if (role === 'client') {
        if (updatedTicket.assignee) {
          const assigneeUser = users.find((u) => u.name === updatedTicket.assignee || u.email === updatedTicket.assignee);
          if (assigneeUser) {
            createNotification(assigneeUser.id, 'new_client_reply', updatedTicket.id, updatedTicket.title,
              `Client replied on ticket: ${updatedTicket.title}`
            ).catch(() => {});
          } else {
            notifyAdminOnly('new_client_reply', updatedTicket.id, updatedTicket.title,
              `Client replied on ticket: ${updatedTicket.title}`
            ).catch(() => {});
          }
        } else {
          notifyAllInorinsStaff('new_client_reply', updatedTicket.id, updatedTicket.title,
            `Client replied on ticket: ${updatedTicket.title}`
          ).catch(() => {});
        }
      } else {
        // Staff replied — notify the reporter (client)
        if (updatedTicket.reporterEmail) {
          const reporter = users.find((u) => u.email?.toLowerCase() === updatedTicket.reporterEmail.toLowerCase());
          if (reporter) {
            createNotification(reporter.id, 'new_staff_reply', updatedTicket.id, updatedTicket.title,
              `Support team replied on your ticket: ${updatedTicket.title}`
            ).catch(() => {});
          }
        }
      }
    }

    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

app.get("/api/stats", async (_req, res, next) => {
  try {
    const tickets = await loadTickets();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const openTickets = tickets.filter((ticket) => ticket.status === "Open").length;
    const resolvedThisWeek = tickets.filter(
      (ticket) => ticket.status === "Resolved" && new Date(ticket.updatedAt).getTime() >= weekAgo,
    ).length;
    const pendingOurAction = tickets.filter((ticket) => ticket.status === "In Progress").length;

    res.json({
      openTickets,
      resolvedThisWeek,
      pendingOurAction,
    });
  } catch (error) {
    next(error);
  }
});

// Download file endpoint with proper streaming
app.get("/api/download/:ticketId/:filename", async (req, res, next) => {
  try {
    const { ticketId, filename } = req.params;
    const filePath = path.join(__dirname, 'uploads', ticketId, filename);

    // Security check: ensure path is within uploads/ticketId directory
    const resolvedPath = path.resolve(filePath);
    const uploadDir = path.resolve(path.join(__dirname, 'uploads', ticketId));
    if (!resolvedPath.startsWith(uploadDir + path.sep)) {
      res.status(403).json({ message: "Access denied." });
      return;
    }
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      res.status(404).json({ message: "File not found." });
      return;
    }
    
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.csv': 'text/csv; charset=utf-8',
      '.txt': 'text/plain',
      '.log': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const fileStream = createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
});

app.post("/api/subscribe", async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      res.status(400).json({ success: false, message: "A valid email address is required." });
      return;
    }
    const subscribersFile = path.join(DATA_DIR, "subscribers.json");
    let subscribers = [];
    try {
      const raw = await fs.readFile(subscribersFile, "utf-8");
      subscribers = JSON.parse(raw);
    } catch { /* file may not exist yet */ }
    if (!subscribers.includes(email)) {
      subscribers.push(email);
      await writeJson(subscribersFile, subscribers);
    }
    res.json({ success: true, message: "Thank you for subscribing! We'll be in touch." });
  } catch (error) {
    next(error);
  }
});

// ─── Notification routes ─────────────────────────────────────────────────────
app.get("/api/notifications", async (req, res, next) => {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) { res.status(401).json({ message: "Authentication required." }); return; }
    const all = await loadNotifications();
    res.json(all[sessionUser.id] ?? []);
  } catch (error) { next(error); }
});

app.patch("/api/notifications/read-all", async (req, res, next) => {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) { res.status(401).json({ message: "Authentication required." }); return; }
    const all = await loadNotifications();
    if (all[sessionUser.id]) {
      all[sessionUser.id] = all[sessionUser.id].map((n) => ({ ...n, isRead: true }));
      await writeJson(NOTIFICATIONS_FILE, all);
    }
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.patch("/api/notifications/:id/read", async (req, res, next) => {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) { res.status(401).json({ message: "Authentication required." }); return; }
    const all = await loadNotifications();
    if (all[sessionUser.id]) {
      all[sessionUser.id] = all[sessionUser.id].map((n) =>
        n.id === req.params.id ? { ...n, isRead: true } : n
      );
      await writeJson(NOTIFICATIONS_FILE, all);
    }
    res.json({ ok: true });
  } catch (error) { next(error); }
});

// ─── Ticket edit by client ───────────────────────────────────────────────────
app.patch("/api/tickets/:id/edit", async (req, res, next) => {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser || sessionUser.role !== 'client') {
      res.status(403).json({ message: "Only clients can edit tickets." }); return;
    }

    const tickets = await loadTickets();
    const ticket = tickets.find((t) => t.id === req.params.id);
    if (!ticket) { res.status(404).json({ message: "Ticket not found." }); return; }

    if (ticket.status !== 'Open' && ticket.status !== 'Pending Client') {
      res.status(400).json({ message: "Ticket can only be edited when Open or Pending Client." }); return;
    }

    const email = (sessionUser.bankDomain ?? '');
    const reporterEmailLower = ticket.reporterEmail?.toLowerCase() ?? '';
    const bankNameLower = (sessionUser.bankName ?? '').toLowerCase();
    const emailMatch = email ? reporterEmailLower.endsWith(`@${email}`) : false;
    const bankMatch = bankNameLower ? String(ticket.bankName ?? '').toLowerCase() === bankNameLower : false;
    if (!emailMatch && !bankMatch) {
      res.status(403).json({ message: "Access denied." }); return;
    }

    const payload = req.body ?? {};
    const allowedFields = ['title', 'description', 'priority', 'requestType', 'requestedDelivery',
      'system', 'module', 'form', 'moduleDetails', 'contactName', 'contactDesignation', 'contactPhone'];
    const updates = {};
    for (const field of allowedFields) {
      if (field in payload && typeof payload[field] === 'string') {
        updates[field] = payload[field].trim().slice(0, FIELD_MAX_LENGTHS[field] ?? 500);
      }
    }
    if (payload.priority && PRIORITIES.has(payload.priority)) updates.priority = payload.priority;

    const now = new Date().toISOString();
    const updated = await updateTicketById(req.params.id, (t) => ({
      ...t, ...updates, isEdited: true, editedAt: now, updatedAt: now,
    }));

    // Post a system message about the edit
    const messages = await loadMessages();
    const existing = messages[req.params.id] ?? [];
    const sysMsg = {
      id: `${req.params.id}-edit-${Date.now()}`,
      author: 'System',
      role: 'employee',
      content: 'Ticket details were edited by the client.',
      timestamp: toMessageTimestamp(new Date()),
      isInternal: false,
    };
    messages[req.params.id] = [...existing, sysMsg];
    await writeJson(MESSAGES_FILE, messages);

    // Notify assignee or all staff about the edit
    if (updated.assignee) {
      const users = await loadUsers();
      const assigneeUser = users.find((u) => u.name === updated.assignee || u.email === updated.assignee);
      if (assigneeUser) {
        createNotification(assigneeUser.id, 'ticket_edited', updated.id, updated.title,
          `Client edited ticket details: ${updated.title}`
        ).catch(() => {});
      } else {
        notifyAdminOnly('ticket_edited', updated.id, updated.title, `Client edited ticket: ${updated.title}`).catch(() => {});
      }
    } else {
      notifyAllInorinsStaff('ticket_edited', updated.id, updated.title, `Client edited ticket: ${updated.title}`).catch(() => {});
    }

    res.json(withLastUpdated(updated));
  } catch (error) { next(error); }
});

// ─── Admin user management ───────────────────────────────────────────────────
function requireAdmin(req, res) {
  const sessionUser = getSessionUser(req);
  if (!sessionUser || sessionUser.role !== 'inorins') {
    res.status(403).json({ message: "Access denied." }); return null;
  }
  return sessionUser;
}

app.get("/api/admin/users", async (req, res, next) => {
  try {
    const sessionUser = requireAdmin(req, res);
    if (!sessionUser) return;
    const users = await loadUsers();
    const adminUser = users.find((u) => u.id === sessionUser.id);
    if (!adminUser || adminUser.email?.toLowerCase() !== 'inorins@inorins.com') {
      res.status(403).json({ message: "Access denied." }); return;
    }
    res.json(users.map(sanitizeUser));
  } catch (error) { next(error); }
});

app.post("/api/admin/users", async (req, res, next) => {
  try {
    const sessionUser = requireAdmin(req, res);
    if (!sessionUser) return;
    const users = await loadUsers();
    const adminUser = users.find((u) => u.id === sessionUser.id);
    if (!adminUser || adminUser.email?.toLowerCase() !== 'inorins@inorins.com') {
      res.status(403).json({ message: "Access denied." }); return;
    }

    const { name, email, password, role, title, bankName, bankDomain, bankShortCode } = req.body ?? {};
    if (!name || !email || !password || !role) {
      res.status(400).json({ message: "Name, email, password, and role are required." }); return;
    }
    if (!ROLES.has(role)) { res.status(400).json({ message: "Invalid role." }); return; }
    if (String(password).length < 8) { res.status(400).json({ message: "Password must be at least 8 characters." }); return; }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (users.find((u) => u.email?.toLowerCase() === normalizedEmail)) {
      res.status(409).json({ message: "A user with this email already exists." }); return;
    }

    const newUser = {
      id: `user-${Date.now()}`,
      name: String(name).trim().slice(0, 100),
      email: normalizedEmail,
      password: await hashPassword(password),
      role,
      title: String(title ?? '').trim().slice(0, 100),
      isActive: true,
      ...(role === 'client' ? {
        bankName: String(bankName ?? '').trim(),
        bankDomain: String(bankDomain ?? '').trim().toLowerCase(),
        bankShortCode: String(bankShortCode ?? '').trim(),
      } : {}),
    };

    users.push(newUser);
    await writeJson(USERS_FILE, users);
    res.status(201).json(sanitizeUser(newUser));
  } catch (error) { next(error); }
});

app.patch("/api/admin/users/:id", async (req, res, next) => {
  try {
    const sessionUser = requireAdmin(req, res);
    if (!sessionUser) return;
    const users = await loadUsers();
    const adminUser = users.find((u) => u.id === sessionUser.id);
    if (!adminUser || adminUser.email?.toLowerCase() !== 'inorins@inorins.com') {
      res.status(403).json({ message: "Access denied." }); return;
    }

    const idx = users.findIndex((u) => u.id === req.params.id);
    if (idx < 0) { res.status(404).json({ message: "User not found." }); return; }

    const { name, email, role, title, bankName, bankDomain, bankShortCode, isActive } = req.body ?? {};
    const updates = {};
    if (name) updates.name = String(name).trim().slice(0, 100);
    if (email) updates.email = String(email).trim().toLowerCase();
    if (role && ROLES.has(role)) updates.role = role;
    if (title !== undefined) updates.title = String(title).trim().slice(0, 100);
    if (bankName !== undefined) updates.bankName = String(bankName).trim();
    if (bankDomain !== undefined) updates.bankDomain = String(bankDomain).trim().toLowerCase();
    if (bankShortCode !== undefined) updates.bankShortCode = String(bankShortCode).trim();
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    users[idx] = { ...users[idx], ...updates };
    await writeJson(USERS_FILE, users);
    res.json(sanitizeUser(users[idx]));
  } catch (error) { next(error); }
});

app.patch("/api/admin/users/:id/reset-password", async (req, res, next) => {
  try {
    const sessionUser = requireAdmin(req, res);
    if (!sessionUser) return;
    const users = await loadUsers();
    const adminUser = users.find((u) => u.id === sessionUser.id);
    if (!adminUser || adminUser.email?.toLowerCase() !== 'inorins@inorins.com') {
      res.status(403).json({ message: "Access denied." }); return;
    }

    const { newPassword } = req.body ?? {};
    if (!newPassword || String(newPassword).length < 8) {
      res.status(400).json({ message: "New password must be at least 8 characters." }); return;
    }

    const idx = users.findIndex((u) => u.id === req.params.id);
    if (idx < 0) { res.status(404).json({ message: "User not found." }); return; }

    users[idx] = { ...users[idx], password: await hashPassword(String(newPassword)) };
    await writeJson(USERS_FILE, users);
    res.json({ message: "Password reset successfully." });
  } catch (error) { next(error); }
});

app.delete("/api/admin/users/:id", async (req, res, next) => {
  try {
    const sessionUser = requireAdmin(req, res);
    if (!sessionUser) return;
    const users = await loadUsers();
    const adminUser = users.find((u) => u.id === sessionUser.id);
    if (!adminUser || adminUser.email?.toLowerCase() !== 'inorins@inorins.com') {
      res.status(403).json({ message: "Access denied." }); return;
    }
    if (req.params.id === sessionUser.id) {
      res.status(400).json({ message: "Cannot deactivate your own account." }); return;
    }

    const idx = users.findIndex((u) => u.id === req.params.id);
    if (idx < 0) { res.status(404).json({ message: "User not found." }); return; }

    users[idx] = { ...users[idx], isActive: false };
    await writeJson(USERS_FILE, users);
    res.json({ message: "User deactivated." });
  } catch (error) { next(error); }
});

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Internal server error." });
});

// ─── SLA check every 15 minutes ─────────────────────────────────────────────
setInterval(() => {
  runSlaCheck().catch((err) => console.error('[sla] Check failed:', err));
}, 15 * 60 * 1000);
setTimeout(() => {
  runSlaCheck().catch((err) => console.error('[sla] Initial check failed:', err));
}, 60 * 1000);

// ─── Daily backup at 7 PM ───────────────────────────────────────────────────
const BACKUP_DIR = path.join(__dirname, 'backups');
const BACKUP_HOUR = Number(process.env.BACKUP_HOUR ?? 19); // 12 = 12 PM

async function runBackup() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const dest = path.join(BACKUP_DIR, dateStr);
  await fs.mkdir(dest, { recursive: true });
  const files = [TICKETS_FILE, MESSAGES_FILE, USERS_FILE];
  await Promise.all(files.map(f => fs.copyFile(f, path.join(dest, path.basename(f)))));
  console.log(`[backup] Saved to ${dest}`);
}

let _lastBackupDate = null;
setInterval(() => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (now.getHours() >= BACKUP_HOUR && _lastBackupDate !== today) {
    _lastBackupDate = today;
    runBackup().catch(err => console.error('[backup] Failed:', err));
  }
}, 3600 * 1000); // check every hour

const port = Number(process.env.API_PORT || 3500);
migratePasswordsIfNeeded()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
  console.log("Server running on port 3500");
});
  })
  .catch((err) => {
    console.error('Startup failed during password migration:', err);
    process.exit(1);
  });
