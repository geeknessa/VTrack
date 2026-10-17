-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Migration tracking table
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. User Settings table
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  home_currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
  period_type VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('weekly', 'biweekly', 'monthly', 'custom_days', 'manual')),
  period_anchor_date DATE,
  expected_next_income_date DATE,
  income_pattern VARCHAR(50),
  main_goal VARCHAR(30) NOT NULL DEFAULT 'see_spending' CHECK (main_goal IN ('see_spending', 'make_last', 'save')),
  savings_target BIGINT NOT NULL DEFAULT 0,
  opening_balance BIGINT NOT NULL DEFAULT 0,
  theme VARCHAR(10) NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  accent VARCHAR(20) NOT NULL DEFAULT '#E60067',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  icon_key VARCHAR(50) NOT NULL,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('needs', 'wants')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('expense', 'income')),
  amount BIGINT NOT NULL, -- minor units
  currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
  exchange_rate NUMERIC(12, 6) NOT NULL DEFAULT 1.0,
  converted_amount BIGINT NOT NULL, -- minor units in home_currency
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  source_group VARCHAR(30) CHECK (source_group IN ('food_court', 'outside_order', 'someone_bought', 'eating_out')),
  income_type VARCHAR(30) CHECK (income_type IN ('allowance', 'gift', 'side_hustle', 'refund')),
  note TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL, -- minor units
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, category_id, period_start, period_end)
);

-- 7. Goals table
CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  target_amount BIGINT NOT NULL, -- minor units
  current_amount BIGINT NOT NULL DEFAULT 0, -- minor units
  deadline DATE,
  icon_key VARCHAR(50) DEFAULT 'target',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. Goal Contributions table
CREATE TABLE IF NOT EXISTS goal_contributions (
  id SERIAL PRIMARY KEY,
  goal_id INT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL, -- minor units
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. Subscription Catalog table
CREATE TABLE IF NOT EXISTS subscription_catalog (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon_key VARCHAR(50) NOT NULL,
  default_amount BIGINT NOT NULL,
  default_currency VARCHAR(10) NOT NULL DEFAULT 'NGN'
);

-- 10. User Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  catalog_id INT REFERENCES subscription_catalog(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  amount BIGINT NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
  billing_day INT NOT NULL CHECK (billing_day BETWEEN 1 AND 31),
  cycle VARCHAR(10) NOT NULL DEFAULT 'monthly' CHECK (cycle IN ('monthly', 'yearly')),
  trial_ends_on DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'trial')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. FX Rates table
CREATE TABLE IF NOT EXISTS fx_rates (
  id SERIAL PRIMARY KEY,
  base_currency VARCHAR(10) NOT NULL,
  target_currency VARCHAR(10) NOT NULL,
  rate NUMERIC(16, 8) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(base_currency, target_currency)
);

-- 12. Share Links table
CREATE TABLE IF NOT EXISTS share_links (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ
);
