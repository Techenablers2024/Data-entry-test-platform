-- Sequence for MMT member IDs (MMT0001, MMT0002, ...)
CREATE SEQUENCE IF NOT EXISTS user_display_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- Re-number all existing users in registration order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM users
)
UPDATE users u
SET display_id = 'MMT' || LPAD(r.rn::TEXT, 4, '0')
FROM ranked r
WHERE u.id = r.id;

-- Advance sequence past existing users so next signup gets the correct number
SELECT setval(
  'user_display_id_seq',
  COALESCE((SELECT COUNT(*) FROM users), 0) + 1,
  false
);
