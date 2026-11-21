-- Plants and storage locations per company
-- A legal entity (company) has plants, and each plant has storage locations.

CREATE TABLE plants (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  internal_number TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX plants_org ON plants (organisation_id, company_id, code);
CREATE UNIQUE INDEX plants_org_company_code ON plants (organisation_id, company_id, code);

CREATE TABLE storage_locations (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  plant_id TEXT NOT NULL REFERENCES plants (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX storage_locations_org ON storage_locations (organisation_id, plant_id, code);
CREATE UNIQUE INDEX storage_locations_org_plant_code ON storage_locations (organisation_id, plant_id, code);
