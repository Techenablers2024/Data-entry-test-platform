-- Add record_code column to data_records
ALTER TABLE data_records ADD COLUMN IF NOT EXISTS record_code TEXT NOT NULL DEFAULT '';

-- Backfill existing records with TQ-XXXXXX format using random chars
UPDATE data_records
SET record_code = 'TQ-' || UPPER(SUBSTRING(MD5(id::text), 1, 6))
WHERE record_code = '';

-- Add unique index
CREATE UNIQUE INDEX IF NOT EXISTS data_records_record_code_idx ON data_records(record_code);
