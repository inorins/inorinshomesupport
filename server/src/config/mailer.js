import nodemailer from 'nodemailer';
import { env } from './env.js';

export const transporter = nodemailer.createTransport({
  host: env.MAIL_HOST,
  port: env.MAIL_PORT,
  secure: env.MAIL_SECURE,
  auth: {
    user: env.MAIL_USER,
    pass: env.MAIL_PASS,
  },
});

export const FROM = `"${env.MAIL_SENDER_NAME}" <${env.MAIL_SENDER}>`;

/** Call once at startup to confirm SMTP credentials are valid. */
export async function verifyMailer() {
  if (!env.MAIL_USER || !env.MAIL_PASS) {
    console.warn('[mailer] MAIL_USER or MAIL_PASS is not set — outgoing email is disabled.');
    return;
  }
  try {
    await transporter.verify();
    console.log(`[mailer] ✓ SMTP ready — sending from ${FROM}`);
  } catch (err) {
    console.error('[mailer] ✗ SMTP connection failed:', err.message);
  }
}
