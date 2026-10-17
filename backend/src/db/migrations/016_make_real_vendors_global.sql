-- 016_make_real_vendors_global.sql
-- Remove initial starter/mock vendors and make the 12 real uploaded campus restaurants global for all users

-- 1. Remove mock/duplicate starter vendors (cascade removes their items)
DELETE FROM food_vendors
WHERE id NOT IN (7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20);

-- 2. Make the 12 real campus restaurants global (user_id = NULL)
UPDATE food_vendors
SET user_id = NULL
WHERE id IN (7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20);

-- 3. Make their menu items global (user_id = NULL)
UPDATE menu_items
SET user_id = NULL
WHERE vendor_id IN (7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20);
