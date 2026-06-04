import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import fs from 'fs/promises';
import { env } from '../config/env.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');

export async function runBackup() {
  const dateStr = new Date().toISOString().slice(0, 10);
  const dest = path.join(BACKUP_DIR, dateStr);
  await fs.mkdir(dest, { recursive: true });

  const dumpFile = path.join(dest, `${env.DB_NAME}.sql`);
  const cmd = `mysqldump -h ${env.DB_HOST} -P ${env.DB_PORT} -u ${env.DB_USER} --password=${env.DB_PASSWORD} ${env.DB_NAME} > "${dumpFile}"`;

  try {
    await execAsync(cmd);
    console.log(`[backup] MySQL dump saved to ${dumpFile}`);
  } catch (err) {
    console.error('[backup] mysqldump failed:', err.message);
  }
}
