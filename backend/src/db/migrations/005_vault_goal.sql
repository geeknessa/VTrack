-- Phase 5: Vault Goal
-- Add a dedicated savings goal amount for the piggybank widget,
-- separate from the main savings_target on user_settings.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS vault_goal BIGINT NOT NULL DEFAULT 0;
