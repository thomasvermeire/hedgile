-- Reset the demo tenant (organisation Hedgile) to the hackathon start state:
-- master data and settings re-seeded, no transactions, no drafts.
-- Users, memberships and the audit trail are kept, so nobody loses access.
--   pnpm db:reset:local    (your machine)
--   pnpm db:reset:remote   (the deployed database)
-- Each module adds its start data here (prices up to 31/12/2018 come with Market Data).

DELETE FROM extraction_drafts WHERE organisation_id = 'org_hedgile';
DELETE FROM value_provenance WHERE organisation_id = 'org_hedgile';
DELETE FROM attachments WHERE organisation_id = 'org_hedgile';
DELETE FROM companies WHERE organisation_id = 'org_hedgile';
DELETE FROM materials WHERE organisation_id = 'org_hedgile';
DELETE FROM publication_holidays WHERE organisation_id = 'org_hedgile';
DELETE FROM publication_calendars WHERE organisation_id = 'org_hedgile';
DELETE FROM metal_references WHERE organisation_id = 'org_hedgile';
DELETE FROM book_metal_periods WHERE organisation_id = 'org_hedgile';
DELETE FROM book_metals WHERE organisation_id = 'org_hedgile';
DELETE FROM metals WHERE organisation_id = 'org_hedgile';
DELETE FROM quality_stages WHERE organisation_id = 'org_hedgile';
DELETE FROM organisation_parameters WHERE organisation_id = 'org_hedgile';

UPDATE organisations SET name = 'Hedgile', base_currency = 'USD', test_mode = 0 WHERE id = 'org_hedgile';

-- Master data
INSERT INTO companies (id, organisation_id, name, legal_name, commercial_name, country,
  address_line_1, address_line_2, city, state_province, contact_person, stock_valuation_method,
  base_currency, reporting_currency, address) VALUES
  ('co_hedgile_limited', 'org_hedgile', 'Hedgile Limited', 'Hedgile Limited', 'Hedgile Limited', 'HK',
   'Suite 2108, 21/F', 'Two Exchange Square, 8 Connaught Place', 'Central', 'Hong Kong', 'Ingrid Ingot',
   'WAVG', 'USD', NULL, 'Suite 2108, 21/F, Two Exchange Square, 8 Connaught Place, Central, Hong Kong');

INSERT INTO materials (id, organisation_id, code, name, metal) VALUES
  ('mat_ni_cathode', 'org_hedgile', 'NI-CATH', 'Nickel cathodes', 'Nickel'),
  ('mat_ni_briquette', 'org_hedgile', 'NI-BRIQ', 'Nickel briquettes', 'Nickel');

-- Settings > Books and Markets: Ni and Co, kg, USD, active from 01/12/2018, open-ended
INSERT INTO metals (id, organisation_id, symbol, name) VALUES
  ('mtl_ni', 'org_hedgile', 'Ni', 'Nickel'),
  ('mtl_co', 'org_hedgile', 'Co', 'Cobalt');
INSERT INTO book_metals (id, organisation_id, metal_id, base_uom, base_currency) VALUES
  ('bkm_ni', 'org_hedgile', 'mtl_ni', 'kg', 'USD'),
  ('bkm_co', 'org_hedgile', 'mtl_co', 'kg', 'USD');
INSERT INTO book_metal_periods (id, organisation_id, book_metal_id, status, valid_from, valid_to) VALUES
  ('bkp_ni_1', 'org_hedgile', 'bkm_ni', 'active', '2018-12-01', NULL),
  ('bkp_co_1', 'org_hedgile', 'bkm_co', 'active', '2018-12-01', NULL);

INSERT INTO metal_references (id, organisation_id, metal, metal_id, name, source, source_type, active) VALUES
  ('ref_lme_ni_cash', 'org_hedgile', 'Nickel', 'mtl_ni', 'LME Nickel Cash Settlement', 'LME', 'upload', 1),
  ('ref_mb_co_mbll', 'org_hedgile', 'Cobalt', 'mtl_co', 'Metal Bulletin Low Grade Low (MBLL)', 'MB', 'upload', 1);

-- Settings > Calendars: LME Ni Monday-Friday with holidays; MB Co Wednesday and Friday
INSERT INTO publication_calendars (id, organisation_id, metal_reference_id, weekdays) VALUES
  ('cal_lme_ni', 'org_hedgile', 'ref_lme_ni_cash', '1,2,3,4,5'),
  ('cal_mb_co', 'org_hedgile', 'ref_mb_co_mbll', '3,5');
INSERT INTO publication_holidays (id, organisation_id, calendar_id, date, name) VALUES
  ('hol_lme_20181225', 'org_hedgile', 'cal_lme_ni', '2018-12-25', 'Christmas Day'),
  ('hol_lme_20181226', 'org_hedgile', 'cal_lme_ni', '2018-12-26', 'Boxing Day'),
  ('hol_lme_20190101', 'org_hedgile', 'cal_lme_ni', '2019-01-01', 'New Year''s Day'),
  ('hol_lme_20190419', 'org_hedgile', 'cal_lme_ni', '2019-04-19', 'Good Friday'),
  ('hol_lme_20190422', 'org_hedgile', 'cal_lme_ni', '2019-04-22', 'Easter Monday'),
  ('hol_lme_20190506', 'org_hedgile', 'cal_lme_ni', '2019-05-06', 'Early May bank holiday'),
  ('hol_lme_20190527', 'org_hedgile', 'cal_lme_ni', '2019-05-27', 'Spring bank holiday'),
  ('hol_lme_20190826', 'org_hedgile', 'cal_lme_ni', '2019-08-26', 'Summer bank holiday');

-- Settings > Quality stages: TA, PA, FA active; the others locked
INSERT INTO quality_stages (id, organisation_id, code, name, description, status, sort_order) VALUES
  ('qs_ta', 'org_hedgile', 'TA', 'Typical', 'Typical analysis, material-based', 'active', 1),
  ('qs_pa', 'org_hedgile', 'PA', 'Provisional', 'Provisional analysis', 'active', 2),
  ('qs_la', 'org_hedgile', 'LA', 'Lab', 'Own laboratory analysis', 'locked', 3),
  ('qs_ex', 'org_hedgile', 'EX', 'Exchange', 'Exchange of results between buyer and seller', 'locked', 4),
  ('qs_va', 'org_hedgile', 'VA', 'Vendor', 'Vendor analysis', 'locked', 5),
  ('qs_ua', 'org_hedgile', 'UA', 'Umpire', 'Umpire analysis', 'locked', 6),
  ('qs_fa', 'org_hedgile', 'FA', 'Final', 'Final analysis', 'active', 7),
  ('qs_is', 'org_hedgile', 'IS', 'ISO', 'ISO standard analysis', 'locked', 8);

-- Settings > Parameters
INSERT INTO organisation_parameters (organisation_id, key, value) VALUES
  ('org_hedgile', 'three_way_match_tolerance_pct', '5');

INSERT INTO audit_log (id, organisation_id, user_id, action, object_type, object_id, details)
VALUES (lower(hex(randomblob(16))), 'org_hedgile', NULL, 'demo.reset', 'organisation', 'org_hedgile', NULL);
