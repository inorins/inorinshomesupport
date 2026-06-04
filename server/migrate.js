/**
 * Migration script: JSON file storage → MySQL
 *
 * Usage:
 *   cd server
 *   node migrate.js
 *
 * Safe to run multiple times (idempotent via ON DUPLICATE KEY UPDATE).
 * File uploads in server/uploads/ remain on disk — no changes needed.
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

const db = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'inorins_support',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: false,
  charset: 'utf8mb4',
});

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

// ── 1. Users ──────────────────────────────────────────────────────────────────
async function migrateUsers() {
  const users = await readJson(path.join(DATA_DIR, 'users.json'), []);
  let count = 0;
  for (const u of users) {
    await db.execute(
      `INSERT INTO users
        (external_id, name, email, password_hash, role, title, is_active, is_department_head,
         bank_name, bank_domain, bank_short_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         email = VALUES(email),
         password_hash = VALUES(password_hash),
         role = VALUES(role),
         title = VALUES(title),
         is_active = VALUES(is_active),
         bank_name = VALUES(bank_name),
         bank_domain = VALUES(bank_domain),
         bank_short_code = VALUES(bank_short_code)`,
      [
        u.id,
        u.name ?? null,
        u.email,
        u.password,
        u.role,
        u.title ?? null,
        u.isActive !== false ? 1 : 0,
        u.bankName ?? null,
        u.bankDomain ?? null,
        u.bankShortCode ?? null,
      ]
    );
    count++;
  }
  console.log(`[migrate] Users: ${count} processed`);
  return users;
}

// ── 2. Tickets ────────────────────────────────────────────────────────────────
async function migrateTickets(users) {
  const tickets = await readJson(path.join(DATA_DIR, 'tickets.json'), []);
  let count = 0;

  function resolveUserId(nameOrEmail) {
    if (!nameOrEmail) return null;
    const u = users.find((x) => x.name === nameOrEmail || x.email === nameOrEmail);
    if (!u) return null;
    return getUserDbId(u.id);
  }

  for (const t of tickets) {
    const assigneeDbId = t.assignee ? await resolveUserId(t.assignee) : null;

    await db.execute(
      `INSERT INTO tickets
        (id, title, bank_name, system, module, module_details, form, request_type,
         requested_delivery, priority, status, environment, reporter, reporter_email,
         contact_name, contact_designation, contact_phone, assignee_id, description,
         attachments, sla_breach, sla_breach_notified_at, resolution_summary, resolution_cause,
         resolution_prevention, resolution_attachments, forward_note, is_edited,
         created_at, updated_at, started_at, resolved_at, edited_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         assignee_id = VALUES(assignee_id),
         updated_at = VALUES(updated_at)`,
      [
        t.id,
        t.title,
        t.bankName ?? null,
        t.system,
        t.module,
        t.moduleDetails ?? null,
        t.form,
        t.requestType ?? 'Issue',
        t.requestedDelivery ?? null,
        t.priority,
        t.status,
        t.environment ?? 'UAT',
        t.reporter,
        t.reporterEmail,
        t.contactName ?? null,
        t.contactDesignation ?? null,
        t.contactPhone ?? null,
        assigneeDbId,
        t.description,
        JSON.stringify(t.attachments ?? []),
        t.slaBreach ? 1 : 0,
        t.slaBreachNotifiedAt ?? null,
        t.resolutionNote?.summary ?? null,
        t.resolutionNote?.cause ?? null,
        t.resolutionNote?.preventionSteps ?? null,
        JSON.stringify(t.resolutionNote?.attachments ?? []),
        t.forwardNote ?? null,
        t.isEdited ? 1 : 0,
        t.createdAt ? new Date(t.createdAt) : new Date(),
        t.updatedAt ? new Date(t.updatedAt) : new Date(),
        t.startedAt ? new Date(t.startedAt) : null,
        t.resolvedAt ? new Date(t.resolvedAt) : null,
        t.editedAt ? new Date(t.editedAt) : null,
      ]
    );
    count++;
  }
  console.log(`[migrate] Tickets: ${count} processed`);
  return tickets;
}

// ── 3. Messages ───────────────────────────────────────────────────────────────
async function migrateMessages() {
  const messages = await readJson(path.join(DATA_DIR, 'messages.json'), {});
  let count = 0;
  for (const [ticketId, msgs] of Object.entries(messages)) {
    for (const m of (msgs ?? [])) {
      await db.execute(
        `INSERT INTO messages (id, ticket_id, author, role, content, is_internal, attachments, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE content = VALUES(content)`,
        [
          m.id,
          ticketId,
          m.author,
          m.role,
          m.content,
          m.isInternal ? 1 : 0,
          JSON.stringify(m.attachments ?? []),
          m.timestamp ? parseTimestamp(m.timestamp) : new Date(),
        ]
      );
      count++;
    }
  }
  console.log(`[migrate] Messages: ${count} processed`);
}

// ── 4. Notifications ──────────────────────────────────────────────────────────
async function migrateNotifications(users) {
  const notifs = await readJson(path.join(DATA_DIR, 'notifications.json'), {});
  let count = 0;
  for (const [externalUserId, ns] of Object.entries(notifs)) {
    const dbUserId = await getUserDbId(externalUserId);
    if (!dbUserId) continue;
    for (const n of (ns ?? [])) {
      await db.execute(
        `INSERT INTO notifications (id, user_id, type, ticket_id, ticket_title, message, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE is_read = VALUES(is_read)`,
        [
          n.id,
          dbUserId,
          n.type,
          n.ticketId ?? null,
          n.ticketTitle ?? null,
          n.message,
          n.isRead ? 1 : 0,
          n.createdAt ? new Date(n.createdAt) : new Date(),
        ]
      );
      count++;
    }
  }
  console.log(`[migrate] Notifications: ${count} processed`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const _userIdCache = new Map();
async function getUserDbId(externalId) {
  if (_userIdCache.has(externalId)) return _userIdCache.get(externalId);
  const [rows] = await db.execute('SELECT id FROM users WHERE external_id = ?', [externalId]);
  const id = rows[0]?.id ?? null;
  _userIdCache.set(externalId, id);
  return id;
}

function parseTimestamp(ts) {
  const d = new Date(ts);
  if (!Number.isNaN(d.getTime())) return d;
  return new Date();
}

// ── Run ───────────────────────────────────────────────────────────────────────
try {
  console.log('[migrate] Starting migration...');
  const users = await migrateUsers();
  await migrateTickets(users);
  await migrateMessages();
  await migrateNotifications(users);
  console.log('[migrate] Done! All data migrated successfully.');
} catch (err) {
  console.error('[migrate] Error:', err.message);
  console.error(err.stack);
  process.exitCode = 1;
} finally {
  await db.end();
}
