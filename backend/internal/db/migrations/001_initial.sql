-- ============================================================
-- 001_initial.sql — Full schema for Data Entry Testing Platform
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS (idempotent)
-- ============================================================
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('pending', 'active', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE field_type AS ENUM ('display', 'text', 'number', 'date', 'dropdown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE record_status AS ENUM ('active', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE session_status AS ENUM ('active', 'ended', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    mobile        TEXT NOT NULL UNIQUE,
    email         TEXT,
    password_hash TEXT NOT NULL,
    status        user_status NOT NULL DEFAULT 'pending',
    is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at   TIMESTAMPTZ,
    approved_by   UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ============================================================
-- BATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS batches (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename     TEXT NOT NULL,
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    uploaded_by  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    record_count INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- FIELD CONFIGS
-- ============================================================
CREATE TABLE IF NOT EXISTS field_configs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id         UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    column_key       TEXT NOT NULL,
    label            TEXT NOT NULL,
    field_type       field_type NOT NULL,
    is_reference     BOOLEAN NOT NULL DEFAULT FALSE,
    dropdown_options TEXT[],
    sort_order       INTEGER NOT NULL,
    UNIQUE (batch_id, column_key)
);

CREATE INDEX IF NOT EXISTS idx_field_configs_batch ON field_configs(batch_id);

-- ============================================================
-- DATA RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS data_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    global_sequence INTEGER,
    batch_id        UUID NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
    values          JSONB NOT NULL DEFAULT '{}',
    status          record_status NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_records_global_seq
    ON data_records(global_sequence)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_data_records_batch  ON data_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_data_records_status ON data_records(status);

-- ============================================================
-- SEQUENCE COUNTER (singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS sequence_counter (
    id       INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    next_val INTEGER NOT NULL DEFAULT 1
);
INSERT INTO sequence_counter VALUES (1, 1) ON CONFLICT DO NOTHING;

-- ============================================================
-- USER SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_number  SMALLINT NOT NULL CHECK (session_number IN (1, 2)),
    session_date    DATE NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    device_id       TEXT NOT NULL,
    device_name     TEXT,
    elapsed_seconds INTEGER NOT NULL DEFAULT 0,
    status          session_status NOT NULL DEFAULT 'active',
    UNIQUE (user_id, session_date, session_number)
);

-- Enforce: only one active session per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session_per_user
    ON user_sessions(user_id)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_date ON user_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_user_sessions_status    ON user_sessions(status);

-- ============================================================
-- USER SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    data_record_id  UUID NOT NULL REFERENCES data_records(id) ON DELETE RESTRICT,
    session_id      UUID NOT NULL REFERENCES user_sessions(id) ON DELETE RESTRICT,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    input_values    JSONB NOT NULL DEFAULT '{}',
    sequence_number INTEGER NOT NULL,
    -- Validation results added at submission time
    validation      JSONB NOT NULL DEFAULT '{}', -- per-field: {col_key: {expected, entered, correct}}
    correct_count   INTEGER NOT NULL DEFAULT 0,
    total_count     INTEGER NOT NULL DEFAULT 0,
    accuracy        NUMERIC(5,2) NOT NULL DEFAULT 0, -- percentage 0-100
    UNIQUE (session_id, data_record_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_user    ON user_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_session ON user_submissions(session_id);
CREATE INDEX IF NOT EXISTS idx_submissions_record  ON user_submissions(data_record_id);

-- ============================================================
-- DAILY USAGE VIEW
-- ============================================================
CREATE OR REPLACE VIEW v_user_daily_usage AS
SELECT
    user_id,
    session_date,
    COUNT(*)                                 AS sessions_used,
    COALESCE(SUM(elapsed_seconds), 0)        AS total_elapsed_seconds,
    28800 - COALESCE(SUM(elapsed_seconds), 0) AS remaining_seconds
FROM user_sessions
WHERE status IN ('active', 'ended', 'expired')
GROUP BY user_id, session_date;
