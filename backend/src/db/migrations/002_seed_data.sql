-- Seed default global categories (user_id IS NULL)
INSERT INTO categories (user_id, name, icon_key, kind, is_default) VALUES
  (NULL, 'Food & Groceries', 'utensils', 'needs', true),
  (NULL, 'Transport & Commute', 'bus', 'needs', true),
  (NULL, 'Academics & Books', 'book', 'needs', true),
  (NULL, 'Health & Toiletries', 'heart-pulse', 'needs', true),
  (NULL, 'Rent & Utilities', 'home', 'needs', true),
  (NULL, 'Data & Airtime', 'wifi', 'needs', true),
  (NULL, 'Snacks & Drinks', 'coffee', 'wants', true),
  (NULL, 'Outings & Hangouts', 'party', 'wants', true),
  (NULL, 'Clothes & Fashion', 'shirt', 'wants', true),
  (NULL, 'Tech & Accessories', 'laptop', 'wants', true),
  (NULL, 'Gifts & Giving', 'gift', 'wants', true),
  (NULL, 'Entertainment & Subscriptions', 'film', 'wants', true)
ON CONFLICT DO NOTHING;

-- Seed subscription catalog
INSERT INTO subscription_catalog (name, icon_key, default_amount, default_currency) VALUES
  ('Google One', 'cloud', 120000, 'NGN'),
  ('YouTube Premium', 'youtube', 150000, 'NGN'),
  ('Spotify', 'music', 130000, 'NGN'),
  ('Claude Pro', 'bot', 3200000, 'NGN'),
  ('ChatGPT Plus', 'sparkles', 3200000, 'NGN'),
  ('Grammarly', 'pen', 2500000, 'NGN'),
  ('Netflix', 'tv', 4500000, 'NGN'),
  ('Canva Pro', 'palette', 2800000, 'NGN'),
  ('Notion Plus', 'file-text', 1800000, 'NGN'),
  ('Duolingo Plus', 'globe', 1500000, 'NGN'),
  ('Microsoft 365', 'grid', 2200000, 'NGN'),
  ('iCloud+', 'cloud', 90000, 'NGN'),
  ('Showmax', 'tv-minimal', 2900000, 'NGN'),
  ('Boomplay', 'music-2', 90000, 'NGN'),
  ('DStv / GOtv', 'monitor', 950000, 'NGN')
ON CONFLICT DO NOTHING;
