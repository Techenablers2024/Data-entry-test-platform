-- Add display_id column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_id TEXT NOT NULL DEFAULT '';

-- Backfill existing users: DEP-{last3mobile}-{ddmmyy of created_at}
UPDATE users
SET display_id = 'DEP-' || RIGHT(mobile, 3) || '-' || TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'DDMMYY')
WHERE display_id = '';

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS users_display_id_idx ON users(display_id);
