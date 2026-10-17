-- Phase 3: Cycles, Piggybank, and Currencies

-- 1. Cycles Table
-- Tracks each period (e.g., Week 1, Month 1, or Manual Cycle)
CREATE TABLE IF NOT EXISTS cycles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMPTZ, -- Null if 'manual' until closed
  base_income BIGINT NOT NULL DEFAULT 0, -- The expected income at the start
  rollover_amount BIGINT NOT NULL DEFAULT 0, -- Money brought in from the previous cycle
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add Phase 3 fields to User Settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS base_income BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vault_balance BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_sweep_leftovers BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_cycle_id INT REFERENCES cycles(id) ON DELETE SET NULL;

-- 3. Add Cycle ID to Transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS cycle_id INT REFERENCES cycles(id) ON DELETE SET NULL;

-- 4. Currency Conversion Rates (Exchange Rates API simulation)
CREATE TABLE IF NOT EXISTS exchange_rates (
  base_currency VARCHAR(10) NOT NULL,
  target_currency VARCHAR(10) NOT NULL,
  rate NUMERIC(12, 6) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (base_currency, target_currency)
);

-- Insert dummy rates for demo (Base: NGN)
INSERT INTO exchange_rates (base_currency, target_currency, rate) VALUES
  ('NGN', 'USD', 0.00062),
  ('NGN', 'GBP', 0.00049),
  ('NGN', 'EUR', 0.00057),
  ('NGN', 'KES', 0.082),
  ('NGN', 'GHS', 0.0084),
  ('USD', 'NGN', 1610.0),
  ('GBP', 'NGN', 2040.0),
  ('EUR', 'NGN', 1750.0)
ON CONFLICT (base_currency, target_currency) DO UPDATE SET rate = EXCLUDED.rate;
