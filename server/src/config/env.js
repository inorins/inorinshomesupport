import 'dotenv/config';

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 3500,
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || '*').split(','),
  BACKUP_HOUR: Number(process.env.BACKUP_HOUR) || 19,

  SESSION_SECRET: process.env.SESSION_SECRET || '',

  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: Number(process.env.DB_PORT) || 3306,
  DB_NAME: process.env.DB_NAME || 'inorins_support',
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',

  MAIL_SENDER_NAME: process.env.MAIL_SENDER_NAME || 'Inorins Support',
  MAIL_SENDER: process.env.MAIL_SENDER || '',
  MAIL_HOST: process.env.MAIL_HOST || 'smtp.gmail.com',
  MAIL_PORT: Number(process.env.MAIL_PORT) || 587,
  MAIL_SECURE: process.env.MAIL_SECURE === 'true',
  MAIL_USER: process.env.MAIL_USER || '',
  MAIL_PASS: process.env.MAIL_PASS || '',

  GMAIL_ACCOUNTS: [
    {
      email: process.env.GMAIL_ACCOUNT_1_EMAIL || '',
      password: process.env.GMAIL_ACCOUNT_1_APP_PASSWORD || '',
    },
    {
      email: process.env.GMAIL_ACCOUNT_2_EMAIL || '',
      password: process.env.GMAIL_ACCOUNT_2_APP_PASSWORD || '',
    },
  ].filter((a) => a.email && a.password),

  GMAIL_POLL_INTERVAL: Number(process.env.GMAIL_POLL_INTERVAL) || 5,
};

if (!env.SESSION_SECRET || env.SESSION_SECRET === 'CHANGE_ME_USE_A_LONG_RANDOM_STRING_HERE') {
  console.warn('[env] SESSION_SECRET is not set — using an insecure default. Set it in .env for production.');
  env.SESSION_SECRET = 'insecure-default-secret-change-me';
}
