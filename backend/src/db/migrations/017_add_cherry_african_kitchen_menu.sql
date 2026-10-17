-- 017_add_cherry_african_kitchen_menu.sql
-- Add the complete official menu for Cherry African Kitchen from their official menu board

-- 1. Ensure vendor exists and has the accurate brand name 'Cherry African Kitchen'
UPDATE food_vendors
SET name = 'Cherry African Kitchen',
    location = 'Campus Food Court',
    category_id = 13,
    icon_key = 'utensils',
    user_id = NULL
WHERE id = 18;

-- If for any reason vendor 18 does not exist, insert it
INSERT INTO food_vendors (id, user_id, name, location, category_id, icon_key)
SELECT 18, NULL, 'Cherry African Kitchen', 'Campus Food Court', 13, 'utensils'
WHERE NOT EXISTS (SELECT 1 FROM food_vendors WHERE id = 18);

-- 2. Clear FK references from meal_plans before refreshing items
UPDATE meal_plans
SET menu_item_id = NULL
WHERE menu_item_id IN (SELECT id FROM menu_items WHERE vendor_id = 18);

-- 3. Remove old/stub menu items for Cherry African Kitchen
DELETE FROM menu_items WHERE vendor_id = 18;

-- 4. Insert full verified items with minor units (1 NGN = 100 kobo)
INSERT INTO menu_items (user_id, vendor_id, name, price, currency, meal_type, is_provisions, category) VALUES
-- OUR FAVOURITE FOOD MENU
(NULL, 18, 'Jollof Rice / Fried Rice', 150000, 'NGN', 'lunch', false, 'Rice Dishes'),
(NULL, 18, 'Jollof / Fried Rice with Protein', 290000, 'NGN', 'lunch', false, 'Rice Dishes'),
(NULL, 18, 'Jollof / Fried Rice, Protein & Salad', 320000, 'NGN', 'lunch', false, 'Rice Dishes'),
(NULL, 18, 'White Rice and Sauce', 200000, 'NGN', 'lunch', false, 'Rice Dishes'),
(NULL, 18, 'White Rice with Sauce & Protein', 350000, 'NGN', 'lunch', false, 'Rice Dishes'),
(NULL, 18, 'Ofada Rice with Special Sauce', 350000, 'NGN', 'lunch', false, 'Rice Dishes'),
(NULL, 18, 'White Rice & Beans with Sauce', 350000, 'NGN', 'lunch', false, 'Rice Dishes'),
(NULL, 18, 'Coconut Rice', 200000, 'NGN', 'lunch', false, 'Rice Dishes'),
(NULL, 18, 'Coconut Rice with Protein', 350000, 'NGN', 'lunch', false, 'Rice Dishes'),
(NULL, 18, 'Jollof Spaghetti', 150000, 'NGN', 'lunch', false, 'Pasta & Noodles'),
(NULL, 18, 'Jollof Spaghetti with Protein', 300000, 'NGN', 'lunch', false, 'Pasta & Noodles'),
(NULL, 18, 'Beans Porridge', 150000, 'NGN', 'lunch', false, 'Extras & Sides'),
(NULL, 18, 'Beans Porridge with Plantain', 250000, 'NGN', 'lunch', false, 'Extras & Sides'),
(NULL, 18, 'Yam Porridge', 180000, 'NGN', 'lunch', false, 'Extras & Sides'),
(NULL, 18, 'Fried Plantain with Egg Sauce', 300000, 'NGN', 'breakfast', false, 'Extras & Sides'),
(NULL, 18, 'Plantain with Pepper Sauce', 280000, 'NGN', 'lunch', false, 'Extras & Sides'),
(NULL, 18, 'Yam with Egg Sauce', 300000, 'NGN', 'breakfast', false, 'Extras & Sides'),
(NULL, 18, 'Yam with Pepper Sauce', 280000, 'NGN', 'lunch', false, 'Extras & Sides'),
(NULL, 18, 'Chips with Egg Sauce', 350000, 'NGN', 'lunch', false, 'Extras & Sides'),
(NULL, 18, 'Noodles with Fried/Boiled Egg', 230000, 'NGN', 'lunch', false, 'Pasta & Noodles'),
(NULL, 18, 'Mai-Mai (Moin-Moin)', 100000, 'NGN', 'lunch', false, 'Extras & Sides'),

