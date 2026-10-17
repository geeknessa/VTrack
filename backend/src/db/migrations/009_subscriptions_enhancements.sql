-- Migration 009: Subscriptions enhancements
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS icon_key VARCHAR(50) DEFAULT 'credit-card',
ADD COLUMN IF NOT EXISTS category_id INT REFERENCES categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_renewed_at TIMESTAMPTZ;
