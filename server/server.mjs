import crypto from "crypto";
import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const TICKETS_FILE = path.join(DATA_DIR, "tickets.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

const PRIORITIES = new Set(["Critical", "High", "Medium", "Low"]);
const STATUSES = new Set(["Open", "In Progress", "Pending Client", "Resolved", "Closed"]);
const ROLES = new Set(["inorins", "client"]);
const MESSAGE_ROLES = new Set(["employee", "client"]);
const ALLOWED_UPLOAD_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.csv', '.xls', '.xlsx', '.txt', '.log']);

const FIELD_MAX_LENGTHS = { title: 200, description: 5000, moduleDetails: 2000, reporter: 100, reporterEmail: 200, content: 10000 };

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173').split(',');

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
const SESSION_SECRET = process.env.SESSION_SECRET || (() => {
  const s = crypto.randomBytes(32).toString('hex');
  console.warn('[security] SESSION_SECRET env var not set — using ephemeral secret. Sessions will not survive restarts.');
  return s;
})();

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
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

    res.json({ user: sanitizeUser(found), token: createSessionToken(found) });
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

app.get("/api/tickets/:id", async (req, res, next) => {
  try {
    const tickets = await loadTickets();
    const ticket = tickets.find((item) => item.id === req.params.id);
    if (!ticket) {
      res.status(404).json({ message: "Ticket not found." });
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
            attachment.url = `/uploads/${ticketId}/${encodeURIComponent(savedName)}`;
          }

          attachments.push(attachment);
        }
      }
    }

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

    const updated = await updateTicketById(req.params.id, (ticket) => ({
      ...ticket,
      status,
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

    res.json(withLastUpdated(updated));
  } catch (error) {
    next(error);
  }
});

app.get("/api/tickets/:id/messages", async (req, res, next) => {
  try {
    const tickets = await loadTickets();
    const exists = tickets.some((ticket) => ticket.id === req.params.id);
    if (!exists) {
      res.status(404).json({ message: "Ticket not found." });
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

    const message = {
      id: `${req.params.id}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
      author: author || (role === "client" ? "Client" : "Inorins Support"),
      role,
      content,
      timestamp: toMessageTimestamp(new Date()),
      isInternal: Boolean(req.body?.isInternal),
    };

    const messages = await loadMessages();
    const existing = messages[req.params.id] ?? [];
    messages[req.params.id] = [...existing, message];
    await writeJson(MESSAGES_FILE, messages);

    await updateTicketById(req.params.id, (ticket) => ({
      ...ticket,
      updatedAt: new Date().toISOString(),
    }));

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

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Internal server error." });
});

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
    app.listen(port, () => {
      console.log(`JSON API listening on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('Startup failed during password migration:', err);
    process.exit(1);
  });
