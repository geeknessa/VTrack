-- 006_flexible_periods.sql
-- Allow flexible tracking periods: cycle, daily, weekly, biweekly, monthly, yearly, custom, all_time
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_period_type_check;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS custom_period_from DATE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS custom_period_to DATE;
