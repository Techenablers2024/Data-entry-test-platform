-- 002: Add validation columns to user_submissions
ALTER TABLE user_submissions
    ADD COLUMN IF NOT EXISTS validation    JSONB    NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS correct_count INTEGER  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_count   INTEGER  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS accuracy      NUMERIC(5,2) NOT NULL DEFAULT 0;
