-- 010_menus_and_meal_planner.sql
-- Create food_vendors, menu_items, and meal_plans tables for zero-storage food management

CREATE TABLE IF NOT EXISTS food_vendors (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(150),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  icon_key VARCHAR(50) DEFAULT 'utensils',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vendor_id INTEGER REFERENCES food_vendors(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  price INTEGER NOT NULL DEFAULT 0, -- Minor units (e.g. 250000 = ₦2,500)
  currency VARCHAR(3) DEFAULT 'NGN',
  meal_type VARCHAR(50) DEFAULT 'lunch', -- 'breakfast', 'lunch', 'dinner', 'snack', 'any'
  is_provisions BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meal_plans (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  meal_time VARCHAR(20) NOT NULL, -- 'breakfast', 'lunch', 'dinner', 'snack'
  menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
  custom_item_name VARCHAR(150),
  is_provisions_stash BOOLEAN DEFAULT false,
  estimated_price INTEGER DEFAULT 0,
  is_logged BOOLEAN DEFAULT false,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_menu_items_user_vendor ON menu_items(user_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_date ON meal_plans(user_id, plan_date);
