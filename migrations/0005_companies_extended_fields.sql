-- Add extended fields to companies for legal/commercial names, address details,
-- VAT/registration numbers, website, contact info, and valuation/currency settings.

ALTER TABLE companies ADD COLUMN legal_name TEXT;
ALTER TABLE companies ADD COLUMN commercial_name TEXT;
ALTER TABLE companies ADD COLUMN address_line_1 TEXT;
ALTER TABLE companies ADD COLUMN address_line_2 TEXT;
ALTER TABLE companies ADD COLUMN city TEXT;
ALTER TABLE companies ADD COLUMN postal_code TEXT;
ALTER TABLE companies ADD COLUMN state_province TEXT;
ALTER TABLE companies ADD COLUMN registration_number TEXT;
ALTER TABLE companies ADD COLUMN website TEXT;
ALTER TABLE companies ADD COLUMN contact_person TEXT;
ALTER TABLE companies ADD COLUMN contact_email TEXT;
ALTER TABLE companies ADD COLUMN contact_phone TEXT;
ALTER TABLE companies ADD COLUMN stock_valuation_method TEXT CHECK (stock_valuation_method IN ('WAVG', 'Batch', 'FIFO', 'LIFO'));
-- Base currency of the legal entity: shown locked on the card, changed only in Settings > Currencies.
ALTER TABLE companies ADD COLUMN base_currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE companies ADD COLUMN reporting_currency TEXT;

-- Migrate existing address to address_line_1
UPDATE companies SET address_line_1 = address WHERE address IS NOT NULL;
-- `address` stays as the one-line address (Laimon drafts fill it); the card prefers the separate fields.
