import { pool } from '../config/database.js';
import { NotificationModel } from '../models/Notification.model.js';

const SLA_HOURS = { Critical: 4, High: 8, Medium: 24, Low: 72 };

export async function runSlaCheck() {
  const [tickets] = await pool.query(
    "SELECT * FROM tickets WHERE status IN ('Open', 'In Progress') AND sla_breach_notified_at IS NULL"
  );
  const now = Date.now();

  for (const ticket of tickets) {
    const slaHours = SLA_HOURS[ticket.priority];
    if (!slaHours) continue;
    const ageHours = (now - new Date(ticket.created_at).getTime()) / 3_600_000;
    if (ageHours < slaHours) continue;

    await pool.query(
      'UPDATE tickets SET sla_breach = TRUE, sla_breach_notified_at = NOW() WHERE id = ?',
      [ticket.id] 
    );

    const msg = `: ${ticket.title} (${ticket.priority}, ${Math.floor(ageHours)}h old)`;

    if (ticket.assignee_id) {
      await NotificationModel.create(ticket.assignee_id, 'sla_breach', ticket.id, ticket.title, msg);
    } else {
      // Notify admin
      const [[admin]] = await pool.query(
        "SELECT id FROM users WHERE LOWER(email) = 'inorins@inorins.com' LIMIT 1"
      );
      if (admin) await NotificationModel.create(admin.id, 'sla_breach', ticket.id, ticket.title, msg);
    }
  }
}
