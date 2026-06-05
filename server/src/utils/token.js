import crypto from 'crypto';
import { env } from '../config/env.js';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

export function createSessionToken(user) {
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    role: user.role,
    bankDomain: user.bank_domain ?? user.bankDomain ?? null,
    bankName: user.bank_name ?? user.bankName ?? null,
    exp: Date.now() + SESSION_DURATION_MS,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', env.SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function parseSessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', env.SESSION_SECRET).update(payload).digest('base64url');
  try {
    const sigBuf = Buffer.from(sig, 'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  } catch { return null; }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (parsed?.exp && Date.now() > parsed.exp) return null; // expired
    return parsed;
  } catch { return null; }
}

export function getSessionUser(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return parseSessionToken(auth.slice(7));
}
