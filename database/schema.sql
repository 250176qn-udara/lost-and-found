-- Lost & Found — Step 2 database
-- Import once: phpMyAdmin > Import, or:  mysql -u root < schema.sql

CREATE DATABASE IF NOT EXISTS lost_and_found CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lost_and_found;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,            -- bcrypt hash, never the plain password
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS organizations (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  type        VARCHAR(50)  NOT NULL DEFAULT 'School',   -- School / Store / Company
  description TEXT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- One row per membership request. A user may have several rows over time
-- (rejected, left, approved), but only one 'approved' row is the current community.
CREATE TABLE IF NOT EXISTS organization_members (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  organization_id INT UNSIGNED NOT NULL,
  status          ENUM('pending','approved','rejected','left') NOT NULL DEFAULT 'pending',
  role            ENUM('member','staff','admin') NOT NULL DEFAULT 'member',
  requested_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at     TIMESTAMP NULL DEFAULT NULL,
  approved_by     INT UNSIGNED NULL DEFAULT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_org_status  (organization_id, status),
  INDEX idx_user_status (user_id, status),
  CONSTRAINT fk_om_user FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE,
  CONSTRAINT fk_om_org  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_om_by   FOREIGN KEY (approved_by)     REFERENCES users(id)         ON DELETE SET NULL
) ENGINE=InnoDB;

-- Demo data (all demo passwords are: 123456)
INSERT IGNORE INTO organizations (id, name, type, description) VALUES
  (1, 'Yokohama Demo School', 'School',  'Demo school'),
  (2, 'Harbor Mart',          'Store',   'Demo store'),
  (3, 'Nexa Systems',         'Company', 'Demo company');

INSERT IGNORE INTO users (id, name, email, password_hash) VALUES
  (1, 'Aiko Tanaka',  'aiko@example.com',   '$2y$10$U8BOoJfma/aJ4Kx0QGpf.OHQByOo0.7w1P.Wrz6Q4rix3nUN6L6EG'),
  (2, 'Mr. Yamada',   'yamada@example.com', '$2y$10$U8BOoJfma/aJ4Kx0QGpf.OHQByOo0.7w1P.Wrz6Q4rix3nUN6L6EG'),
  (3, 'Harbor Admin', 'harbor@example.com', '$2y$10$U8BOoJfma/aJ4Kx0QGpf.OHQByOo0.7w1P.Wrz6Q4rix3nUN6L6EG'),
  (4, 'Nexa Admin',   'nexa@example.com',   '$2y$10$U8BOoJfma/aJ4Kx0QGpf.OHQByOo0.7w1P.Wrz6Q4rix3nUN6L6EG'),
  (5, 'Sara Ito',     'sara@example.com',   '$2y$10$U8BOoJfma/aJ4Kx0QGpf.OHQByOo0.7w1P.Wrz6Q4rix3nUN6L6EG');

INSERT IGNORE INTO organization_members (id, user_id, organization_id, status, role, approved_at) VALUES
  (1, 1, 1, 'approved', 'member', NOW()),
  (2, 2, 1, 'approved', 'admin',  NOW()),
  (3, 3, 2, 'approved', 'admin',  NOW()),
  (4, 4, 3, 'approved', 'admin',  NOW()),
  (5, 5, 1, 'approved', 'staff',  NOW());

-- Step 3A: lost & found items (reporting).
CREATE TABLE IF NOT EXISTS items (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  reporter_id     INT UNSIGNED NOT NULL,
  kind            ENUM('lost','found') NOT NULL,
  title           VARCHAR(150) NOT NULL,
  category        VARCHAR(50)  NOT NULL,
  place           VARCHAR(100) NOT NULL,
  item_date       DATE NULL,
  description     TEXT NULL,
  photo           LONGTEXT NULL,             -- optional image as a data: URL
  status          TINYINT UNSIGNED NOT NULL DEFAULT 1,  -- 1 Reported .. 5 Returned (see STEPS in app.js)
  item_code       VARCHAR(20)  NULL UNIQUE,   -- assigned once the item is received at the office, e.g. LF-2026-0148
  shelf           VARCHAR(10)  NULL,
  finder_name     VARCHAR(100) NULL,          -- optional, for found items a staff member logs on someone else's behalf
  received_by     INT UNSIGNED NULL,
  received_at     TIMESTAMP NULL DEFAULT NULL,
  matched_item_id INT UNSIGNED NULL,          -- Step 3C: the item the system suggested as a match
  matched_at      TIMESTAMP NULL DEFAULT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_org_kind_status (organization_id, kind, status),
  INDEX idx_reporter (reporter_id),
  CONSTRAINT fk_item_org      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_reporter FOREIGN KEY (reporter_id)     REFERENCES users(id)         ON DELETE CASCADE,
  CONSTRAINT fk_item_received FOREIGN KEY (received_by)     REFERENCES users(id)         ON DELETE SET NULL
) ENGINE=InnoDB;

-- A couple of demo items for Yokohama Demo School (org 1), reported by Aiko (user 1).
INSERT IGNORE INTO items (id, organization_id, reporter_id, kind, title, category, place, item_date, description, status) VALUES
  (1, 1, 1, 'lost',  'Black wallet',     'Wallet', 'Library', '2026-09-24', 'Black leather wallet, small scratch', 1),
  (2, 1, 1, 'found', 'Silver earphones', 'Electronics', 'Room 302', '2026-09-26', 'In a small case', 1);

-- Step 3C: basic (non-AI) matching + claim requests.
-- matched_item_id links a lost item to the found item the system suggested, or vice versa.

CREATE TABLE IF NOT EXISTS claims (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  found_item_id   INT UNSIGNED NOT NULL,             -- the found item being claimed
  lost_item_id    INT UNSIGNED NULL,                 -- the claimant's own lost report, if the system suggested this match
  claimant_id     INT UNSIGNED NOT NULL,
  answers         TEXT NOT NULL,                     -- claimant's answers to the verification questions, kept as one block
  status          ENUM('pending','approved','rejected','returned') NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at      TIMESTAMP NULL DEFAULT NULL,
  decided_by      INT UNSIGNED NULL,
  id_type         VARCHAR(50) NULL,                  -- ID shown at handover, e.g. Student ID
  returned_at     TIMESTAMP NULL DEFAULT NULL,
  returned_by     INT UNSIGNED NULL,
  INDEX idx_found (found_item_id, status),
  INDEX idx_claimant (claimant_id),
  CONSTRAINT fk_claim_found    FOREIGN KEY (found_item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT fk_claim_lost     FOREIGN KEY (lost_item_id)  REFERENCES items(id) ON DELETE SET NULL,
  CONSTRAINT fk_claim_claimant FOREIGN KEY (claimant_id)   REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_claim_decided  FOREIGN KEY (decided_by)    REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_claim_returned FOREIGN KEY (returned_by)   REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;