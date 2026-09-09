ALTER TABLE users
  ADD COLUMN IF NOT EXISTS credential_valid_until DATE;

-- Backfill existing approved users: approved_at + 365 days
UPDATE users
  SET credential_valid_until = (approved_at + INTERVAL '365 days')::DATE
  WHERE approved_at IS NOT NULL AND credential_valid_until IS NULL;
