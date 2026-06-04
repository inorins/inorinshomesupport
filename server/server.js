import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

import { env } from './src/config/env.js';
import { testConnection, runMigrations } from './src/config/database.js';

import authRoutes from './src/routes/auth.routes.js';
import ticketRoutes from './src/routes/ticket.routes.js';
import messageRoutes from './src/routes/message.routes.js';
import notificationRoutes from './src/routes/notification.routes.js';
import adminRoutes from './src/routes/admin.routes.js';
import inboxRoutes from './src/routes/inbox.routes.js';
import fileRoutes from './src/routes/file.routes.js';
import systemChangeRoutes from './src/routes/system-change.routes.js';

import { runSlaCheck } from './src/services/sla.service.js';
import { syncAllAccounts } from './src/services/gmail.service.js';
import { runBackup } from './src/services/backup.service.js';
import { verifyMailer } from './src/config/mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (env.ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && env.ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  next();
});

app.use(express.json({ limit: '50mb' }));

// ── Static uploads ─────────────────────────────────────────────────────────────
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// ── API routes ─────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, version: '2.0.0' }));

app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/tickets/:id/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/download', fileRoutes);
app.use('/api/system-changes', systemChangeRoutes);

// Subscribe (newsletter)
app.post('/api/subscribe', express.json(), async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }
    const { pool } = await import('./src/config/database.js');
    await pool.query(
      'INSERT INTO subscribers (email) VALUES (?) ON DUPLICATE KEY UPDATE email = email',
      [email]
    );
    return res.json({ success: true, message: "Thank you for subscribing! We'll be in touch." });
  } catch (err) { next(err); }
});

// Redirect old /api/stats route
app.get('/api/stats', async (req, res, next) => {
  try {
    const { pool } = await import('./src/config/database.js');
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
  } catch (err) { next(err); }
});

app.get('/api/archive', async (req, res, next) => {
  try {
    const { TicketController } = await import('./src/controllers/ticket.controller.js');
    return TicketController.getArchive(req, res, next);
  } catch (err) { next(err); }
});

// 404 + error handler
app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error.' });
});

// ── Cron jobs ──────────────────────────────────────────────────────────────────
// SLA check every 15 minutes
cron.schedule('*/15 * * * *', () => {
  runSlaCheck().catch((err) => console.error('[sla]', err.message));
});

// Gmail sync every N minutes
cron.schedule(`*/${env.GMAIL_POLL_INTERVAL} * * * *`, () => {
  syncAllAccounts().catch((err) => console.error('[gmail]', err.message));
});

// Daily backup at configured hour (check every hour)
let lastBackupDate = null;
cron.schedule('0 * * * *', () => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (now.getHours() >= env.BACKUP_HOUR && lastBackupDate !== today) {
    lastBackupDate = today;
    runBackup().catch((err) => console.error('[backup]', err.message));
  }
});

// ── Start ──────────────────────────────────────────────────────────────────────
async function start() {
  await testConnection();
  console.log('[db] Connected to MySQL');
  await runMigrations();

  await verifyMailer();

  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`[server] Listening on port ${env.PORT}`);
  });

  // Initial Gmail sync after 30 seconds
  setTimeout(() => syncAllAccounts().catch(() => {}), 30_000);
  // Initial SLA check after 60 seconds
  setTimeout(() => runSlaCheck().catch(() => {}), 60_000);
}

start().catch((err) => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});
