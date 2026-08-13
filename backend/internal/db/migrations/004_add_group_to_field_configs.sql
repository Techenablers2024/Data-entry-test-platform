-- Add group column to field_configs
ALTER TABLE field_configs ADD COLUMN IF NOT EXISTS "group" TEXT NOT NULL DEFAULT '';
