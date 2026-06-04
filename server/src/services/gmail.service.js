import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { env } from '../config/env.js';
import { InboxEmailModel } from '../models/InboxEmail.model.js';

async function fetchFromAccount(accountEmail, appPassword) {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: accountEmail, pass: appPassword },
    logger: false,
  });

  try {
    await client.connect();
    let fetched = 0;
    await client.mailboxOpen('INBOX');

    // Fetch UNSEEN messages
    const messages = client.fetch({ seen: false }, { source: true, uid: true });
    for await (const msg of messages) {
      try {
        const parsed = await simpleParser(msg.source);
        const uid = `${accountEmail}:${msg.uid}`;
        await InboxEmailModel.upsert({
          accountEmail,
          gmailUid: uid,
          messageId: parsed.messageId ?? null,
          senderName: parsed.from?.value?.[0]?.name ?? null,
          senderEmail: parsed.from?.value?.[0]?.address ?? '',
          replyTo: parsed.replyTo?.value?.[0]?.address ?? null,
          subject: parsed.subject ?? '(No Subject)',
          bodyText: parsed.text ?? null,
          bodyHtml: parsed.html ?? null,
          receivedAt: parsed.date ?? new Date(),
        });
        fetched++;
      } catch (err) {
        console.error('[gmail] Failed to parse message:', err.message);
      }
    }
    if (fetched > 0) console.log(`[gmail] Fetched ${fetched} new email(s) from ${accountEmail}`);
  } catch (err) {
    console.error(`[gmail] Error for ${accountEmail}:`, err.message);
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
}

export async function syncAllAccounts() {
  for (const account of env.GMAIL_ACCOUNTS) {
    await fetchFromAccount(account.email, account.password);
  }
}
