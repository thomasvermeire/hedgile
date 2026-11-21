-- F3 Settings foundations: one shared schema for the Settings pages, so each page's
-- code can be built separately. Every table is organisation-owned.

-- The metal catalogue of an organisation (Settings > Markets > Metals).
-- A metal is a "book metal" when it has a row in book_metals; otherwise it is market-only.
CREATE TABLE metals (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  symbol TEXT NOT NULL, -- periodic-table symbol, e.g. 'Ni'
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organisation_id, symbol)
);

-- Settings > Books: metals the organisation keeps books for, with base UoM and currency.
CREATE TABLE book_metals (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  metal_id TEXT NOT NULL REFERENCES metals (id) ON DELETE CASCADE,
  base_uom TEXT NOT NULL, -- e.g. 'kg', 'lb', 'mt'
  base_currency TEXT NOT NULL, -- ISO 4217, e.g. 'USD'
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organisation_id, metal_id)
);

-- Active/inactive periods of a book metal. valid_to NULL = open-ended.
CREATE TABLE book_metal_periods (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  book_metal_id TEXT NOT NULL REFERENCES book_metals (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  valid_from TEXT NOT NULL, -- YYYY-MM-DD
  valid_to TEXT, -- YYYY-MM-DD, inclusive; NULL = indefinitely
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX book_metal_periods_metal ON book_metal_periods (organisation_id, book_metal_id, valid_from);

-- Metal references (price series) get a link to the metal and how prices arrive.
-- `source` stays the publisher (e.g. 'LME', 'MB'); `source_type` is Manual, Upload or Connection.
ALTER TABLE metal_references ADD COLUMN metal_id TEXT REFERENCES metals (id);
ALTER TABLE metal_references ADD COLUMN source_type TEXT NOT NULL DEFAULT 'manual'
  CHECK (source_type IN ('manual', 'upload', 'connection'));

-- Settings > Calendars: on which weekdays a reference publishes prices, and its holidays.
CREATE TABLE publication_calendars (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  metal_reference_id TEXT NOT NULL REFERENCES metal_references (id) ON DELETE CASCADE,
  weekdays TEXT NOT NULL, -- ISO weekday numbers, comma-separated: '1,2,3,4,5' = Monday-Friday
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organisation_id, metal_reference_id)
);
CREATE TABLE publication_holidays (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL REFERENCES publication_calendars (id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- YYYY-MM-DD
  name TEXT,
  UNIQUE (calendar_id, date)
);

-- Settings > Quality stages.
CREATE TABLE quality_stages (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  code TEXT NOT NULL, -- two letters, e.g. 'TA'
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'locked')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organisation_id, code)
);

-- Settings > Parameters: named organisation settings (e.g. the three-way-match tolerance).
-- Changes are logged in audit_log with the old and new value.
CREATE TABLE organisation_parameters (
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT REFERENCES users (id),
  PRIMARY KEY (organisation_id, key)
);

-- Start data for organisation Hedgile, so production has it after this migration.
-- db/reset-demo.sql restores the same data in the demo.
INSERT OR IGNORE INTO companies (id, organisation_id, name, legal_name, commercial_name, country,
  address_line_1, address_line_2, city, state_province, contact_person, stock_valuation_method,
  base_currency, address) VALUES
  ('co_hedgile_limited', 'org_hedgile', 'Hedgile Limited', 'Hedgile Limited', 'Hedgile Limited', 'HK',
   'Suite 2108, 21/F', 'Two Exchange Square, 8 Connaught Place', 'Central', 'Hong Kong', 'Ingrid Ingot',
   'WAVG', 'USD', 'Suite 2108, 21/F, Two Exchange Square, 8 Connaught Place, Central, Hong Kong');

INSERT OR IGNORE INTO metals (id, organisation_id, symbol, name) VALUES
  ('mtl_ni', 'org_hedgile', 'Ni', 'Nickel'),
  ('mtl_co', 'org_hedgile', 'Co', 'Cobalt');
INSERT OR IGNORE INTO book_metals (id, organisation_id, metal_id, base_uom, base_currency) VALUES
  ('bkm_ni', 'org_hedgile', 'mtl_ni', 'kg', 'USD'),
  ('bkm_co', 'org_hedgile', 'mtl_co', 'kg', 'USD');
