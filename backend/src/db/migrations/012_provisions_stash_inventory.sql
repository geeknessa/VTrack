-- Migration 012: Provisions Stash Inventory & Stock Management

-- 1. Add stock_quantity and unit to menu_items
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'items';

-- 2. Create stash_logs table to track meals eaten from room stash & savings
CREATE TABLE IF NOT EXISTS stash_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity INTEGER DEFAULT 1,
  estimated_savings INTEGER DEFAULT 250000, -- ₦2,500 savings per campus meal avoided
  consumed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stash_logs_user_date ON stash_logs(user_id, consumed_at DESC);
