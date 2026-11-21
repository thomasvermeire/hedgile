-- Foundations: organisations (tenants), users signed in through LaimonID,
-- memberships with a role, master data, attachments, Laimon drafts and the audit trail.
-- Every tenant-owned table carries organisation_id; src/db/tenant.ts always filters on it.

CREATE TABLE organisations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_sign_in_at TEXT,
  UNIQUE (issuer, subject)
);
CREATE INDEX users_email ON users (email);

-- A membership with user_id NULL is an invitation, claimed on first sign-in by email.
CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organisation_id, email)
);
CREATE INDEX memberships_user ON memberships (user_id);

CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country TEXT,
  vat_number TEXT,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX companies_org ON companies (organisation_id, name);

CREATE TABLE materials (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  metal TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organisation_id, code)
);

-- Market Data > Metals shows one menu entry per active reference.
CREATE TABLE metal_references (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  metal TEXT NOT NULL,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organisation_id, name)
);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_by TEXT REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX attachments_object ON attachments (organisation_id, object_type, object_id);

-- What Laimon read from a document, waiting for the user to check and confirm.
CREATE TABLE extraction_drafts (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id),
  kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed', 'discarded')),
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  fields TEXT NOT NULL,
  object_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  confirmed_at TEXT
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users (id),
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX audit_log_org ON audit_log (organisation_id, created_at);

INSERT INTO organisations (id, slug, name, base_currency) VALUES ('org_hedgile', 'hedgile', 'Hedgile', 'USD');