INSERT OR IGNORE INTO book_metal_periods (id, organisation_id, book_metal_id, status, valid_from, valid_to) VALUES
  ('bkp_ni_1', 'org_hedgile', 'bkm_ni', 'active', '2018-12-01', NULL),
  ('bkp_co_1', 'org_hedgile', 'bkm_co', 'active', '2018-12-01', NULL);

INSERT OR IGNORE INTO metal_references (id, organisation_id, metal, name, source, active) VALUES
  ('ref_lme_ni_cash', 'org_hedgile', 'Nickel', 'LME Nickel Cash Settlement', 'LME', 1),
  ('ref_mb_co_mbll', 'org_hedgile', 'Cobalt', 'Metal Bulletin Low Grade Low (MBLL)', 'MB', 1);
UPDATE metal_references SET name = 'LME Nickel Cash Settlement', metal_id = 'mtl_ni', source_type = 'upload'
  WHERE id = 'ref_lme_ni_cash';
UPDATE metal_references SET metal_id = 'mtl_co', source_type = 'upload' WHERE id = 'ref_mb_co_mbll';

INSERT OR IGNORE INTO publication_calendars (id, organisation_id, metal_reference_id, weekdays) VALUES
  ('cal_lme_ni', 'org_hedgile', 'ref_lme_ni_cash', '1,2,3,4,5'),
  ('cal_mb_co', 'org_hedgile', 'ref_mb_co_mbll', '3,5');
INSERT OR IGNORE INTO publication_holidays (id, organisation_id, calendar_id, date, name) VALUES
  ('hol_lme_20181225', 'org_hedgile', 'cal_lme_ni', '2018-12-25', 'Christmas Day'),
  ('hol_lme_20181226', 'org_hedgile', 'cal_lme_ni', '2018-12-26', 'Boxing Day'),
  ('hol_lme_20190101', 'org_hedgile', 'cal_lme_ni', '2019-01-01', 'New Year''s Day'),
  ('hol_lme_20190419', 'org_hedgile', 'cal_lme_ni', '2019-04-19', 'Good Friday'),
  ('hol_lme_20190422', 'org_hedgile', 'cal_lme_ni', '2019-04-22', 'Easter Monday'),
  ('hol_lme_20190506', 'org_hedgile', 'cal_lme_ni', '2019-05-06', 'Early May bank holiday'),
  ('hol_lme_20190527', 'org_hedgile', 'cal_lme_ni', '2019-05-27', 'Spring bank holiday'),
  ('hol_lme_20190826', 'org_hedgile', 'cal_lme_ni', '2019-08-26', 'Summer bank holiday'),
  -- MB does not publish on Good Friday (April 2019 then has 7 MB days, as in the Excel model)
  ('hol_mb_20190419', 'org_hedgile', 'cal_mb_co', '2019-04-19', 'Good Friday');

INSERT OR IGNORE INTO quality_stages (id, organisation_id, code, name, description, status, sort_order) VALUES
  ('qs_ta', 'org_hedgile', 'TA', 'Typical', 'Typical analysis, material-based', 'active', 1),
  ('qs_pa', 'org_hedgile', 'PA', 'Provisional', 'Provisional analysis', 'active', 2),
  ('qs_la', 'org_hedgile', 'LA', 'Lab', 'Own laboratory analysis', 'locked', 3),
  ('qs_ex', 'org_hedgile', 'EX', 'Exchange', 'Exchange of results between buyer and seller', 'locked', 4),
  ('qs_va', 'org_hedgile', 'VA', 'Vendor', 'Vendor analysis', 'locked', 5),
  ('qs_ua', 'org_hedgile', 'UA', 'Umpire', 'Umpire analysis', 'locked', 6),
  ('qs_fa', 'org_hedgile', 'FA', 'Final', 'Final analysis', 'active', 7),
  ('qs_is', 'org_hedgile', 'IS', 'ISO', 'ISO standard analysis', 'locked', 8);

INSERT OR IGNORE INTO organisation_parameters (organisation_id, key, value) VALUES
  ('org_hedgile', 'three_way_match_tolerance_pct', '5');
