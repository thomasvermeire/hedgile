-- Test mode: an organisation in test mode may future-date postings (see src/posting/).
ALTER TABLE organisations ADD COLUMN test_mode INTEGER NOT NULL DEFAULT 0;
