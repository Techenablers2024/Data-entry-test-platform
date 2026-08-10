-- Add 'fixed' field type to the enum
ALTER TYPE field_type ADD VALUE IF NOT EXISTS 'fixed';