-- SWALLOWS
(NULL, 18, 'Pounded Yam with Soup', 200000, 'NGN', 'dinner', false, 'Specialties & Others'),
(NULL, 18, 'Semo with Soup', 180000, 'NGN', 'dinner', false, 'Specialties & Others'),
(NULL, 18, 'Garri with Soup', 180000, 'NGN', 'dinner', false, 'Specialties & Others'),
(NULL, 18, 'Soup (Extra Portion)', 80000, 'NGN', 'dinner', false, 'Extras & Sides'),
(NULL, 18, 'Egusi Soup', 80000, 'NGN', 'dinner', false, 'Extras & Sides'),
(NULL, 18, 'Vegetable Soup', 80000, 'NGN', 'dinner', false, 'Extras & Sides'),
(NULL, 18, 'Okro Soup', 80000, 'NGN', 'dinner', false, 'Extras & Sides'),
(NULL, 18, 'Ogbono Soup', 80000, 'NGN', 'dinner', false, 'Extras & Sides'),

-- PROTEIN
(NULL, 18, 'Chicken', 150000, 'NGN', 'lunch', false, 'Wings & Proteins'),
(NULL, 18, 'Beef', 150000, 'NGN', 'lunch', false, 'Wings & Proteins'),
(NULL, 18, 'Goatmeat', 200000, 'NGN', 'lunch', false, 'Wings & Proteins'),
(NULL, 18, 'Fish', 150000, 'NGN', 'lunch', false, 'Wings & Proteins'),
(NULL, 18, 'Egg', 120000, 'NGN', 'breakfast', false, 'Extras & Sides'),
(NULL, 18, 'Beef Suya', 120000, 'NGN', 'dinner', false, 'Wings & Proteins'),
(NULL, 18, 'Chicken Wings Suya', 200000, 'NGN', 'dinner', false, 'Wings & Proteins'),

-- SNACKS
(NULL, 18, 'Meatpie', 120000, 'NGN', 'snack', false, 'Pastries & Snacks'),
(NULL, 18, 'Eggroll', 80000, 'NGN', 'snack', false, 'Pastries & Snacks'),
(NULL, 18, 'Milky Doughnut', 250000, 'NGN', 'snack', false, 'Pastries & Snacks'),
(NULL, 18, 'Burger', 350000, 'NGN', 'lunch', false, 'Burgers & Sandwiches'),
(NULL, 18, 'Shawarma Chicken/Beef', 300000, 'NGN', 'dinner', false, 'Shawarma & Wraps'),
(NULL, 18, 'Sausage Roll', 100000, 'NGN', 'snack', false, 'Pastries & Snacks'),
(NULL, 18, 'Puff-Puff', 100000, 'NGN', 'snack', false, 'Pastries & Snacks'),
(NULL, 18, 'Cake Parfait', 250000, 'NGN', 'snack', false, 'Pastries & Snacks'),
(NULL, 18, 'Doughnut', 70000, 'NGN', 'snack', false, 'Pastries & Snacks'),
(NULL, 18, 'Spring Roll', 60000, 'NGN', 'snack', false, 'Pastries & Snacks'),
(NULL, 18, 'Samosa', 60000, 'NGN', 'snack', false, 'Pastries & Snacks'),
(NULL, 18, 'Pop-Corn', 100000, 'NGN', 'snack', false, 'Pastries & Snacks'),
(NULL, 18, 'Fruit Salad', 250000, 'NGN', 'snack', false, 'Pastries & Snacks'),

-- NATURAL DRINKS
(NULL, 18, 'Zobo', 120000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Kunu Aya', 150000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Orange Juice', 200000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Sugarcane Juice', 200000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Tamarind Juice', 100000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Ginger Juice', 150000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Pineapple Juice', 200000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Watermelon Juice', 200000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Virgin Mojito', 120000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Bottled Water', 30000, 'NGN', 'snack', false, 'Drinks & Refreshers'),

-- SOFT DRINKS
(NULL, 18, 'Coke / Fanta / Sprite', 60000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Pepsi / Mirinda', 60000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Chivita', 300000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Sosa Fruit Drink', 150000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Chi-Exotic', 230000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Cway Peach', 80000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Caprisun', 50000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Pure Heaven', 200000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Ribena', 120000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'LaCasera', 60000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Limca', 60000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Teem', 60000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Fayrouz', 80000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Amstel Malt', 70000, 'NGN', 'snack', false, 'Drinks & Refreshers'),

-- DAIRY DRINKS
(NULL, 18, 'Habib Yoghurt', 250000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Freshyo', 100000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Viju Milk', 80000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Nutri Milk', 80000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Vita Milk', 200000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Nutri Choco', 80000, 'NGN', 'snack', false, 'Drinks & Refreshers'),

-- BLENDED & FROZEN
(NULL, 18, 'Cream Shake', 300000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Smoothie', 200000, 'NGN', 'snack', false, 'Drinks & Refreshers'),
(NULL, 18, 'Slushy', 150000, 'NGN', 'snack', false, 'Drinks & Refreshers');
