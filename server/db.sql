-- ═══════════════════════════════════════════════════════════════════════════════
-- Inorins Support System — MySQL Schema  (v4)
-- Run once on a fresh install: mysql -u root -p < db.sql
-- For existing databases run: node server/migrate.js
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS inorins_support
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inorins_support;

-- ── users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  INT           NOT NULL AUTO_INCREMENT,
  external_id         VARCHAR(50)   NULL UNIQUE COMMENT 'Original JSON ID, used for migration',
  name                VARCHAR(255)  NOT NULL,
  email               VARCHAR(255)  NOT NULL,
  password_hash       VARCHAR(500)  NOT NULL,
  role                ENUM('inorins','client') NOT NULL,
  title               VARCHAR(255)  NULL,
  department          VARCHAR(100)  NULL COMMENT 'Used for department-level permission rules',
  is_active           TINYINT(1)    NOT NULL DEFAULT 1,
  is_department_head  TINYINT(1)    NOT NULL DEFAULT 0 COMMENT 'Receives ticket alert emails',
  default_mail        VARCHAR(255)  NULL COMMENT 'Override address for all outgoing emails; falls back to email if NULL',
  bank_name           VARCHAR(255)  NULL,
  bank_domain         VARCHAR(255)  NULL,
  bank_short_code     VARCHAR(50)   NULL,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── tickets ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id                    VARCHAR(20)   NOT NULL,
  source                ENUM('portal','email') NOT NULL DEFAULT 'portal',
  title                 VARCHAR(200)  NOT NULL,
  bank_name             VARCHAR(255)  NULL,
  `system`              VARCHAR(50)   NOT NULL,
  module                VARCHAR(255)  NOT NULL,
  module_details        TEXT          NULL,
  form                  VARCHAR(255)  NOT NULL,
  request_type          ENUM('Issue','Add Form','Add Report','Update') NOT NULL DEFAULT 'Issue',
  requested_delivery    VARCHAR(50)   NULL,
  priority              ENUM('Critical','High','Medium','Low') NOT NULL DEFAULT 'Medium',
  status                ENUM('Open','In Progress','Pending Client','Resolved','Closed') NOT NULL DEFAULT 'Open',
  environment           ENUM('UAT','Production') NOT NULL DEFAULT 'UAT',
  reporter              VARCHAR(100)  NOT NULL,
  reporter_email        VARCHAR(200)  NOT NULL,
  contact_email         VARCHAR(255)  NULL COMMENT 'Additional notification recipient',
  contact_name          VARCHAR(100)  NULL,
  contact_designation   VARCHAR(100)  NULL,
  contact_phone         VARCHAR(30)   NULL,
  assignee_id           INT           NULL,
  description           TEXT          NOT NULL,
  attachments           JSON          NULL,
  sla_breach            TINYINT(1)    NOT NULL DEFAULT 0,
  sla_breach_notified_at DATETIME     NULL,
  reopen_count          INT           NOT NULL DEFAULT 0,
  resolution_summary    TEXT          NULL,
  resolution_cause      TEXT          NULL,
  resolution_prevention TEXT          NULL,
  resolution_attachments JSON         NULL,
  forwarded_to          INT           NULL,
  forwarded_by          INT           NULL,
  forward_note          TEXT          NULL,
  is_edited             TINYINT(1)    NOT NULL DEFAULT 0,
  created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  started_at            DATETIME      NULL,
  resolved_at           DATETIME      NULL,
  edited_at             DATETIME      NULL,
  PRIMARY KEY (id),
  INDEX idx_tickets_status         (status),
  INDEX idx_tickets_reporter_email (reporter_email),
  INDEX idx_tickets_assignee_id    (assignee_id),
  INDEX idx_tickets_bank_name      (bank_name),
  INDEX idx_tickets_created_at     (created_at),
  INDEX idx_tickets_priority       (priority),
  CONSTRAINT fk_tickets_assignee   FOREIGN KEY (assignee_id)  REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_tickets_fwd_to     FOREIGN KEY (forwarded_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_tickets_fwd_by     FOREIGN KEY (forwarded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── messages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          VARCHAR(100) NOT NULL,
  ticket_id   VARCHAR(20)  NOT NULL,
  author      VARCHAR(255) NOT NULL,
  author_id   INT          NULL,
  role        ENUM('client','employee') NOT NULL DEFAULT 'employee',
  content     TEXT         NOT NULL,
  is_internal TINYINT(1)   NOT NULL DEFAULT 0,
  attachments JSON         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_messages_ticket_id (ticket_id),
  CONSTRAINT fk_messages_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_author FOREIGN KEY (author_id) REFERENCES users(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           VARCHAR(100) NOT NULL,
  user_id      INT          NOT NULL,
  type         ENUM('ticket_assigned','status_changed','new_client_reply','new_staff_reply',
                    'sla_breach','ticket_edited','new_ticket') NOT NULL,
  ticket_id    VARCHAR(20)  NULL,
  ticket_title VARCHAR(200) NULL,
  message      TEXT         NOT NULL,
  is_read      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_notif_user_id  (user_id),
  INDEX idx_notif_is_read  (is_read),
  INDEX idx_notif_created  (created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── inbox_emails ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbox_emails (
  id            INT          NOT NULL AUTO_INCREMENT,
  account_email VARCHAR(255) NOT NULL COMMENT 'Which Gmail account fetched this',
  gmail_uid     VARCHAR(255) NOT NULL UNIQUE COMMENT 'accountEmail:imapUID — dedup key',
  sender_name   VARCHAR(255) NULL,
  sender_email  VARCHAR(255) NOT NULL,
  reply_to      VARCHAR(255) NULL,
  message_id    VARCHAR(500) NULL COMMENT 'RFC 2822 Message-ID header for deduplication',
  subject       VARCHAR(500) NULL,
  body_text     TEXT         NULL,
  body_html     LONGTEXT     NULL,
  received_at   DATETIME     NOT NULL,
  status        ENUM('pending','ticket_created','dismissed') NOT NULL DEFAULT 'pending',
  ticket_id     VARCHAR(20)  NULL,
  processed_by  INT          NULL,
  processed_at  DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_inbox_status      (status),
  INDEX idx_inbox_account     (account_email),
  INDEX idx_inbox_received_at (received_at),
  CONSTRAINT fk_inbox_ticket  FOREIGN KEY (ticket_id)    REFERENCES tickets(id) ON DELETE SET NULL,
  CONSTRAINT fk_inbox_proc_by FOREIGN KEY (processed_by) REFERENCES users(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── audit_logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  user_id     INT          NULL,
  user_email  VARCHAR(255) NULL,
  action      VARCHAR(100) NOT NULL COMMENT 'e.g. ticket.status_changed, user.created',
  entity_type VARCHAR(100) NULL,
  entity_id   VARCHAR(100) NULL,
  old_values  JSON         NULL,
  new_values  JSON         NULL,
  ip_address  VARCHAR(45)  NULL,
  user_agent  TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_audit_entity     (entity_type, entity_id),
  INDEX idx_audit_user_id    (user_id),
  INDEX idx_audit_created_at (created_at),
  INDEX idx_audit_action     (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── subscribers ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscribers (
  id         INT          NOT NULL AUTO_INCREMENT,
  email      VARCHAR(255) NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscribers_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ticket_links ──────────────────────────────────────────────────────────────
-- Links two tickets as related or duplicate issues
CREATE TABLE IF NOT EXISTS ticket_links (
  id                INT          NOT NULL AUTO_INCREMENT,
  primary_ticket_id VARCHAR(20)  NOT NULL,
  linked_ticket_id  VARCHAR(20)  NOT NULL,
  link_type         ENUM('duplicate','related') NOT NULL DEFAULT 'related',
  note              TEXT         NULL,
  linked_by         INT          NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ticket_links (primary_ticket_id, linked_ticket_id),
  INDEX idx_tl_primary (primary_ticket_id),
  INDEX idx_tl_linked  (linked_ticket_id),
  CONSTRAINT fk_tl_primary FOREIGN KEY (primary_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_tl_linked  FOREIGN KEY (linked_ticket_id)  REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_tl_by      FOREIGN KEY (linked_by)         REFERENCES users(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ticket_watchers ──────────────────────────────────────────────────────────
-- Staff who subscribe to a ticket for update notifications without being assigned
CREATE TABLE IF NOT EXISTS ticket_watchers (
  id          INT          NOT NULL AUTO_INCREMENT,
  ticket_id   VARCHAR(20)  NOT NULL,
  user_id     INT          NOT NULL,
  added_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tw (ticket_id, user_id),
  INDEX idx_tw_ticket (ticket_id),
  INDEX idx_tw_user   (user_id),
  CONSTRAINT fk_tw_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_tw_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── user_sessions ─────────────────────────────────────────────────────────────
-- Tracks active login sessions for revocation by admin
CREATE TABLE IF NOT EXISTS user_sessions (
  id           INT          NOT NULL AUTO_INCREMENT,
  user_id      INT          NOT NULL,
  token_hash   VARCHAR(64)  NOT NULL COMMENT 'SHA-256 of the full token',
  ip_address   VARCHAR(45)  NULL,
  user_agent   TEXT         NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token (token_hash),
  INDEX idx_sessions_user  (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── system_changes ────────────────────────────────────────────────────────────
-- Tracks system modification requests and their implementation status
CREATE TABLE IF NOT EXISTS system_changes (
  id           INT          NOT NULL AUTO_INCREMENT,
  title        VARCHAR(255) NOT NULL,
  description  TEXT         NULL,
  `system`     VARCHAR(50)  NULL,
  module       VARCHAR(255) NULL,
  bank_name    VARCHAR(255) NULL,
  status       ENUM('Not Started','In Progress','Completed') NOT NULL DEFAULT 'Not Started',
  created_by   INT          NULL,
  updated_by   INT          NULL,
  completed_at DATETIME     NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_sc_status  (status),
  INDEX idx_sc_system  (`system`),
  INDEX idx_sc_bank    (bank_name),
  CONSTRAINT fk_sc_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_sc_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── system_change_banks ───────────────────────────────────────────────────────
-- Per-bank rollout status for each system change
CREATE TABLE IF NOT EXISTS system_change_banks (
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
  CONSTRAINT fk_scb_updater  FOREIGN KEY (updated_by) REFERENCES users(id)           ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── system_change_items ───────────────────────────────────────────────────────
-- Individual change detail entries per system_change record
CREATE TABLE IF NOT EXISTS system_change_items (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── system_change_tickets ─────────────────────────────────────────────────────
-- Links system_changes ↔ tickets for impact traceability
CREATE TABLE IF NOT EXISTS system_change_tickets (
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
  CONSTRAINT fk_sct_change FOREIGN KEY (change_id)  REFERENCES system_changes(id) ON DELETE CASCADE,
  CONSTRAINT fk_sct_ticket FOREIGN KEY (ticket_id)  REFERENCES tickets(id)        ON DELETE CASCADE,
  CONSTRAINT fk_sct_by     FOREIGN KEY (linked_by)  REFERENCES users(id)          ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── role_permissions ──────────────────────────────────────────────────────────
-- Granular access control: per-user overrides or role/department defaults
-- Priority: user_id rule > department rule > role default > system defaults
CREATE TABLE IF NOT EXISTS role_permissions (
  id                          INT          NOT NULL AUTO_INCREMENT,
  user_id                     INT          NULL    COMMENT 'When set, applies to this specific user only',
  role                        VARCHAR(50)  NOT NULL,
  department                  VARCHAR(100) NULL,
  can_view_historical_tickets TINYINT(1)   NOT NULL DEFAULT 1,
  historical_ticket_days      INT          NOT NULL DEFAULT 365,
  allowed_banks               JSON         NULL    COMMENT 'NULL = all banks allowed',
  can_view_others_open        TINYINT(1)   NOT NULL DEFAULT 1,
  can_view_others_in_progress TINYINT(1)   NOT NULL DEFAULT 1,
  can_view_others_resolved    TINYINT(1)   NOT NULL DEFAULT 1,
  can_view_others_closed      TINYINT(1)   NOT NULL DEFAULT 1,
  can_create_tickets          TINYINT(1)   NOT NULL DEFAULT 1,
  can_assign_tickets          TINYINT(1)   NOT NULL DEFAULT 1,
  can_update_tickets          TINYINT(1)   NOT NULL DEFAULT 1,
  can_close_tickets           TINYINT(1)   NOT NULL DEFAULT 1,
  can_view_system_changes     TINYINT(1)   NOT NULL DEFAULT 1,
  can_manage_system_changes   TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rp_user_id   (user_id),
  UNIQUE KEY uq_rp_role_dept (role, department),
  CONSTRAINT fk_rp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

DELIMITER $$

-- Auto-set started_at and resolved_at when status changes
CREATE TRIGGER IF NOT EXISTS trg_before_ticket_update
BEFORE UPDATE ON tickets
FOR EACH ROW
BEGIN
  IF NEW.status = 'In Progress' AND OLD.status != 'In Progress' AND NEW.started_at IS NULL THEN
    SET NEW.started_at = NOW();
  END IF;
  IF (NEW.status = 'Resolved' OR NEW.status = 'Closed')
     AND (OLD.status != 'Resolved' AND OLD.status != 'Closed')
     AND NEW.resolved_at IS NULL THEN
    SET NEW.resolved_at = NOW();
  END IF;
END$$

-- Audit log on ticket INSERT
CREATE TRIGGER IF NOT EXISTS trg_after_ticket_insert
AFTER INSERT ON tickets
FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (action, entity_type, entity_id, new_values, created_at)
  VALUES (
    'ticket.created', 'ticket', NEW.id,
    JSON_OBJECT(
      'status',    NEW.status,
      'priority',  NEW.priority,
      'reporter',  NEW.reporter,
      'system',    NEW.`system`
    ),
    NOW()
  );
END$$

-- Audit log on ticket UPDATE (status, assignee, priority changes)
CREATE TRIGGER IF NOT EXISTS trg_after_ticket_update
AFTER UPDATE ON tickets
FOR EACH ROW
BEGIN
  IF NEW.status != OLD.status OR NEW.assignee_id != OLD.assignee_id OR NEW.priority != OLD.priority THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, old_values, new_values, created_at)
    VALUES (
      'ticket.updated', 'ticket', NEW.id,
      JSON_OBJECT(
        'status',      OLD.status,
        'assignee_id', OLD.assignee_id,
        'priority',    OLD.priority
      ),
      JSON_OBJECT(
        'status',      NEW.status,
        'assignee_id', NEW.assignee_id,
        'priority',    NEW.priority
      ),
      NOW()
    );
  END IF;
END$$

-- Audit log on user UPDATE
CREATE TRIGGER IF NOT EXISTS trg_after_user_update
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  IF NEW.is_active != OLD.is_active OR NEW.role != OLD.role OR NEW.email != OLD.email
     OR NEW.is_department_head != OLD.is_department_head THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, old_values, new_values, created_at)
    VALUES (
      'user.updated', 'user', NEW.id,
      JSON_OBJECT(
        'is_active',           OLD.is_active,
        'role',                OLD.role,
        'email',               OLD.email,
        'is_department_head',  OLD.is_department_head
      ),
      JSON_OBJECT(
        'is_active',           NEW.is_active,
        'role',                NEW.role,
        'email',               NEW.email,
        'is_department_head',  NEW.is_department_head
      ),
      NOW()
    );
  END IF;
END$$

-- Audit log on message INSERT
CREATE TRIGGER IF NOT EXISTS trg_after_message_insert
AFTER INSERT ON messages
FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (action, entity_type, entity_id, new_values, created_at)
  VALUES (
    'message.created', 'message', NEW.id,
    JSON_OBJECT(
      'ticket_id',   NEW.ticket_id,
      'author',      NEW.author,
      'role',        NEW.role,
      'is_internal', NEW.is_internal
    ),
    NOW()
  );
END$$

-- Audit log on system_change INSERT
CREATE TRIGGER IF NOT EXISTS trg_after_system_change_insert
AFTER INSERT ON system_changes
FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (action, entity_type, entity_id, new_values, created_at)
  VALUES (
    'system_change.created', 'system_change', NEW.id,
    JSON_OBJECT(
      'title',      NEW.title,
      'status',     NEW.status,
      'system',     NEW.`system`,
      'created_by', NEW.created_by
    ),
    NOW()
  );
END$$

-- Audit log on system_change UPDATE (status changes)
CREATE TRIGGER IF NOT EXISTS trg_after_system_change_update
AFTER UPDATE ON system_changes
FOR EACH ROW
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, old_values, new_values, created_at)
    VALUES (
      'system_change.updated', 'system_change', NEW.id,
      JSON_OBJECT('status', OLD.status, 'updated_by', OLD.updated_by),
      JSON_OBJECT('status', NEW.status, 'updated_by', NEW.updated_by),
      NOW()
    );
  END IF;
END$$

DELIMITER ;


-- ═══════════════════════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_open_tickets AS
SELECT t.id, t.title, t.priority, t.status, t.bank_name, t.created_at,
       u.name AS assignee_name,
       TIMESTAMPDIFF(HOUR, t.created_at, NOW()) AS age_hours
FROM tickets t
LEFT JOIN users u ON t.assignee_id = u.id
WHERE t.status IN ('Open', 'In Progress')
ORDER BY FIELD(t.priority, 'Critical', 'High', 'Medium', 'Low'), t.created_at ASC;

CREATE OR REPLACE VIEW v_audit_summary AS
SELECT DATE(created_at) AS log_date, action, entity_type, COUNT(*) AS count
FROM audit_logs
GROUP BY DATE(created_at), action, entity_type
ORDER BY log_date DESC, count DESC;

CREATE OR REPLACE VIEW v_system_change_progress AS
SELECT
  sc.id,
  sc.title,
  sc.`system`,
  sc.module,
  sc.status,
  COUNT(scb.id)                               AS total_banks,
  SUM(scb.status = 'Done')                    AS done_banks,
  SUM(scb.status = 'Pending')                 AS pending_banks,
  ROUND(SUM(scb.status = 'Done') / NULLIF(COUNT(scb.id), 0) * 100, 0) AS pct_done
FROM system_changes sc
LEFT JOIN system_change_banks scb ON scb.change_id = sc.id
GROUP BY sc.id, sc.title, sc.`system`, sc.module, sc.status;
