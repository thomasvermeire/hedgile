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
DELETE FROM metal_references WHERE organisation_id = 'org_hedgile';

UPDATE organisations SET name = 'Hedgile', base_currency = 'USD', test_mode = 0 WHERE id = 'org_hedgile';

INSERT INTO companies (id, organisation_id, name, legal_name, commercial_name, country, 
  vat_number, registration_number, address_line_1, address_line_2, city, postal_code, 
  state_province, website, contact_person, contact_email, contact_phone, 
  stock_valuation_method, reporting_currency, address) VALUES
  ('co_hedgile_limited', 'org_hedgile', 'Hedgile Limited', 'Hedgile Limited', 'Hedgile Limited', 'HK',
   NULL, NULL, 'Suite 2108, 21/F', 'Two Exchange Square, 8 Connaught Place', 'Central', NULL,
   'Hong Kong', NULL, 'Ingrid Ingot', NULL, NULL,
   'WAVG', NULL, 'Suite 2108, 21/F, Two Exchange Square, 8 Connaught Place, Central, Hong Kong');

INSERT INTO materials (id, organisation_id, code, name, metal) VALUES
  ('mat_ni_cathode', 'org_hedgile', 'NI-CATH', 'Nickel cathodes', 'Nickel'),
  ('mat_ni_briquette', 'org_hedgile', 'NI-BRIQ', 'Nickel briquettes', 'Nickel');

INSERT INTO metal_references (id, organisation_id, metal, name, source, active) VALUES
  ('ref_lme_ni_cash', 'org_hedgile', 'Nickel', 'LME Nickel Cash', 'LME', 1);

INSERT INTO audit_log (id, organisation_id, user_id, action, object_type, object_id, details)
VALUES (lower(hex(randomblob(16))), 'org_hedgile', NULL, 'demo.reset', 'organisation', 'org_hedgile', NULL);
