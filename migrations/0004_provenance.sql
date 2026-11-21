-- Provenance behind every stored or calculated value: what triggered it, whether it was
-- automatic or manual, the formula and inputs for calculated values, who and when.
-- Rows are only ever added; the latest row per (object, field) is the current provenance.

CREATE TABLE value_provenance (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('market', 'quantity', 'quality', 'pricing_conditions', 'manual')),
  mode TEXT NOT NULL CHECK (mode IN ('automatic', 'manual')),
  formula TEXT,
  inputs TEXT, -- JSON: ordered [{ name, value, source? }]
  user_id TEXT REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX value_provenance_lookup
  ON value_provenance (organisation_id, object_type, object_id, field, created_at);
