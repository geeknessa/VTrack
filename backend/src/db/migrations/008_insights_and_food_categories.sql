-- Migration 008: Insights, Meal Plan Target & Distinct Food Categories

-- 1. Add meal_plan_weekly_target to user_settings if not exists
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS meal_plan_weekly_target BIGINT DEFAULT 0;

-- 2. Insert distinct food categories if they don't already exist
INSERT INTO categories (user_id, name, icon_key, kind, is_default)
VALUES
  (NULL, 'Food Court', 'store', 'needs', true),
  (NULL, 'Outside Dining', 'coffee', 'wants', true),
  (NULL, 'Snacks & Provisions', 'shopping-bag', 'needs', true)
ON CONFLICT DO NOTHING;
