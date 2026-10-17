-- 011_menu_item_category.sql
-- Add food category classification to menu items

ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS category VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);

UPDATE menu_items
SET category = CASE
  WHEN is_provisions = true THEN 'Provisions & Stash'
  WHEN LOWER(name) ~* 'shawarma|wrap|quesadilla|burrito|taco|fajita' THEN 'Shawarma & Wraps'
  WHEN LOWER(name) ~* 'rice|jollof|ofada|ayamase' THEN 'Rice Dishes'
  WHEN LOWER(name) ~* 'pasta|spaghetti|ghetti|noodles|noodle|macaroni|alfredo|indomie|ramen|lasagna|bolognese' THEN 'Pasta & Noodles'
  WHEN LOWER(name) ~* 'burger|sandwich|toast|hotdog|hot dog|chilli dog|panini|sub\b' THEN 'Burgers & Sandwiches'
  WHEN LOWER(name) ~* 'smoothie|shake|milkshake|juice|drink|water|coke|fanta|sprite|pepsi|boba|tea|coffee|malt|zobo|chapman|soda|capri|berryblast|pulpy|schweppes|can\b|bottle|frappe|latte|macchiato|lemonade|cappuccino|espresso|mocha|slush|slushie|slushy|mojito|nutrimilk|smoove|yogurt|fura|kunu|lacasera|five alive|mirinda|teem|energy|red bull|predator|frappuccino' THEN 'Drinks & Refreshers'
  WHEN LOWER(name) ~* 'pie|roll|doughnut|donut|cake|waffle|pancake|akara|pap\b|croissant|chin chin|biscuit|pastry|puff|samosa|spring roll|ice cream|cotton candy|popcorn|muffin|chops' THEN 'Pastries & Snacks'
  WHEN LOWER(name) ~* 'wing|chicken|beef|turkey|fish|meat|asun|suya|gizzard|pork|bbq|ribs|steak|calamari|prawn|shrimp|seafood|liver|goat|kpomo' THEN 'Wings & Proteins'
  WHEN LOWER(name) ~* 'fries|chips|plantain|plaintain|dodo|coleslaw|salad|extra|xtra|portion|topping|ketchup|mayo|dip|syrup|moi moi|moimoi|egg|sausage|sauce|yam|masa|dan wake|semovita|poundo|eba|fufu|garri|bread|beans|ewa|wedges' THEN 'Extras & Sides'
  ELSE 'Specialties & Others'
END
WHERE category IS NULL;
