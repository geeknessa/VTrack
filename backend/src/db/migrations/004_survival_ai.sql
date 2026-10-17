-- Phase 4: Survival AI (Predictive Budgeting)
ALTER TABLE user_settings 
ADD COLUMN lifestyle_meal_plan BOOLEAN DEFAULT false,
ADD COLUMN lifestyle_daily_meals INTEGER DEFAULT 2,
ADD COLUMN lifestyle_meal_cost BIGINT DEFAULT 0;
