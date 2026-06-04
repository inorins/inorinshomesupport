import { transporter, FROM } from '../config/mailer.js';
import { UserModel, deliveryAddress } from '../models/User.model.js';

// ── Brand colours (derived from the app's CSS variables) ─────────────────────
const C = {
  primary:    '#af2828',   // hsl(0 63% 42%)   — brand red
  secondary:  '#125368',   // hsl(195 65% 24%)  — dark teal
  navy:       '#0f1d2e',   // hsl(215 25% 12%)  — sidebar / header
  navyLight:  '#1a2f45',   // hsl(215 25% 18%)  — sidebar accent
  success:    '#1a9948',   // hsl(142 71% 35%)  — resolved / green
  warning:    '#b87a00',   // hsl(45 93% 47%)   — pending / amber (darkened for email text)
  info:       '#0e7da8',   // hsl(200 80% 50%)  — in-progress / teal-blue (darkened)
  critical:   '#b91c1c',   // deep red
  high:       '#c2410c',   // orange-red
  medium:     '#125368',   // teal (secondary)
  low:        '#475569',   // slate
  muted:      '#64748b',
  border:     '#e2e8f0',
  bg:         '#f1f5f9',
  text:       '#1e293b',
};

function priorityBadge(priority) {
  const map = {
    Critical: { bg: '#fef2f2', border: '#fca5a5', color: C.critical },
    High:     { bg: '#fff7ed', border: '#fdba74', color: C.high },
    Medium:   { bg: '#eff9ff', border: '#bae6fd', color: C.info },
    Low:      { bg: '#f8fafc', border: '#cbd5e1', color: C.low },
  };
  const s = map[priority] || { bg: '#f8fafc', border: '#cbd5e1', color: C.muted };
  return `<span style="display:inline-block;padding:2px 10px;border-radius:20px;background:${s.bg};border:1px solid ${s.border};color:${s.color};font-size:12px;font-weight:600">${priority}</span>`;
}

function statusBadge(status) {
  const map = {
    'Open':           { bg: '#fef2f2', border: '#fca5a5', color: C.primary },
    'In Progress':    { bg: '#eff9ff', border: '#bae6fd', color: C.info },
    'Pending Client': { bg: '#fffbeb', border: '#fcd34d', color: C.warning },
    'Resolved':       { bg: '#f0fdf4', border: '#86efac', color: C.success },
    'Closed':         { bg: '#f8fafc', border: '#cbd5e1', color: C.muted },
  };
  const s = map[status] || { bg: '#f8fafc', border: '#cbd5e1', color: C.muted };
  return `<span style="display:inline-block;padding:2px 10px;border-radius:20px;background:${s.bg};border:1px solid ${s.border};color:${s.color};font-size:12px;font-weight:600">${status}</span>`;
}

function row(label, value, odd = false) {
  return `<tr>
    <td style="padding:10px 14px;width:36%;font-size:13px;font-weight:600;color:${C.muted};background:${odd ? C.bg : '#fff'};border-bottom:1px solid ${C.border}">${label}</td>
    <td style="padding:10px 14px;font-size:13px;color:${C.text};background:${odd ? C.bg : '#fff'};border-bottom:1px solid ${C.border}">${value}</td>
  </tr>`;
}

function ticketTable(ticket) {
  return `
  <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid ${C.border};margin:16px 0">
    ${row('Ticket ID',       `<span style="font-family:monospace;font-weight:700;color:${C.secondary};font-size:14px">${ticket.id}</span>`, false)}
    ${row('Title',           `<strong>${ticket.title}</strong>`, true)}
    ${row('Bank / Reporter', ticket.bankName || ticket.reporter, false)}
    ${row('System › Module', `${ticket.system} › ${ticket.module}`, true)}
    ${row('Priority',        priorityBadge(ticket.priority), false)}
    ${row('Status',          statusBadge(ticket.status), true)}
    ${row('Reporter Email',  ticket.reporterEmail, false)}
    ${row('Created',         new Date(ticket.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }), true)}
  </table>`;
}

