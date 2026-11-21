-- Email and password sign-in (replaces LaimonID for now).
-- Password users get issuer 'local' and subject = their user id.
ALTER TABLE users ADD COLUMN password_hash TEXT;
-- Wrong passwords in a row, and until when the account is locked after too many.
ALTER TABLE users ADD COLUMN failed_logins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;
-- Bumped on password change: sessions carrying an older value are signed out.
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX users_local_email ON users (email) WHERE issuer = 'local';
