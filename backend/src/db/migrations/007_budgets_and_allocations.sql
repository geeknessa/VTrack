-- 007_budgets_and_allocations.sql
-- Drop old unused placeholder budgets table and create full-featured budgets and budget_categories tables

DROP TABLE IF EXISTS budgets CASCADE;

CREATE TABLE budgets (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100),
  cycle_type VARCHAR(30) NOT NULL DEFAULT 'monthly' CHECK (cycle_type IN ('monthly', 'weekly', 'biweekly', 'allowance', 'custom')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_amount BIGINT NOT NULL, -- spending budget in kobo
  daily_limit BIGINT, -- optional guardrail in kobo
  weekly_limit BIGINT, -- optional guardrail in kobo
  savings_target BIGINT DEFAULT 0, -- optional target to set aside in vault
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budget_categories (
  id SERIAL PRIMARY KEY,
  budget_id INT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  allocated_amount BIGINT NOT NULL, -- amount allocated to this category in kobo
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (budget_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_active ON budgets(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_budget_categories_budget_id ON budget_categories(budget_id);
