import mysql from 'mysql2/promise';
import { env } from './env.js';

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+05:45',
  charset: 'utf8mb4',
});

export async function testConnection() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
}

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [env.DB_NAME, table, column]
  );
  return rows[0].cnt > 0;
}

async function tableExists(table) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [env.DB_NAME, table]
  );
  return rows[0].cnt > 0;
}

export async function runMigrations() {
  if (!await columnExists('tickets', 'source')) {
    await pool.query(
      `ALTER TABLE tickets ADD COLUMN source ENUM('portal','email') NOT NULL DEFAULT 'portal' AFTER id`
    );
    console.log('[db] Migration: added tickets.source');
  }
  if (!await columnExists('inbox_emails', 'message_id')) {
    await pool.query(
      `ALTER TABLE inbox_emails ADD COLUMN message_id VARCHAR(500) NULL AFTER reply_to`
    );
    console.log('[db] Migration: added inbox_emails.message_id');
  }

  // Feature 5: contact person fields for tickets
  if (!await columnExists('tickets', 'contact_name')) {
    await pool.query(
      `ALTER TABLE tickets ADD COLUMN contact_name VARCHAR(100) NULL AFTER reporter_email`
    );
    console.log('[db] Migration: added tickets.contact_name');
  }
  if (!await columnExists('tickets', 'contact_designation')) {
    await pool.query(
      `ALTER TABLE tickets ADD COLUMN contact_designation VARCHAR(100) NULL AFTER contact_name`
    );
    console.log('[db] Migration: added tickets.contact_designation');
  }
  if (!await columnExists('tickets', 'contact_phone')) {
    await pool.query(
      `ALTER TABLE tickets ADD COLUMN contact_phone VARCHAR(30) NULL AFTER contact_designation`
    );
    console.log('[db] Migration: added tickets.contact_phone');
  }
  if (!await columnExists('tickets', 'contact_email')) {
    await pool.query(
      `ALTER TABLE tickets ADD COLUMN contact_email VARCHAR(255) NULL AFTER contact_phone`
    );
    console.log('[db] Migration: added tickets.contact_email');
  }

  // Feature 1 & 4: department on users
  if (!await columnExists('users', 'department')) {
    await pool.query(
      `ALTER TABLE users ADD COLUMN department VARCHAR(100) NULL AFTER title`
    );
    console.log('[db] Migration: added users.department');
  }

  // Feature 3: ticket_links table
  if (!await tableExists('ticket_links')) {
    await pool.query(`
      CREATE TABLE ticket_links (
        id           INT          NOT NULL AUTO_INCREMENT,
        primary_ticket_id VARCHAR(20) NOT NULL,
        linked_ticket_id  VARCHAR(20) NOT NULL,
        link_type    ENUM('duplicate','related') NOT NULL DEFAULT 'related',
        note         TEXT         NULL,
        linked_by    INT          NULL,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_ticket_links (primary_ticket_id, linked_ticket_id),
        INDEX idx_tl_primary (primary_ticket_id),
        INDEX idx_tl_linked  (linked_ticket_id),
        CONSTRAINT fk_tl_primary FOREIGN KEY (primary_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        CONSTRAINT fk_tl_linked  FOREIGN KEY (linked_ticket_id)  REFERENCES tickets(id) ON DELETE CASCADE,
        CONSTRAINT fk_tl_by     FOREIGN KEY (linked_by)          REFERENCES users(id)   ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[db] Migration: created ticket_links table');
  }

  // Feature 2: system_changes table
  if (!await tableExists('system_changes')) {
    await pool.query(`
      CREATE TABLE system_changes (
        id           INT          NOT NULL AUTO_INCREMENT,
        title        VARCHAR(255) NOT NULL,
        description  TEXT         NULL,
        \`system\`   VARCHAR(50)  NULL,
        module       VARCHAR(255) NULL,
        bank_name    VARCHAR(255) NULL,
        status       ENUM('Not Started','In Progress','Completed') NOT NULL DEFAULT 'Not Started',
        created_by   INT          NULL,
        updated_by   INT          NULL,
        completed_at DATETIME     NULL,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_sc_status    (status),
        INDEX idx_sc_system    (\`system\`),
        INDEX idx_sc_bank      (bank_name),
        CONSTRAINT fk_sc_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_sc_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[db] Migration: created system_changes table');
  }

  // System change detail columns
  if (!await columnExists('system_changes', 'change_type')) {
    await pool.query(`ALTER TABLE system_changes ADD COLUMN change_type VARCHAR(50) NULL AFTER bank_name`);
    console.log('[db] Migration: added system_changes.change_type');
  }
  if (!await columnExists('system_changes', 'object_name')) {
    await pool.query(`ALTER TABLE system_changes ADD COLUMN object_name VARCHAR(255) NULL AFTER change_type`);
    console.log('[db] Migration: added system_changes.object_name');
  }
  if (!await columnExists('system_changes', 'before_state')) {
    await pool.query(`ALTER TABLE system_changes ADD COLUMN before_state TEXT NULL AFTER object_name`);
    console.log('[db] Migration: added system_changes.before_state');
  }
  if (!await columnExists('system_changes', 'after_state')) {
    await pool.query(`ALTER TABLE system_changes ADD COLUMN after_state TEXT NULL AFTER before_state`);
    console.log('[db] Migration: added system_changes.after_state');
  }

  // System change bank tracking (depends on system_changes)
  if (!await tableExists('system_change_banks')) {
    await pool.query(`
      CREATE TABLE system_change_banks (
        id          INT          NOT NULL AUTO_INCREMENT,
        change_id   INT          NOT NULL,
        bank_name   VARCHAR(255) NOT NULL,
        status      ENUM('Pending','Done') NOT NULL DEFAULT 'Pending',
        note        TEXT         NULL,
        updated_by  INT          NULL,
        updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_scb (change_id, bank_name),
        INDEX idx_scb_change (change_id),
        CONSTRAINT fk_scb_change   FOREIGN KEY (change_id)  REFERENCES system_changes(id) ON DELETE CASCADE,
        CONSTRAINT fk_scb_updater  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[db] Migration: created system_change_banks table');
  }

  // Feature 1: role_permissions table
  if (!await tableExists('role_permissions')) {
    await pool.query(`
      CREATE TABLE role_permissions (
        id                          INT          NOT NULL AUTO_INCREMENT,
        user_id                     INT          NULL COMMENT 'When set, this rule applies to a specific user only',
        role                        VARCHAR(50)  NOT NULL,
        department                  VARCHAR(100) NULL,
        can_view_historical_tickets TINYINT(1)   NOT NULL DEFAULT 1,
        historical_ticket_days      INT          NOT NULL DEFAULT 365,
        allowed_banks               JSON         NULL COMMENT 'NULL = all banks allowed',
        can_view_others_open        TINYINT(1)   NOT NULL DEFAULT 1,
        can_view_others_resolved    TINYINT(1)   NOT NULL DEFAULT 1,
        can_view_others_closed      TINYINT(1)   NOT NULL DEFAULT 1,
        can_create_tickets          TINYINT(1)   NOT NULL DEFAULT 1,
        can_assign_tickets          TINYINT(1)   NOT NULL DEFAULT 1,
        can_update_tickets          TINYINT(1)   NOT NULL DEFAULT 1,
        can_close_tickets           TINYINT(1)   NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        UNIQUE KEY uq_rp_user_id   (user_id),
        UNIQUE KEY uq_rp_role_dept (role, department),
        CONSTRAINT fk_rp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[db] Migration: created role_permissions table');
  }

  // Add user_id column if it was created without it (upgrade path)
  if (!await columnExists('role_permissions', 'user_id')) {
    await pool.query(`ALTER TABLE role_permissions ADD COLUMN user_id INT NULL AFTER id`);
    await pool.query(`ALTER TABLE role_permissions ADD UNIQUE KEY uq_rp_user_id (user_id)`);
    await pool.query(`ALTER TABLE role_permissions ADD CONSTRAINT fk_rp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`);
    console.log('[db] Migration: added role_permissions.user_id');
  }

  // New permission: view others in-progress tickets separately from open
  if (!await columnExists('role_permissions', 'can_view_others_in_progress')) {
    await pool.query(`ALTER TABLE role_permissions ADD COLUMN can_view_others_in_progress TINYINT(1) NOT NULL DEFAULT 1 AFTER can_view_others_open`);
    console.log('[db] Migration: added role_permissions.can_view_others_in_progress');
  }

  // New permissions: system changes access control
  if (!await columnExists('role_permissions', 'can_view_system_changes')) {
    await pool.query(`ALTER TABLE role_permissions ADD COLUMN can_view_system_changes TINYINT(1) NOT NULL DEFAULT 1 AFTER can_close_tickets`);
    console.log('[db] Migration: added role_permissions.can_view_system_changes');
  }
  if (!await columnExists('role_permissions', 'can_manage_system_changes')) {
    await pool.query(`ALTER TABLE role_permissions ADD COLUMN can_manage_system_changes TINYINT(1) NOT NULL DEFAULT 1 AFTER can_view_system_changes`);
    console.log('[db] Migration: added role_permissions.can_manage_system_changes');
  }

  // Ticket ↔ System change links
  if (!await tableExists('system_change_tickets')) {
    await pool.query(`
      CREATE TABLE system_change_tickets (
        id         INT          NOT NULL AUTO_INCREMENT,
        change_id  INT          NOT NULL,
        ticket_id  VARCHAR(20)  NOT NULL,
        note       TEXT         NULL,
        linked_by  INT          NULL,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_sct (change_id, ticket_id),
        INDEX idx_sct_change (change_id),
        INDEX idx_sct_ticket (ticket_id),
        CONSTRAINT fk_sct_change FOREIGN KEY (change_id) REFERENCES system_changes(id) ON DELETE CASCADE,
        CONSTRAINT fk_sct_ticket FOREIGN KEY (ticket_id)  REFERENCES tickets(id)        ON DELETE CASCADE,
        CONSTRAINT fk_sct_by    FOREIGN KEY (linked_by)   REFERENCES users(id)          ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[db] Migration: created system_change_tickets table');
  }

  // System change sub-items table
  if (!await tableExists('system_change_items')) {
    await pool.query(`
      CREATE TABLE system_change_items (
        id           INT          NOT NULL AUTO_INCREMENT,
        change_id    INT          NOT NULL,
        sort_order   INT          NOT NULL DEFAULT 0,
        change_type  VARCHAR(50)  NULL,
        object_name  VARCHAR(255) NULL,
        before_state TEXT         NULL,
        after_state  TEXT         NULL,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_sci_change (change_id),
        CONSTRAINT fk_sci_change FOREIGN KEY (change_id) REFERENCES system_changes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[db] Migration: created system_change_items table');
  }

  if (!await columnExists('system_change_items', 'attachment_name')) {
    await pool.query(`ALTER TABLE system_change_items ADD COLUMN attachment_name VARCHAR(255) NULL`);
    console.log('[db] Migration: added system_change_items.attachment_name');
  }
  if (!await columnExists('system_change_items', 'attachment_url')) {
    await pool.query(`ALTER TABLE system_change_items ADD COLUMN attachment_url VARCHAR(500) NULL`);
    console.log('[db] Migration: added system_change_items.attachment_url');
  }
}

export { pool };