function wrapHtml(title, body) {
  const headerAccentColor = C.primary;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:'Segoe UI',Arial,sans-serif;color:${C.text}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- ── Header ─────────────────────────────────────────── -->
        <tr><td style="background:${C.navy};border-radius:10px 10px 0 0;padding:0">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:22px 28px 18px">
                <div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.3px">Inorins Technologies</div>
                <div style="font-size:12px;color:#94a3b8;margin-top:3px;letter-spacing:0.5px;text-transform:uppercase">Support Management System</div>
              </td>
              <td align="right" style="padding:22px 28px 18px">
                <div style="display:inline-block;background:${headerAccentColor};color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:0.5px;text-transform:uppercase">Support System</div>
              </td>
            </tr>
            <tr><td colspan="2" style="height:3px;background:${headerAccentColor}"></td></tr>
          </table>
        </td></tr>

        <!-- ── Body ───────────────────────────────────────────── -->
        <tr><td style="background:#fff;padding:28px 28px 24px">
          <h2 style="margin:0 0 20px;font-size:17px;font-weight:700;color:${C.text};border-left:4px solid ${headerAccentColor};padding-left:12px">${title}</h2>
          ${body}
        </td></tr>

        <!-- ── Footer ─────────────────────────────────────────── -->
        <tr><td style="background:${C.navyLight};border-radius:0 0 10px 10px;padding:16px 28px">
          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6">
            This is an automated notification from the <strong style="color:#cbd5e1">Inorins Technologies Support System</strong>.<br>
            Please do not reply directly to this email.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendToHeads(subject, html, text) {
  const heads = await UserModel.findDepartmentHeads();
  if (!heads.length) {
    console.warn('[email] sendToHeads: no active department heads found — skipping alert:', subject);
    return;
  }
  console.log(`[email] Sending "${subject}" to ${heads.length} department head(s):`, heads.map((h) => deliveryAddress(h) || h.email));
  await Promise.all(heads.map((h) => {
    const to = deliveryAddress(h);
    if (!to) {
      console.warn('[email] Department head has no email address:', h.name);
      return;
    }
    return transporter.sendMail({ from: FROM, to, subject, html, text })
      .then(() => console.log(`[email] ✓ Sent to ${to}`))
      .catch((err) => console.error(`[email] ✗ Failed to send to ${to}:`, err.message));
  }));
}

/** Resolve the delivery address for a client ticket — looks up the reporter's user record for default_mail. */
async function clientDeliveryAddress(reporterEmail) {
  if (!reporterEmail) return null;
  const user = await UserModel.findByEmail(reporterEmail).catch(() => null);
  return deliveryAddress(user) || reporterEmail;
}

function infoBox(text, color = C.secondary) {
  return `<p style="background:${color}12;border-left:4px solid ${color};border-radius:0 6px 6px 0;padding:12px 16px;margin:16px 0;font-size:14px;color:${C.text};line-height:1.6">${text}</p>`;
}

function para(text) {
  return `<p style="margin:0 0 12px;font-size:14px;color:${C.text};line-height:1.7">${text}</p>`;
}

export const EmailService = {
  async sendNewTicketAlert(ticket) {
    const subject = `[New Ticket] ${ticket.id} — ${ticket.title}`;
    const body = `
      ${para('A new support ticket has been submitted and requires attention.')}
      ${ticketTable(ticket)}
      ${ticket.description ? `
        <p style="margin:16px 0 6px;font-size:12px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:0.6px">Description</p>
        <div style="background:${C.bg};border:1px solid ${C.border};border-radius:6px;padding:14px 16px;font-size:13px;color:${C.text};line-height:1.7;white-space:pre-wrap">${ticket.description}</div>
      ` : ''}`;
    await sendToHeads(
      subject,
      wrapHtml('New Support Ticket Received', body),
      `New Ticket: ${ticket.id} — ${ticket.title}\nFrom: ${ticket.reporterEmail}\nPriority: ${ticket.priority}`,
    );
  },

  async sendStatusUpdateToHeads(ticket, oldStatus, changedByName) {
    const subject = `[Status Update] ${ticket.id} — ${oldStatus} → ${ticket.status}`;
    const body = `
      ${para(`Ticket status was updated by <strong>${changedByName || 'Support Staff'}</strong>.`)}
      <table style="border-collapse:collapse;margin:0 0 16px">
        <tr>
          <td style="padding:8px 20px 8px 0;font-size:13px;color:${C.muted};font-weight:600">Previous</td>
          <td style="padding:8px 0">${statusBadge(oldStatus)}</td>
        </tr>
        <tr>
          <td style="padding:8px 20px 8px 0;font-size:13px;color:${C.muted};font-weight:600">Now</td>
          <td style="padding:8px 0">${statusBadge(ticket.status)}</td>
        </tr>
      </table>
      ${ticketTable(ticket)}`;
    await sendToHeads(
      subject,
      wrapHtml('Ticket Status Updated', body),
      `Status Update: ${ticket.id}\n${oldStatus} → ${ticket.status}\nBy: ${changedByName}`,
    );
  },

  async sendAssignmentAlertToHeads(ticket, assigneeName) {
    const subject = `[Assigned] ${ticket.id} → ${assigneeName || 'Unassigned'}`;
    const body = `
      ${para(`Ticket has been assigned to <strong style="color:${C.secondary}">${assigneeName || 'Unassigned'}</strong>.`)}
      ${ticketTable(ticket)}`;
    await sendToHeads(
      subject,
      wrapHtml('Ticket Assignment Updated', body),
      `Assignment: ${ticket.id} → ${assigneeName}`,
    );
  },

  /**
   * Notify the staff member a ticket was forwarded to.
   * Only goes to the recipient — never to the client.
   */
  async sendForwardNotification(ticket, toUser, forwardedByName, forwardNote) {
    const to = toUser?.default_mail || toUser?.defaultMail || toUser?.email;
    if (!to) return;
    const subject = `[Forwarded to You] ${ticket.id} — ${ticket.title}`;
    const body = `
      ${para(`<strong>${forwardedByName || 'A colleague'}</strong> has forwarded a support ticket to you for action.`)}
      ${forwardNote ? infoBox(`<strong>Note from ${forwardedByName || 'sender'}:</strong> ${forwardNote}`, C.warning) : ''}
      ${ticketTable(ticket)}
      ${infoBox('This ticket is now assigned to you. Please review it and take appropriate action.', C.secondary)}`;
    await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html: wrapHtml('Ticket Forwarded to You', body),
    }).catch((err) => console.error(`[email] sendForwardNotification failed (${to}):`, err.message));
  },

  async sendClientConfirmation(ticket) {
    const to = await clientDeliveryAddress(ticket.reporterEmail);
    if (!to) return;
    const subject = `Ticket Received — ${ticket.id}`;
    const body = `
      ${para(`Dear <strong>${ticket.reporter}</strong>,`)}
      ${para('Thank you for contacting Inorins Technologies Support. Your request has been received and logged. Our team will review it and get back to you as soon as possible.')}
      ${ticketTable(ticket)}
      ${infoBox('You will receive an email notification whenever the status of your ticket changes.', C.secondary)}`;
    const recipients = [to];
    if (ticket.contactEmail && ticket.contactEmail !== to) recipients.push(ticket.contactEmail);
    await Promise.all(recipients.map((addr) =>
      transporter.sendMail({ from: FROM, to: addr, subject, html: wrapHtml('Your Request Has Been Received', body) })
        .catch((err) => console.error(`[email] Client confirmation failed (${addr}):`, err.message))
    ));
  },

  async sendClientStatusUpdate(ticket) {
    const statusConfig = {
      'Open':           { msg: `Your ticket has been received and is open for review.`,                   color: C.primary, icon: '📋' },
      'In Progress':    { msg: `Our team has started working on your ticket.`,                            color: C.info,    icon: '🔧' },
      'Resolved':       { msg: `Great news — your ticket has been resolved by our support team.`,         color: C.success, icon: '✅' },
      'Closed':         { msg: `Your ticket has been closed.`,                                            color: C.muted,   icon: '📁' },
      'Pending Client': { msg: `Our team needs more information from you to proceed with your ticket.`,   color: C.warning, icon: '⏳' },
    };
    const cfg = statusConfig[ticket.status];
    if (!cfg) return;
    // Email-sourced tickets: send directly to the reporter's email, skip user account lookup
    const to = ticket.source === 'email'
      ? (ticket.reporterEmail || null)
      : await clientDeliveryAddress(ticket.reporterEmail);
    if (!to) return;
    const subject = `Ticket Update — ${ticket.id} is now ${ticket.status}`;
    const body = `
      ${para(`Dear <strong>${ticket.reporter}</strong>,`)}
      ${infoBox(`<strong>${cfg.icon} ${ticket.status}:</strong> ${cfg.msg}`, cfg.color)}
      ${ticketTable(ticket)}
      ${ticket.resolutionNote ? `
        <p style="margin:16px 0 6px;font-size:12px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:0.6px">Resolution Summary</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:14px 16px;font-size:13px;color:${C.text};line-height:1.7">${ticket.resolutionNote.summary}</div>
      ` : ''}
      ${para('If you have any questions or need further assistance, please contact us through the support portal.')}`;
    const htmlContent = wrapHtml(`Ticket ${ticket.status}`, body);
    const recipients = [to];
    if (ticket.contactEmail && ticket.contactEmail !== to) recipients.push(ticket.contactEmail);
    await Promise.all(recipients.map((addr) =>
      transporter.sendMail({ from: FROM, to: addr, subject, html: htmlContent })
        .catch((err) => console.error(`[email] Client status update failed (${addr}):`, err.message))
    ));
  },
};
