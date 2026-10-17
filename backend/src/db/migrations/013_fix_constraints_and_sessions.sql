-- Migration 013: Update transactions source_group check constraint and create session table

-- 1. Support piggybank in source_group check constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_source_group_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_source_group_check 
  CHECK (source_group IS NULL OR source_group IN ('food_court', 'outside_order', 'someone_bought', 'eating_out', 'piggybank'));

-- 2. Create session store table for connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "idx_session_expire" ON "session" ("expire");
