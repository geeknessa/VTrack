const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { formatMoney } = require('../utils/money');
const router = express.Router();

router.use(requireAuth);

/**
 * Dynamically computes a realistic single-meal cost benchmark for the user.
 * Derived in real-time from:
 * 1. User's configured lifestyle_meal_cost setting if > 0.
 * 2. User's actual recent food expenses (average spent in past 60 days).
 * 3. Live average price of active campus dishes from menu_items.
 * 4. General food court menu average.
 */
async function getDynamicMealBenchmark(userId) {
  try {
    // 1. User's lifestyle meal cost setting if specified
    const setRes = await db.query(
      'SELECT lifestyle_meal_cost FROM user_settings WHERE user_id = $1',
      [userId]
    );
    const lifestyleCost = Number(setRes.rows[0]?.lifestyle_meal_cost || 0);
    if (lifestyleCost > 0) return lifestyleCost;

    // 2. User's actual recent food transactions average (past 60 days)
    const txRes = await db.query(
      `SELECT ROUND(AVG(t.amount)) as avg_spend
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 
         AND t.type = 'expense'
         AND (c.name ILIKE '%food%' OR c.name ILIKE '%grocer%' OR t.note ILIKE '%food%' OR t.note ILIKE '%cafe%' OR t.note ILIKE '%rice%')
         AND t.occurred_at >= NOW() - INTERVAL '60 days'`,
      [userId]
    );
    const avgSpend = Number(txRes.rows[0]?.avg_spend || 0);
    if (avgSpend > 0) return avgSpend;

    // 3. User's active non-provisions campus dishes average
    const menuRes = await db.query(
      `SELECT ROUND(AVG(price)) as avg_price
       FROM menu_items
       WHERE (user_id = $1 OR user_id IS NULL) AND is_provisions = false AND price > 0`,
      [userId]
    );
    const avgPrice = Number(menuRes.rows[0]?.avg_price || 0);
    if (avgPrice > 0) return avgPrice;

    // 4. Global menu average across system
    const globalRes = await db.query(
      `SELECT ROUND(AVG(price)) as avg_price FROM menu_items WHERE is_provisions = false AND price > 0`
    );
    const globalPrice = Number(globalRes.rows[0]?.avg_price || 0);
    if (globalPrice > 0) return globalPrice;

    return 200000;
  } catch (err) {
    console.error('Error calculating meal benchmark:', err);
    return 200000;
  }
}

// Helper to find cheaper options across competing food spots for similar dishes
function findCheaperOption(item, allItems) {
  if (item.price <= 0 || item.is_provisions) return null;

  const keywords = ['jollof', 'fried rice', 'spaghetti', 'pasta', 'shawarma', 'beans', 'burger', 'noodles', 'pie', 'chicken', 'beef', 'rice', 'meat pie'];
  const lowerName = item.name.toLowerCase();
  const matchedKeyword = keywords.find(k => lowerName.includes(k));

  if (!matchedKeyword) return null;

  // Find other items from different vendors matching the same dish keyword
  const matches = allItems.filter(other => 
    other.id !== item.id &&
    other.vendor_id !== item.vendor_id &&
    !other.is_provisions &&
    Number(other.price) > 0 &&
    other.name.toLowerCase().includes(matchedKeyword)
  );

  if (matches.length === 0) return null;

  // Sort by lowest price
  matches.sort((a, b) => Number(a.price) - Number(b.price));
  const cheapest = matches[0];

  if (Number(cheapest.price) < Number(item.price)) {
    return {
      item_id: cheapest.id,
      dish_name: cheapest.name,
      vendor_name: cheapest.vendor_name,
      price: Number(cheapest.price),
      savings: Number(item.price) - Number(cheapest.price),
    };
  }

  if (Number(item.price) <= Number(cheapest.price) && matches.length > 0) {
    const highest = matches[matches.length - 1];
    return {
      is_best_price: true,
      competing_vendors_count: matches.length,
      competitor_name: highest.vendor_name,
      savings_vs_competitor: Number(highest.price) - Number(item.price),
    };
  }

  return null;
}

// Helper to categorize campus food dishes automatically
function detectFoodCategory(name, isProvisions) {
  if (isProvisions) return 'Provisions & Stash';
  const lower = (name || '').toLowerCase();

  // Shawarma & Wraps
  if (/shawarma|wrap|quesadilla|burrito|taco|fajita/i.test(lower)) return 'Shawarma & Wraps';

  // Rice Dishes
  if (/rice|jollof|ofada|ayamase/i.test(lower)) return 'Rice Dishes';

  // Pasta & Noodles
  if (/pasta|spaghetti|ghetti|noodles|noodle|macaroni|alfredo|indomie|ramen|lasagna|bolognese/i.test(lower)) return 'Pasta & Noodles';

  // Burgers & Sandwiches
  if (/burger|sandwich|toast|hotdog|hot dog|chilli dog|panini|sub\b/i.test(lower)) return 'Burgers & Sandwiches';

  // Drinks & Refreshers
  if (/smoothie|shake|milkshake|juice|drink|water|coke|fanta|sprite|pepsi|boba|tea|coffee|malt|zobo|chapman|soda|capri|berryblast|pulpy|schweppes|can\b|bottle|frappe|latte|macchiato|lemonade|cappuccino|espresso|mocha|slush|slushie|slushy|mojito|nutrimilk|smoove|yogurt|fura|kunu|lacasera|five alive|mirinda|teem|energy|red bull|predator|frappuccino/i.test(lower)) return 'Drinks & Refreshers';

  // Pastries & Snacks
  if (/pie|roll|doughnut|donut|cake|waffle|pancake|akara|pap\b|croissant|chin chin|biscuit|pastry|puff|samosa|spring roll|ice cream|cotton candy|popcorn|muffin|chops/i.test(lower)) return 'Pastries & Snacks';

  // Wings & Proteins
  if (/wing|chicken|beef|turkey|fish|meat|asun|suya|gizzard|pork|bbq|ribs|steak|calamari|prawn|shrimp|seafood|liver|goat|kpomo/i.test(lower)) return 'Wings & Proteins';

  // Extras & Sides
  if (/fries|chips|plantain|plaintain|dodo|coleslaw|salad|extra|xtra|portion|topping|ketchup|mayo|dip|syrup|moi moi|moimoi|egg|sausage|sauce|yam|masa|dan wake|semovita|poundo|eba|fufu|garri|bread|beans|ewa|wedges/i.test(lower)) return 'Extras & Sides';

  return 'Specialties & Others';
}

// ── GET /api/menus/vendors ──────────────────────────────────────────────────
router.get('/vendors', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT v.*, c.name as category_name,
              COUNT(m.id)::int as item_count,
              COALESCE(MIN(CASE WHEN m.price > 0 THEN m.price END), 0)::int as min_price,
              COALESCE(MAX(m.price), 0)::int as max_price
       FROM food_vendors v
       LEFT JOIN categories c ON v.category_id = c.id
       LEFT JOIN menu_items m ON v.id = m.vendor_id AND (m.user_id = $1 OR m.user_id IS NULL)
       WHERE (v.user_id = $1 OR v.user_id IS NULL)
       GROUP BY v.id, c.name
       ORDER BY v.name ASC`,
      [req.userId]
    );

    return res.json({ vendors: result.rows });
  } catch (err) {
    console.error('Error fetching food vendors:', err);
    return res.status(500).json({ error: { message: 'Failed to load food spots.' } });
  }
});

// ── POST /api/menus/vendors ─────────────────────────────────────────────────
router.post('/vendors', async (req, res) => {
  const { name, location, category_id, category, icon_key } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: { message: 'Food spot name is required.' } });
  }

  try {
    let finalCatId = category_id || null;
    if (!finalCatId && category) {
      const catNameMap = {
        'food_court': 'Food Court',
        'outside': 'Outside Dining',
        'provisions': 'Snacks & Provisions'
      };
      const targetName = catNameMap[category] || 'Food Court';
      const cRes = await db.query("SELECT id FROM categories WHERE name = $1 LIMIT 1", [targetName]);
      finalCatId = cRes.rows[0]?.id || null;
    }

    const result = await db.query(
      `INSERT INTO food_vendors (user_id, name, location, category_id, icon_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.userId, name.trim(), location ? location.trim() : null, finalCatId, icon_key || 'utensils']
    );

    return res.status(201).json({
      message: 'Food spot added successfully!',
      vendor: result.rows[0],
    });
  } catch (err) {
    console.error('Error creating food vendor:', err);
    return res.status(500).json({ error: { message: 'Failed to add food spot.' } });
  }
});

// ── PUT /api/menus/vendors/:id ──────────────────────────────────────────────
router.put('/vendors/:id', async (req, res) => {
  const vendorId = parseInt(req.params.id, 10);
  const { name, location, category_id, category, icon_key } = req.body;

  try {
    let finalCatId = category_id !== undefined ? category_id : null;
    if (finalCatId === null && category) {
      const catNameMap = {
        'food_court': 'Food Court',
        'outside': 'Outside Dining',
        'provisions': 'Snacks & Provisions'
      };
      const targetName = catNameMap[category] || 'Food Court';
      const cRes = await db.query("SELECT id FROM categories WHERE name = $1 LIMIT 1", [targetName]);
      finalCatId = cRes.rows[0]?.id || null;
    }

    const result = await db.query(
      `UPDATE food_vendors SET
         name = COALESCE($1, name),
         location = COALESCE($2, location),
         category_id = COALESCE($3, category_id),
         icon_key = COALESCE($4, icon_key)
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [name ? name.trim() : null, location !== undefined ? location : null, finalCatId, icon_key, vendorId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Food spot not found.' } });
    }

    return res.json({ message: 'Food spot updated.', vendor: result.rows[0] });
  } catch (err) {
    console.error('Error updating vendor:', err);
    return res.status(500).json({ error: { message: 'Failed to update food spot.' } });
  }
});

// ── DELETE /api/menus/vendors/:id ───────────────────────────────────────────
router.delete('/vendors/:id', async (req, res) => {
  const vendorId = parseInt(req.params.id, 10);
  try {
    const result = await db.query('DELETE FROM food_vendors WHERE id = $1 AND user_id = $2 RETURNING *', [vendorId, req.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Food spot not found.' } });
    }
    return res.json({ message: 'Food spot and its menu deleted.' });
  } catch (err) {
    console.error('Error deleting vendor:', err);
    return res.status(500).json({ error: { message: 'Failed to delete food spot.' } });
  }
});

// ── GET /api/menus/items ────────────────────────────────────────────────────
router.get('/items', async (req, res) => {
  const { vendor_id, vendor_ids, meal_type, category, search, price_tier, limit, offset } = req.query;

  try {
    let whereClause = ' WHERE (m.user_id = $1 OR m.user_id IS NULL)';
    const baseParams = [req.userId];

    if (vendor_id) {
      baseParams.push(parseInt(vendor_id, 10));
      whereClause += ` AND m.vendor_id = $${baseParams.length}`;
    } else if (vendor_ids) {
      const parsedIds = vendor_ids
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id));
      if (parsedIds.length > 0) {
        baseParams.push(parsedIds);
        whereClause += ` AND m.vendor_id = ANY($${baseParams.length}::int[])`;
      }
    }

    if (meal_type && meal_type !== 'all') {
      baseParams.push(meal_type);
      whereClause += ` AND m.meal_type = $${baseParams.length}`;
    }

    if (search && search.trim()) {
      baseParams.push(`%${search.trim().toLowerCase()}%`);
      whereClause += ` AND (LOWER(m.name) LIKE $${baseParams.length} OR LOWER(COALESCE(v.name, '')) LIKE $${baseParams.length})`;
    }

    if (price_tier && price_tier !== 'all') {
      if (price_tier === 'provisions') {
        whereClause += ' AND (m.is_provisions = true OR m.price = 0)';
      } else if (price_tier === 'under_2k') {
        whereClause += ' AND m.price > 0 AND m.price <= 200000';
      } else if (price_tier === '2k_to_4k') {
        whereClause += ' AND m.price > 200000 AND m.price <= 400000';
      } else if (price_tier === 'above_4k') {
        whereClause += ' AND m.price > 400000';
      }
    }

    // Category counts across current vendor/hub/search/price filters (before specific category filter)
    const catCountQuery = `
      SELECT COALESCE(m.category, 'Specialties & Others') as category, COUNT(*)::int as count
      FROM menu_items m
      LEFT JOIN food_vendors v ON m.vendor_id = v.id
      ${whereClause}
      GROUP BY COALESCE(m.category, 'Specialties & Others')
    `;
    const catCountResult = await db.query(catCountQuery, baseParams);
    const category_counts = {};
    for (const row of catCountResult.rows) {
      category_counts[row.category] = row.count;
    }

    // Now apply category filter if specified
    if (category && category !== 'all') {
      baseParams.push(category);
      whereClause += ` AND m.category = $${baseParams.length}`;
    }

    // Total count for current filtered query
    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM menu_items m
      LEFT JOIN food_vendors v ON m.vendor_id = v.id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, baseParams);
    const total = countResult.rows[0]?.total || 0;

    // Items query with pagination
    let dataQuery = `
      SELECT m.*, v.name as vendor_name, v.location as vendor_location, v.icon_key as vendor_icon,
             c.name as category_name, c.id as category_id
      FROM menu_items m
      LEFT JOIN food_vendors v ON m.vendor_id = v.id
      LEFT JOIN categories c ON v.category_id = c.id
      ${whereClause}
      ORDER BY m.is_provisions ASC, m.price ASC, m.name ASC
    `;

    const isPaginated = limit !== undefined && limit !== 'all';
    const numLimit = isPaginated ? Math.min(100, Math.max(1, parseInt(limit, 10) || 24)) : null;
    const numOffset = isPaginated ? Math.max(0, parseInt(offset, 10) || 0) : 0;

    const dataParams = [...baseParams];
    if (isPaginated) {
      dataParams.push(numLimit);
      dataQuery += ` LIMIT $${dataParams.length}`;
      dataParams.push(numOffset);
      dataQuery += ` OFFSET $${dataParams.length}`;
    }

    const result = await db.query(dataQuery, dataParams);

    // Attach smarter cheaper option suggestions across competing spots
    const items = result.rows.map(row => {
      const numPrice = Number(row.price);
      return {
        ...row,
        price: numPrice,
        category: row.category || detectFoodCategory(row.name, row.is_provisions),
        cheaper_option: findCheaperOption({ ...row, price: numPrice }, result.rows),
      };
    });

    return res.json({
      items,
      pagination: {
        total,
        limit: numLimit ?? total,
        offset: numOffset,
        has_more: isPaginated ? (numOffset + items.length < total) : false,
        next_offset: isPaginated ? (numOffset + items.length) : total,
      },
      category_counts,
    });
  } catch (err) {
    console.error('Error fetching menu items:', err);
    return res.status(500).json({ error: { message: 'Failed to load menu items.' } });
  }
});

// ── Gemini Multimodal Vision Parser Helper ─────────────────────────────────
async function parseMenuWithGeminiVision(base64Data, mimeType = 'image/jpeg') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in backend .env');
  }

  const prompt = `You are an expert OCR and menu parsing assistant for Nigerian university food spots, cafeterias, and restaurants.
Analyze this menu photo, board, or flyer carefully.

Extract:
1. "restaurant_name": The detected name of the restaurant/eatery/spot (e.g. "Cherry African Kitchen", "Zulkys Cafe", "Street Food", "Pizza 360", etc.) or null if not found.
2. "items": An array of every food dish, swallow, protein, drink, pastry, or snack found on the menu.
   For each item:
   - "name": Clean, formatted name of the dish (e.g. "Jollof Rice / Fried Rice", "White Rice & Beans with Sauce", "Kunu Aya")
   - "price": Integer price in Nigerian Naira (e.g. 1500 for ₦1,500, 3500 for ₦3,500, 800 for ₦800). If no price is stated or it is free/stash, return 0.
   - "meal_type": One of "breakfast", "lunch", "dinner", "snack" based on typical eating time.
   - "category": One of "Rice Dishes", "Pasta & Noodles", "Burgers & Sandwiches", "Shawarma & Wraps", "Wings & Proteins", "Extras & Sides", "Drinks & Refreshers", "Pastries & Snacks", "Specialties & Others"

Return strictly valid JSON:
{
  "restaurant_name": string | null,
  "items": [
    {
      "name": string,
      "price": number,
      "meal_type": string,
      "category": string
    }
  ]
}`;

  const models = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-3.5-flash'
  ];

  let lastError = null;
  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType || 'image/jpeg',
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      });

      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        const text = data.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(text);
        return { ...parsed, model_used: model };
      }

      if (data.error) {
        console.warn(`[AI Vision] Model ${model} returned:`, data.error.code, data.error.message?.slice(0, 80));
        lastError = new Error(data.error.message || `API error (${data.error.code})`);
      }
    } catch (err) {
      console.warn(`[AI Vision] Error calling ${model}:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('All vision models were temporarily busy. Please try again.');
}

// ── POST /api/menus/ai-scan (Gemini Multimodal Vision OCR) ─────────────────
router.post('/ai-scan', async (req, res) => {
  const { image, mimeType } = req.body;
  if (!image) {
    return res.status(400).json({ error: { message: 'Image data is required.' } });
  }

  try {
    let cleanBase64 = image;
    let finalMime = mimeType || 'image/jpeg';

    if (image.startsWith('data:')) {
      const match = image.match(/^data:([a-zA-Z0-9/+-]+);base64,(.+)$/);
      if (match) {
        finalMime = match[1];
        cleanBase64 = match[2];
      } else {
        const commaIdx = image.indexOf(',');
        if (commaIdx !== -1) {
          cleanBase64 = image.slice(commaIdx + 1);
        }
      }
    }

    const aiResult = await parseMenuWithGeminiVision(cleanBase64, finalMime);
    const rawItems = Array.isArray(aiResult.items) ? aiResult.items : [];

    // Parse and normalize items into minor units (kobo)
    const normalizedItems = rawItems.map((item, idx) => {
      let rawPrice = item.price;
      if (typeof rawPrice === 'string') {
        rawPrice = parseInt(rawPrice.replace(/[^0-9]/g, ''), 10) || 0;
      }
      const numPriceNaira = Math.max(0, parseInt(rawPrice, 10) || 0);
      const minorPrice = numPriceNaira * 100; // Store in Kobo
      const isProv = minorPrice === 0;

      return {
        id: `ai_${Date.now()}_${idx}`,
        name: (item.name || '').trim(),
        price: minorPrice,
        meal_type: ['breakfast', 'lunch', 'dinner', 'snack', 'any'].includes(item.meal_type) ? item.meal_type : 'lunch',
        is_provisions: isProv,
        category: item.category || detectFoodCategory(item.name, isProv),
      };
    }).filter(i => i.name.length > 0);

    // Attempt to match restaurant name to an existing food vendor
    let matchedVendor = null;
    const detectedName = (aiResult.restaurant_name || '').trim();

    if (detectedName) {
      const vRes = await db.query(
        `SELECT id, name, location FROM food_vendors
         WHERE (user_id = $1 OR user_id IS NULL)
           AND (LOWER(name) LIKE $2 OR LOWER($3) LIKE '%' || LOWER(name) || '%')
         LIMIT 1`,
        [req.userId, `%${detectedName.toLowerCase()}%`, detectedName]
      );
      if (vRes.rows.length > 0) {
        matchedVendor = vRes.rows[0];
      }
    }

    return res.json({
      success: true,
      restaurant_name: detectedName || null,
      matched_vendor_id: matchedVendor ? matchedVendor.id : null,
      matched_vendor_name: matchedVendor ? matchedVendor.name : null,
      is_existing_vendor: !!matchedVendor,
      items: normalizedItems,
      total_items: normalizedItems.length,
      model_used: aiResult.model_used,
    });
  } catch (err) {
    console.error('Error in AI menu scan:', err);
    return res.status(500).json({
      error: {
        message: err.message || 'Failed to scan menu with Gemini Vision. Please try again or use the paste tab.',
      }
    });
  }
});

// ── POST /api/menus/items (Single or Batch for OCR results) ──────────────────
router.post('/items', async (req, res) => {
  try {
    const { items, name, price, vendor_id, meal_type, is_provisions, currency, category, stock_quantity, unit } = req.body;

    // Handle batch items (e.g., from OCR extract)
    if (Array.isArray(items) && items.length > 0) {
      const processed = [];
      let updatedCount = 0;
      let insertedCount = 0;

      for (const item of items) {
        if (!item.name || !item.name.trim()) continue;
        const itemName = item.name.trim();
        const numPrice = Math.max(0, parseInt(item.price, 10) || 0);
        const isProv = Boolean(item.is_provisions || numPrice === 0);
        const finalCat = item.category || detectFoodCategory(itemName, isProv);
        const stockQty = Math.max(0, parseInt(item.stock_quantity, 10) || 0);
        const finalVendorId = item.vendor_id ? parseInt(item.vendor_id, 10) : (vendor_id ? parseInt(vendor_id, 10) : null);

        // Check for existing dish under same vendor to prevent duplicates
        if (finalVendorId) {
          const existingRes = await db.query(
            `SELECT id FROM menu_items
             WHERE vendor_id = $1 AND LOWER(TRIM(name)) = LOWER($2) AND (user_id = $3 OR user_id IS NULL)
             LIMIT 1`,
            [finalVendorId, itemName, req.userId]
          );

          if (existingRes.rows.length > 0) {
            // Update existing dish price, category & meal type
            const existingId = existingRes.rows[0].id;
            const upRes = await db.query(
              `UPDATE menu_items SET
                 price = $1,
                 category = COALESCE($2, category),
                 meal_type = COALESCE($3, meal_type)
               WHERE id = $4
               RETURNING *`,
              [numPrice, finalCat, item.meal_type || 'lunch', existingId]
            );
            processed.push(upRes.rows[0]);
            updatedCount++;
            continue;
          }
        }

        // Otherwise insert as new item
        const insRes = await db.query(
          `INSERT INTO menu_items (user_id, vendor_id, name, price, currency, meal_type, is_provisions, category, stock_quantity, unit)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            req.userId,
            finalVendorId,
            itemName,
            numPrice,
            item.currency || 'NGN',
            item.meal_type || 'lunch',
            isProv,
            finalCat,
            stockQty,
            item.unit || 'items',
          ]
        );
        processed.push(insRes.rows[0]);
        insertedCount++;
      }

      const msg = updatedCount > 0 && insertedCount > 0
        ? `Updated ${updatedCount} existing dishes and added ${insertedCount} new items!`
        : updatedCount > 0
          ? `Updated prices for ${updatedCount} existing dishes!`
          : `${processed.length} menu items saved successfully!`;

      return res.status(201).json({
        message: msg,
        items: processed,
        updated_count: updatedCount,
        inserted_count: insertedCount,
      });
    }

    // Single item creation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: { message: 'Dish or item name is required.' } });
    }

    const numPrice = Math.max(0, parseInt(price, 10) || 0);
    const isProv = Boolean(is_provisions || numPrice === 0);
    const finalCat = category || detectFoodCategory(name.trim(), isProv);
    const stockQty = Math.max(0, parseInt(stock_quantity, 10) || (isProv ? 1 : 0));
    const insRes = await db.query(
      `INSERT INTO menu_items (user_id, vendor_id, name, price, currency, meal_type, is_provisions, category, stock_quantity, unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.userId,
        vendor_id ? parseInt(vendor_id, 10) : null,
        name.trim(),
        numPrice,
        currency || 'NGN',
        meal_type || 'lunch',
        isProv,
        finalCat,
        stockQty,
        unit || 'items',
      ]
    );

    return res.status(201).json({
      message: 'Menu item added successfully!',
      item: insRes.rows[0],
    });
  } catch (err) {
    console.error('Error creating menu item:', err);
    return res.status(500).json({ error: { message: 'Failed to add menu item.' } });
  }
});

// ── PUT /api/menus/items/:id ────────────────────────────────────────────────
router.put('/items/:id', async (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  const { name, price, vendor_id, meal_type, is_provisions, category, stock_quantity, unit } = req.body;

  try {
    const numPrice = price !== undefined ? Math.max(0, parseInt(price, 10)) : null;
    const isProv = is_provisions !== undefined ? Boolean(is_provisions) : null;
    const finalCat = category !== undefined ? category : (name ? detectFoodCategory(name, Boolean(is_provisions)) : null);
    const stockQty = stock_quantity !== undefined ? Math.max(0, parseInt(stock_quantity, 10)) : null;

    const result = await db.query(
      `UPDATE menu_items SET
         name = COALESCE($1, name),
         price = COALESCE($2, price),
         vendor_id = COALESCE($3, vendor_id),
         meal_type = COALESCE($4, meal_type),
         is_provisions = COALESCE($5, is_provisions),
         category = COALESCE($6, category),
         stock_quantity = COALESCE($7, stock_quantity),
         unit = COALESCE($8, unit)
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [
        name ? name.trim() : null,
        numPrice,
        vendor_id !== undefined ? vendor_id : null,
        meal_type || null,
        isProv,
        finalCat,
        stockQty,
        unit !== undefined ? unit : null,
        itemId,
        req.userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Menu item not found.' } });
    }

    // Automatically update estimates on any active meal plans linked to this item
    if (numPrice !== null) {
      await db.query(
        'UPDATE meal_plans SET estimated_price = $1 WHERE menu_item_id = $2 AND is_logged = false AND user_id = $3',
        [numPrice, itemId, req.userId]
      );
    }

    return res.json({ message: 'Menu item updated.', item: result.rows[0] });
  } catch (err) {
    console.error('Error updating menu item:', err);
    return res.status(500).json({ error: { message: 'Failed to update menu item.' } });
  }
});

// ── POST /api/menus/items/:id/adjust-stock ──────────────────────────────────
router.post('/items/:id/adjust-stock', async (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  const { delta, quantity } = req.body;

  try {
    let result;
    if (quantity !== undefined) {
      const q = Math.max(0, parseInt(quantity, 10) || 0);
      result = await db.query(
        'UPDATE menu_items SET stock_quantity = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
        [q, itemId, req.userId]
      );
    } else if (delta !== undefined) {
      const d = parseInt(delta, 10) || 0;
      result = await db.query(
        'UPDATE menu_items SET stock_quantity = GREATEST(0, stock_quantity + $1) WHERE id = $2 AND user_id = $3 RETURNING *',
        [d, itemId, req.userId]
      );
    } else {
      return res.status(400).json({ error: { message: 'Must provide delta or quantity.' } });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Item not found.' } });
    }

    return res.json({
      message: 'Stock updated.',
      item: result.rows[0],
    });
  } catch (err) {
    console.error('Error adjusting stock:', err);
    return res.status(500).json({ error: { message: 'Failed to adjust stock.' } });
  }
});

// ── DELETE /api/menus/items/:id ─────────────────────────────────────────────
router.delete('/items/:id', async (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  try {
    const result = await db.query('DELETE FROM menu_items WHERE id = $1 AND user_id = $2 RETURNING *', [itemId, req.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Menu item not found.' } });
    }
    return res.json({ message: 'Menu item deleted.' });
  } catch (err) {
    console.error('Error deleting menu item:', err);
    return res.status(500).json({ error: { message: 'Failed to delete menu item.' } });
  }
});

// ── POST /api/menus/items/:id/log-expense (Smart 1-Tap Log) ─────────────────
router.post('/items/:id/log-expense', async (req, res) => {
  const itemId = parseInt(req.params.id, 10);

  try {
    const itemRes = await db.query(
      `SELECT m.*, v.name as vendor_name, v.category_id
       FROM menu_items m
       LEFT JOIN food_vendors v ON m.vendor_id = v.id
       WHERE m.id = $1 AND (m.user_id = $2 OR m.user_id IS NULL)`,
      [itemId, req.userId]
    );

    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Menu item not found.' } });
    }

    const item = itemRes.rows[0];
    const amount = Number(item.price);

    // If ₦0 provisions meal
    if (amount === 0 || item.is_provisions) {
      // 1. Decrement stock in menu_items
      await db.query(
        'UPDATE menu_items SET stock_quantity = GREATEST(0, stock_quantity - 1) WHERE id = $1',
        [itemId]
      );

      // Dynamic benchmark savings based on spending history & live menu prices
      const benchmark = await getDynamicMealBenchmark(req.userId);
      const savedFormatted = formatMoney(benchmark, 'NGN', false);

      // 2. Insert into stash_logs to record money saved
      await db.query(
        `INSERT INTO stash_logs (user_id, menu_item_id, item_name, quantity, estimated_savings)
         VALUES ($1, $2, $3, 1, $4)`,
        [req.userId, itemId, item.name, benchmark]
      );

      const updated = await db.query('SELECT stock_quantity, unit FROM menu_items WHERE id = $1', [itemId]);
      const remaining = updated.rows[0]?.stock_quantity ?? 0;
      const unit = updated.rows[0]?.unit || 'items';

      return res.json({
        message: `Ate ${item.name} from room stash (₦0 spent)! Saved ~${savedFormatted} vs campus dining. (${remaining} ${unit} left in stock)`,
        is_free: true,
        saved_amount: benchmark,
        remaining_stock: remaining,
      });
    }

    // Determine category: vendor category, or fallback to Food Court
    let catId = item.category_id;
    if (!catId) {
      const defaultCat = await db.query("SELECT id FROM categories WHERE name = 'Food Court' LIMIT 1");
      catId = defaultCat.rows[0]?.id || null;
    }

    // Format natural vendor note: "Jollof Rice from Paprimz"
    const note = item.vendor_name ? `${item.name} from ${item.vendor_name}` : item.name;

    // Detect source group: food_court or outside_order
    let sourceGroup = 'food_court';
    if (item.category_name && item.category_name.toLowerCase().includes('outside')) {
      sourceGroup = 'outside_order';
    }

    const txRes = await db.query(
      `INSERT INTO transactions (user_id, type, amount, currency, converted_amount, category_id, source_group, note, occurred_at)
       VALUES ($1, 'expense', $2, $3, $2, $4, $5, $6, CURRENT_TIMESTAMP)
       RETURNING *`,
      [req.userId, amount, item.currency || 'NGN', catId, sourceGroup, note]
    );

    return res.status(201).json({
      message: `Logged ₦${(amount / 100).toLocaleString()} for ${note}!`,
      transaction: txRes.rows[0],
    });
  } catch (err) {
    console.error('Error logging menu expense:', err);
    return res.status(500).json({ error: { message: 'Failed to log food expense.' } });
  }
});

// ── POST /api/menus/provisions/restock (Record shopping expense & update stock) ──
router.post('/provisions/restock', async (req, res) => {
  const { amount, currency, note, occurred_at, stock_updates, new_items } = req.body;

  const numAmount = Math.max(0, parseInt(amount, 10) || 0);
  if (numAmount <= 0) {
    return res.status(400).json({ error: { message: 'Valid restock expense amount is required.' } });
  }

  try {
    // 1. Find provisions category (id 15 or 1)
    const catRes = await db.query("SELECT id FROM categories WHERE name IN ('Snacks & Provisions', 'Food & Groceries') ORDER BY id = 15 DESC LIMIT 1");
    const catId = catRes.rows[0]?.id || 15;

    // 2. Insert expense transaction
    const txNote = note && note.trim() ? note.trim() : 'Hostel Provisions Restock';
    const txDate = occurred_at ? new Date(occurred_at) : new Date();

    const txRes = await db.query(
      `INSERT INTO transactions (user_id, type, amount, currency, converted_amount, category_id, source_group, note, occurred_at)
       VALUES ($1, 'expense', $2, $3, $2, $4, 'provisions_restock', $5, $6)
       RETURNING *`,
      [req.userId, numAmount, currency || 'NGN', catId, txNote, txDate]
    );

    // 3. Update existing stock counts if requested
    if (Array.isArray(stock_updates)) {
      for (const update of stock_updates) {
        if (!update.item_id || !update.add_quantity) continue;
        const addQty = parseInt(update.add_quantity, 10) || 0;
        if (addQty > 0) {
          await db.query(
            'UPDATE menu_items SET stock_quantity = stock_quantity + $1 WHERE id = $2 AND user_id = $3',
            [addQty, update.item_id, req.userId]
          );
        }
      }
    }

    // 4. Insert any new items created during this trip
    if (Array.isArray(new_items)) {
      // Find or get provisions vendor id
      const provVendor = await db.query(
        "SELECT id FROM food_vendors WHERE (user_id = $1 OR user_id IS NULL) AND (LOWER(name) LIKE '%provision%' OR LOWER(name) LIKE '%stash%') LIMIT 1",
        [req.userId]
      );
      const vId = provVendor.rows[0]?.id || null;

      for (const ni of new_items) {
        if (!ni.name || !ni.name.trim()) continue;
        const initQty = Math.max(1, parseInt(ni.quantity, 10) || 1);
        await db.query(
          `INSERT INTO menu_items (user_id, vendor_id, name, price, currency, meal_type, is_provisions, category, stock_quantity, unit)
           VALUES ($1, $2, $3, 0, 'NGN', $4, true, 'Provisions & Stash', $5, $6)`,
          [req.userId, vId, ni.name.trim(), ni.meal_type || 'snack', initQty, ni.unit || 'items']
        );
      }
    }

    return res.status(201).json({
      message: `Recorded ₦${(numAmount / 100).toLocaleString()} provisions expense & updated room stock!`,
      transaction: txRes.rows[0],
    });
  } catch (err) {
    console.error('Error recording provisions restock:', err);
    return res.status(500).json({ error: { message: 'Failed to record restock expense.' } });
  }
});

// ── GET /api/menus/provisions/summary ───────────────────────────────────────
router.get('/provisions/summary', async (req, res) => {
  try {
    // 1. Total stash items & low stock items
    const itemsRes = await db.query(
      `SELECT id, name, stock_quantity, unit, meal_type, created_at
       FROM menu_items
       WHERE user_id = $1 AND is_provisions = true
       ORDER BY name ASC`,
      [req.userId]
    );

    const items = itemsRes.rows;
    const totalItemsCount = items.length;
    const totalUnitsInStock = items.reduce((sum, it) => sum + (it.stock_quantity || 0), 0);
    const lowStockItems = items.filter(it => (it.stock_quantity || 0) > 0 && (it.stock_quantity || 0) <= 2);
    const outOfStockItems = items.filter(it => (it.stock_quantity || 0) === 0);

    // 2. Savings from stash logs
    const savingsRes = await db.query(
      `SELECT COUNT(*) as meals_eaten,
              COALESCE(SUM(estimated_savings), 0) as total_savings_minor,
              COALESCE(SUM(CASE WHEN consumed_at >= date_trunc('month', CURRENT_TIMESTAMP) THEN estimated_savings ELSE 0 END), 0) as month_savings_minor,
              COALESCE(SUM(CASE WHEN consumed_at >= date_trunc('week', CURRENT_TIMESTAMP) THEN estimated_savings ELSE 0 END), 0) as week_savings_minor
       FROM stash_logs
       WHERE user_id = $1`,
      [req.userId]
    );

    const savings = savingsRes.rows[0] || {
      meals_eaten: 0,
      total_savings_minor: 0,
      month_savings_minor: 0,
      week_savings_minor: 0,
    };

    // 3. Recent restock transactions
    const restocksRes = await db.query(
      `SELECT id, amount, note, occurred_at, currency
       FROM transactions
       WHERE user_id = $1 AND (source_group = 'provisions_restock' OR category_id = 15)
       ORDER BY occurred_at DESC
       LIMIT 5`,
      [req.userId]
    );

    // 4. Recent consumption logs
    const recentLogsRes = await db.query(
      `SELECT id, item_name, quantity, estimated_savings, consumed_at
       FROM stash_logs
       WHERE user_id = $1
       ORDER BY consumed_at DESC
       LIMIT 10`,
      [req.userId]
    );

    const benchmark = await getDynamicMealBenchmark(req.userId);

    return res.json({
      items,
      total_items_count: totalItemsCount,
      total_units_in_stock: totalUnitsInStock,
      low_stock_count: lowStockItems.length,
      out_of_stock_count: outOfStockItems.length,
      total_savings_minor: Number(savings.total_savings_minor),
      month_savings_minor: Number(savings.month_savings_minor),
      week_savings_minor: Number(savings.week_savings_minor),
      meals_eaten: Number(savings.meals_eaten),
      benchmark_per_meal: benchmark,
      recent_restocks: restocksRes.rows,
      recent_logs: recentLogsRes.rows,
    });
  } catch (err) {
    console.error('Error fetching provisions summary:', err);
    return res.status(500).json({ error: { message: 'Failed to load provisions summary.' } });
  }
});

const formatDateStr = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ── GET /api/menus/meal-plans ───────────────────────────────────────────────
router.get('/meal-plans', async (req, res) => {
  const { from, to } = req.query;

  try {
    const now = new Date();
    // Default to current week (Monday to Sunday)
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6);

    const fromDate = from || formatDateStr(startOfWeek);
    const toDate = to || formatDateStr(endOfWeek);

    const plansRes = await db.query(
      `SELECT p.id, p.user_id, to_char(p.plan_date, 'YYYY-MM-DD') as plan_date, p.meal_time, p.menu_item_id,
              p.custom_item_name, p.is_provisions_stash, p.estimated_price, p.is_logged, p.transaction_id, p.created_at,
              m.name as item_name, m.price as item_price, m.is_provisions,
              v.name as vendor_name, v.category_id, c.name as category_name
       FROM meal_plans p
       LEFT JOIN menu_items m ON p.menu_item_id = m.id
       LEFT JOIN food_vendors v ON m.vendor_id = v.id
       LEFT JOIN categories c ON v.category_id = c.id
       WHERE p.user_id = $1 AND p.plan_date >= $2 AND p.plan_date <= $3
       ORDER BY p.plan_date ASC,
                CASE p.meal_time
                  WHEN 'breakfast' THEN 1
                  WHEN 'lunch' THEN 2
                  WHEN 'dinner' THEN 3
                  WHEN 'snack' THEN 4
                  ELSE 5
                END ASC`,
      [req.userId, fromDate, toDate]
    );

    // Calculate weekly summary
    let totalEstimated = 0;
    let provisionsMealsCount = 0;
    let paidMealsCount = 0;

    plansRes.rows.forEach(p => {
      // If linked to a menu item, always use the live item price so changing a price updates estimates!
      const price = (p.menu_item_id && p.item_price !== null && p.item_price !== undefined)
        ? Number(p.item_price)
        : Number(p.estimated_price || 0);

      p.estimated_price = price;

      if (p.is_provisions_stash || price === 0) {
        provisionsMealsCount++;
      } else {
        paidMealsCount++;
        totalEstimated += price;
      }
    });

    return res.json({
      from: fromDate,
      to: toDate,
      summary: {
        total_estimated: totalEstimated,
        provisions_meals_count: provisionsMealsCount,
        paid_meals_count: paidMealsCount,
        total_meals: plansRes.rows.length,
      },
      plans: plansRes.rows,
    });
  } catch (err) {
    console.error('Error fetching meal plans:', err);
    return res.status(500).json({ error: { message: 'Failed to load meal plans.' } });
  }
});

// ── POST /api/menus/meal-plans ──────────────────────────────────────────────
router.post('/meal-plans', async (req, res) => {
  const { plan_date, meal_time, menu_item_id, custom_item_name, is_provisions_stash, estimated_price } = req.body;

  if (!plan_date || !meal_time) {
    return res.status(400).json({ error: { message: 'Plan date and meal time are required.' } });
  }

  try {
    let price = parseInt(estimated_price, 10) || 0;
    let name = custom_item_name ? custom_item_name.trim() : null;
    let isStash = Boolean(is_provisions_stash);

    if (menu_item_id) {
      const itemRes = await db.query('SELECT name, price, is_provisions FROM menu_items WHERE id = $1', [menu_item_id]);
      if (itemRes.rows.length > 0) {
        const item = itemRes.rows[0];
        if (!name) name = item.name;
        if (!price && !isStash) price = Number(item.price);
        if (item.is_provisions) isStash = true;
      }
    }

    if (isStash) price = 0;

    // Check if slot already exists for same date and meal_time
    const existing = await db.query(
      'SELECT id FROM meal_plans WHERE user_id = $1 AND plan_date = $2 AND meal_time = $3',
      [req.userId, plan_date, meal_time]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await db.query(
        `UPDATE meal_plans SET
           menu_item_id = $1,
           custom_item_name = $2,
           is_provisions_stash = $3,
           estimated_price = $4
         WHERE id = $5 AND user_id = $6
         RETURNING id, user_id, to_char(plan_date, 'YYYY-MM-DD') as plan_date, meal_time, menu_item_id, custom_item_name, is_provisions_stash, estimated_price, is_logged, transaction_id, created_at`,
        [menu_item_id || null, name, isStash, price, existing.rows[0].id, req.userId]
      );
    } else {
      result = await db.query(
        `INSERT INTO meal_plans (user_id, plan_date, meal_time, menu_item_id, custom_item_name, is_provisions_stash, estimated_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, user_id, to_char(plan_date, 'YYYY-MM-DD') as plan_date, meal_time, menu_item_id, custom_item_name, is_provisions_stash, estimated_price, is_logged, transaction_id, created_at`,
        [req.userId, plan_date, meal_time, menu_item_id || null, name, isStash, price]
      );
    }

    return res.status(201).json({
      message: 'Meal planned successfully!',
      plan: result.rows[0],
    });
  } catch (err) {
    console.error('Error planning meal:', err);
    return res.status(500).json({ error: { message: 'Failed to save meal plan.' } });
  }
});

// ── DELETE /api/menus/meal-plans/:id ────────────────────────────────────────
router.delete('/meal-plans/:id', async (req, res) => {
  const planId = parseInt(req.params.id, 10);
  try {
    const result = await db.query('DELETE FROM meal_plans WHERE id = $1 AND user_id = $2 RETURNING *', [planId, req.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Planned meal not found.' } });
    }
    return res.json({ message: 'Planned meal cleared.' });
  } catch (err) {
    console.error('Error deleting meal plan:', err);
    return res.status(500).json({ error: { message: 'Failed to clear planned meal.' } });
  }
});

// ── POST /api/menus/meal-plans/:id/log-expense ──────────────────────────────
router.post('/meal-plans/:id/log-expense', async (req, res) => {
  const planId = parseInt(req.params.id, 10);

  try {
    const planRes = await db.query(
      `SELECT p.*, m.name as item_name, m.price as item_price, m.vendor_id,
              v.name as vendor_name, v.category_id
       FROM meal_plans p
       LEFT JOIN menu_items m ON p.menu_item_id = m.id
       LEFT JOIN food_vendors v ON m.vendor_id = v.id
       WHERE p.id = $1 AND p.user_id = $2`,
      [planId, req.userId]
    );

    if (planRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Planned meal not found.' } });
    }

    const plan = planRes.rows[0];
    const amount = Number(plan.estimated_price || plan.item_price || 0);

    if (plan.is_provisions_stash || amount === 0) {
      await db.query('UPDATE meal_plans SET is_logged = true WHERE id = $1', [planId]);

      // If linked to a menu item, decrement its stock
      if (plan.menu_item_id) {
        await db.query(
          'UPDATE menu_items SET stock_quantity = GREATEST(0, stock_quantity - 1) WHERE id = $1',
          [plan.menu_item_id]
        );
      }

      // Dynamic benchmark savings
      const benchmark = await getDynamicMealBenchmark(req.userId);
      const savedFormatted = formatMoney(benchmark, 'NGN', false);

      // Log stash savings
      const dishName = plan.custom_item_name || plan.item_name || 'Room Stash Meal';
      await db.query(
        `INSERT INTO stash_logs (user_id, menu_item_id, item_name, quantity, estimated_savings)
         VALUES ($1, $2, $3, 1, $4)`,
        [req.userId, plan.menu_item_id || null, dishName, benchmark]
      );

      return res.json({
        message: `Marked ${dishName} as eaten from room stash (₦0 spent)! Saved ~${savedFormatted} vs campus dining.`,
        is_free: true,
        saved_amount: benchmark,
      });
    }

    let catId = plan.category_id;
    if (!catId) {
      const isOutsideOrTreat = plan.meal_time === 'treat' || (plan.custom_item_name && /online|delivery|chowdeck|glovo|outside/i.test(plan.custom_item_name));
      const targetCatName = isOutsideOrTreat ? 'Outside Dining' : 'Food Court';
      const defaultCat = await db.query("SELECT id FROM categories WHERE name = $1 LIMIT 1", [targetCatName]);
      catId = defaultCat.rows[0]?.id || null;
      if (!catId) {
        const fallbackCat = await db.query("SELECT id FROM categories WHERE name = 'Food Court' LIMIT 1");
        catId = fallbackCat.rows[0]?.id || null;
      }
    }

    const dishName = plan.custom_item_name || plan.item_name || 'Meal';
    const note = plan.vendor_name ? `${dishName} from ${plan.vendor_name}` : dishName;

    let sourceGroup = 'food_court';
    if (plan.meal_time === 'treat' || (plan.category_name && plan.category_name.toLowerCase().includes('outside')) || (plan.custom_item_name && /online|delivery|chowdeck|glovo|outside/i.test(plan.custom_item_name))) {
      sourceGroup = 'outside_order';
    }

    const txRes = await db.query(
      `INSERT INTO transactions (user_id, type, amount, currency, converted_amount, category_id, source_group, note, occurred_at)
       VALUES ($1, 'expense', $2, 'NGN', $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [req.userId, amount, catId, sourceGroup, note]
    );

    await db.query(
      'UPDATE meal_plans SET is_logged = true, transaction_id = $1 WHERE id = $2',
      [txRes.rows[0].id, planId]
    );

    return res.status(201).json({
      message: `Logged ₦${(amount / 100).toLocaleString()} for ${note}!`,
      transaction: txRes.rows[0],
    });
  } catch (err) {
    console.error('Error logging planned meal expense:', err);
    return res.status(500).json({ error: { message: 'Failed to log planned meal.' } });
  }
});

// ── Helper: Keyword extractor for anti-repetition variety ────────────────────
function getDishKeyword(name) {
  const keywords = [
    'jollof', 'fried rice', 'rice', 'shawarma', 'spaghetti', 'pasta', 'noodles',
    'burger', 'sandwich', 'hotdog', 'pancake', 'waffle', 'fries', 'chips',
    'swallow', 'amala', 'semo', 'pounded yam', 'beans', 'porridge', 'suya',
    'wings', 'smoothie', 'milkshake', 'slush', 'pie', 'doughnut', 'roll', 'sub',
    'yam', 'egg', 'plantain', 'bread', 'tea', 'salad', 'chicken', 'fish', 'beef', 'turkey'
  ];
  const lower = (name || '').toLowerCase();
  for (const k of keywords) {
    if (lower.includes(k)) return k;
  }
  return 'dish';
}

// ── Helper: Identify non-meal extras, condiments, drinks & single add-ons ───
function isNonMealExtra(item) {
  const name = (item.name || '').toLowerCase().trim();
  const cat = (item.category || item.category_name || '').toLowerCase().trim();

  // 1. Drinks & Refreshers are beverages, not standalone meals
  if (cat === 'drinks & refreshers') return true;

  // 2. Explicit extra/xtra prefixes or suffixes
  if (name.includes('extra ') || name.includes('xtra ') || name.includes('(extra)') || name.includes('(portion)')) {
    return true;
  }

  // 3. Condiments, sauces, dips, and toppings
  const condimentKeywords = [
    'ketchup', 'extra cheese', 'cheese slice', 'mayo', 'mayonnaise', 'chilli', 'chili',
    'syrup', 'salad cream', 'dressing', 'topping', 'dip', 'gravy'
  ];
  for (const c of condimentKeywords) {
    if (name.includes(c)) return true;
  }

  // Standalone sauces (unless combined with yam, plantain, pasta, rice, etc.)
  if (name.endsWith(' sauce') || name === 'kidney sauce' || name === 'egg sauce' || name === 'pepper sauce' || name === 'sausage sauce') {
    const isCombo = name.includes('yam') || name.includes('plantain') || name.includes('fries') || name.includes('chips') || name.includes('rice') || name.includes('pasta') || name.includes('noodles') || name.includes('masa');
    if (!isCombo) return true;
  }

  // 4. Single standalone protein add-ons, standalone eggs, coleslaw
  const singleAddons = [
    'beef', 'fish', 'sausage', 'pc of sausage', 'sausage finger',
    'boiled egg', 'fried egg', 'egg', 'eggs', 'kpomo', 'shaki', 'ponmo',
    'coleslaw', 'extra cheese', 'cheese'
  ];
  if (singleAddons.includes(name)) return true;
  if (name.startsWith('egg (') || name.includes('boiled or fried') || name === 'egg (x2)' || name === 'fried / boiled egg (x2)' || name === 'sausage (x2)') return true;

  // 5. Standalone drink names if not caught by category
  if (['water', 'bottled water', 'coke', 'fanta', 'sprite', 'mirinda', 'pepsi', 'teem', 'red bull', 'monster energy', 'predator energy'].includes(name)) {
    return true;
  }

  return false;
}

// ── GET /api/menus/smart-suggestions ────────────────────────────────────────
router.get('/smart-suggestions', async (req, res) => {
  const { target_date, meal_time, budget_limit } = req.query;

  try {
    const todayStr = formatDateStr(new Date());
    const planDate = target_date || todayStr;
    const mealBenchmark = await getDynamicMealBenchmark(req.userId);

    let maxBudgetMinor = parseInt(budget_limit, 10);
    if (!maxBudgetMinor || isNaN(maxBudgetMinor) || maxBudgetMinor <= 0) {
      const budgetRes = await db.query(
        'SELECT daily_limit, total_amount, start_date, end_date FROM budgets WHERE user_id = $1 AND is_active = true LIMIT 1',
        [req.userId]
      );
      if (budgetRes.rows.length > 0) {
        const b = budgetRes.rows[0];
        if (b.daily_limit && Number(b.daily_limit) > 0) {
          maxBudgetMinor = Number(b.daily_limit);
        } else if (b.total_amount && b.start_date && b.end_date) {
          const days = Math.max(1, Math.round((new Date(b.end_date) - new Date(b.start_date)) / (1000 * 60 * 60 * 24)));
          maxBudgetMinor = Math.round(Number(b.total_amount) / days);
        }
      }
      if (!maxBudgetMinor || maxBudgetMinor <= 0) {
        maxBudgetMinor = mealBenchmark * 2;
      }
    }

    // 1. Fetch user's recent meal history (past 7 days & surrounding plans)
    const recentPlansRes = await db.query(
      `SELECT p.plan_date, p.meal_time, p.menu_item_id, m.name as item_name, m.vendor_id
       FROM meal_plans p
       LEFT JOIN menu_items m ON p.menu_item_id = m.id
       WHERE p.user_id = $1
         AND p.plan_date >= ($2::date - interval '6 days')
         AND p.plan_date <= ($2::date + interval '2 days')
       ORDER BY p.plan_date DESC`,
      [req.userId, planDate]
    );

    const recentItemCounts = {};
    const recentKeywordDays = {};
    const recentVendorDays = {};

    recentPlansRes.rows.forEach(p => {
      if (p.menu_item_id) {
        recentItemCounts[p.menu_item_id] = (recentItemCounts[p.menu_item_id] || 0) + 1;
      }
      if (p.item_name) {
        const kw = getDishKeyword(p.item_name);
        if (!recentKeywordDays[kw]) recentKeywordDays[kw] = p.plan_date;
      }
      if (p.vendor_id) {
        if (!recentVendorDays[p.vendor_id]) recentVendorDays[p.vendor_id] = p.plan_date;
      }
    });

    // 2. Fetch all candidate dishes from active food spots
    const itemsRes = await db.query(
      `SELECT m.*, v.name as vendor_name, v.location as vendor_location, c.name as category_name
       FROM menu_items m
       JOIN food_vendors v ON m.vendor_id = v.id
       LEFT JOIN categories c ON v.category_id = c.id
       WHERE (m.user_id = $1 OR m.user_id IS NULL)
       ORDER BY m.price ASC`,
      [req.userId]
    );

    const allItems = itemsRes.rows;
    if (allItems.length === 0) {
      return res.json({ suggestions: [], plan_date: planDate });
    }

    // 3. Filter candidates by budget & score for variety + wise decisions (exempt non-meal extras, drinks & sides)
    const candidates = allItems.filter(item => {
      // Must not be a non-meal extra/side (ketchup, cheese, single protein toppings, drinks)
      if (isNonMealExtra(item)) return false;

      // Must fit budget (allow ₦0 provisions or within budget)
      if (maxBudgetMinor > 0 && Number(item.price) > maxBudgetMinor && !item.is_provisions) {
        return false;
      }
      return true;
    });

    const scored = candidates.map(item => {
      let score = 50;
      const kw = getDishKeyword(item.name);
      let reasons = [];

      // Check anti-repetition for exact dish
      const timesUsedRecently = recentItemCounts[item.id] || 0;
      if (timesUsedRecently > 0) {
        score -= (timesUsedRecently * 40);
      } else {
        score += 20; // Untapped fresh dish
      }

      // Check anti-repetition for food type / keyword
      if (recentKeywordDays[kw]) {
        score -= 25;
      } else {
        score += 30;
        reasons.push(`High Variety: You haven't eaten ${kw} in days`);
      }

      // Check vendor rotation
      if (recentVendorDays[item.vendor_id]) {
        score -= 15;
      } else {
        score += 25;
        reasons.push(`Spot Rotation: Fresh meal from ${item.vendor_name}`);
      }

      // Wise Decision: Budget value check
      const price = Number(item.price);
      if (item.is_provisions || price === 0) {
        score += 20;
        reasons.push('Hostel Stash: Zero cost meal to protect your savings');
      } else if (price <= mealBenchmark) {
        score += 15;
        reasons.push(`Great Value: Under your typical meal spend (${formatMoney(mealBenchmark, 'NGN', false)}), fits comfortably in your daily budget`);
      }

      // Wise Decision: Campus competition price advantage
      const compSavings = findCheaperOption(item, allItems);
      if (compSavings?.is_best_price) {
        score += 25;
        reasons.push('Campus Best Price: Top value deal in the food court');
      }

      // Slight random jitter for refreshing shuffles
      score += Math.random() * 12;

      const primaryReason = reasons[0] || `Wise Pick: Balanced, delicious choice from ${item.vendor_name}`;

      return {
        ...item,
        score,
        reason: primaryReason,
        keyword: kw,
      };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    // Return top diverse recommendations (ensuring different vendors among top 5)
    const uniqueVendorSuggestions = [];
    const seenVendors = new Set();

    for (const s of scored) {
      if (!seenVendors.has(s.vendor_id) || uniqueVendorSuggestions.length >= 3) {
        uniqueVendorSuggestions.push(s);
        seenVendors.add(s.vendor_id);
      }
      if (uniqueVendorSuggestions.length >= 6) break;
    }

    return res.json({
      plan_date: planDate,
      meal_time: meal_time || 'dinner',
      budget_limit: maxBudgetMinor,
      suggestions: uniqueVendorSuggestions,
    });
  } catch (err) {
    console.error('Error generating smart meal suggestions:', err);
    return res.status(500).json({ error: { message: 'Failed to generate meal suggestions.' } });
  }
});

// ── GET /api/menus/spoil-yourself ───────────────────────────────────────────
router.get('/spoil-yourself', async (req, res) => {
  try {
    const mealBenchmark = await getDynamicMealBenchmark(req.userId);
    let dailyLimit = 0;

    const budgetRes = await db.query(
      'SELECT daily_limit, total_amount, start_date, end_date FROM budgets WHERE user_id = $1 AND is_active = true LIMIT 1',
      [req.userId]
    );

    if (budgetRes.rows.length > 0) {
      const b = budgetRes.rows[0];
      if (b.daily_limit && Number(b.daily_limit) > 0) {
        dailyLimit = Number(b.daily_limit);
      } else if (b.total_amount && b.start_date && b.end_date) {
        const days = Math.max(1, Math.round((new Date(b.end_date) - new Date(b.start_date)) / (1000 * 60 * 60 * 24)));
        dailyLimit = Math.round(Number(b.total_amount) / days);
      }
    }
    if (!dailyLimit || dailyLimit <= 0) {
      dailyLimit = mealBenchmark * 3;
    }

    const todaySpendRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total_spent
       FROM transactions
       WHERE user_id = $1 AND type = 'expense' AND occurred_at::date = CURRENT_DATE`,
      [req.userId]
    );
    const todaySpent = Number(todaySpendRes.rows[0].total_spent || 0);
    const budgetCushion = Math.max(0, dailyLimit - todaySpent);
    const isBudgetSafe = (dailyLimit - todaySpent) >= 0;

    // Calculate weekly surplus for weekend indulgences
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
    const weekSpendRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total_spent
       FROM transactions
       WHERE user_id = $1 AND type = 'expense' AND occurred_at >= $2`,
      [req.userId, startOfWeek]
    );
    const weeklySpent = Number(weekSpendRes.rows[0].total_spent || 0);
    const weeklyLimit = dailyLimit * 7;
    const weeklyCushion = Math.max(0, weeklyLimit - weeklySpent);

    const treatsRes = await db.query(
      `SELECT m.*, v.name as vendor_name, v.location as vendor_location, c.name as category_name
       FROM menu_items m
       JOIN food_vendors v ON m.vendor_id = v.id
       LEFT JOIN categories c ON v.category_id = c.id
       WHERE (m.user_id = $1 OR m.user_id IS NULL)
         AND (
           LOWER(m.name) ~ '(loaded fries|wings|pizza|ramen|asian noodles|burger|ice cream|milkshake|slush|suya|grills|shawarma|ribs|fajita|platter|submarine|sub)'
           OR LOWER(v.name) LIKE '%pizza%'
           OR LOWER(COALESCE(c.name, '')) LIKE '%outside%'
         )
         AND m.price >= 100000
         AND NOT (LOWER(m.name) ~ '^(water|extra|xtra|ketchup|chilli|mayo|sauce|beef|fish|sausage|egg)$')
       ORDER BY m.price DESC`,
      [req.userId]
    );

    return res.json({
      budget_cushion: budgetCushion,
      weekly_cushion: weeklyCushion,
      daily_limit: dailyLimit,
      weekly_limit: weeklyLimit,
      today_spent: todaySpent,
      weekly_spent: weeklySpent,
      is_budget_safe: isBudgetSafe,
      treats: treatsRes.rows,
    });
  } catch (err) {
    console.error('Error loading spoil yourself treats:', err);
    return res.status(500).json({ error: { message: 'Failed to load treats.' } });
  }
});

// ── POST /api/menus/auto-plan-week ──────────────────────────────────────────
router.post('/auto-plan-week', async (req, res) => {
  const { start_date, budget_per_day } = req.body;

  try {
    const now = new Date();
    let startYear, startMonth, startDay;
    if (start_date) {
      const parts = start_date.split('-').map(Number);
      startYear = parts[0];
      startMonth = parts[1] - 1;
      startDay = parts[2];
    } else {
      const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
      const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      startYear = mon.getFullYear();
      startMonth = mon.getMonth();
      startDay = mon.getDate();
    }

    let maxBudgetPerDay = parseInt(budget_per_day, 10);
    const mealBenchmark = await getDynamicMealBenchmark(req.userId);
    if (!maxBudgetPerDay || isNaN(maxBudgetPerDay) || maxBudgetPerDay <= 0) {
      const budgetRes = await db.query(
        'SELECT daily_limit, total_amount, start_date, end_date FROM budgets WHERE user_id = $1 AND is_active = true LIMIT 1',
        [req.userId]
      );
      if (budgetRes.rows.length > 0) {
        const b = budgetRes.rows[0];
        if (b.daily_limit && Number(b.daily_limit) > 0) {
          maxBudgetPerDay = Number(b.daily_limit);
        } else if (b.total_amount && b.start_date && b.end_date) {
          const days = Math.max(1, Math.round((new Date(b.end_date) - new Date(b.start_date)) / (1000 * 60 * 60 * 24)));
          maxBudgetPerDay = Math.round(Number(b.total_amount) / days);
        }
      }
      if (!maxBudgetPerDay || maxBudgetPerDay <= 0) {
        maxBudgetPerDay = mealBenchmark * 3;
      }
    }

    // Fetch all candidate dishes
    const itemsRes = await db.query(
      `SELECT m.*, v.name as vendor_name, v.location as vendor_location
       FROM menu_items m
       JOIN food_vendors v ON m.vendor_id = v.id
       WHERE (m.user_id = $1 OR m.user_id IS NULL) AND (m.price <= $2 OR m.is_provisions = true)
       ORDER BY m.price ASC`,
      [req.userId, maxBudgetPerDay]
    );

    // Exempt non-meal extras, condiments, drinks, and single protein add-ons
    const allItems = itemsRes.rows.filter(item => !isNonMealExtra(item));
    if (allItems.length < 3) {
      return res.status(400).json({ error: { message: 'Not enough dishes in menus to generate a meal plan.' } });
    }

    const MEAL_SLOTS = [
      { key: 'breakfast', label: 'Meal 1', targetFraction: 0.25 },
      { key: 'lunch', label: 'Meal 2', targetFraction: 0.40 },
      { key: 'dinner', label: 'Evening Meal', targetFraction: 0.35 },
    ];

    const plannedWeek = [];
    const usedItemIds = new Set();
    const usedVendorsWeek = new Set();
    const usedKeywordsWeek = new Map();

    const weekStartDateStr = formatDateStr(new Date(startYear, startMonth, startDay));
    const weekEndDateStr = formatDateStr(new Date(startYear, startMonth, startDay + 6));

    // Pre-fetch all existing plans for the week in 1 single query instead of 21 roundtrips
    const existingPlansRes = await db.query(
      `SELECT id, is_logged, menu_item_id, custom_item_name, estimated_price, plan_date::text as plan_date, meal_time
       FROM meal_plans
       WHERE user_id = $1 AND plan_date >= $2 AND plan_date <= $3
       ORDER BY is_logged DESC, id ASC`,
      [req.userId, weekStartDateStr, weekEndDateStr]
    );

    const existingPlansMap = new Map();
    for (const row of existingPlansRes.rows) {
      const dateKey = row.plan_date.split('T')[0];
      const key = `${dateKey}_${row.meal_time}`;
      if (!existingPlansMap.has(key)) {
        existingPlansMap.set(key, []);
      }
      existingPlansMap.get(key).push(row);
    }

    // 7 days from Monday to Sunday
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startYear, startMonth, startDay + i);
      const dateStr = formatDateStr(dayDate);

      const usedItemIdsDay = new Set();
      const usedKeywordsDay = new Set();
      const usedVendorsDay = new Set();
      let dayPlannedSpend = 0;

      for (const slot of MEAL_SLOTS) {
        const mealTime = slot.key;
        const existingRows = existingPlansMap.get(`${dateStr}_${mealTime}`) || [];

        // If user already logged this meal, keep it intact!
        if (existingRows.length > 0 && existingRows[0].is_logged) {
          const logged = existingRows[0];
          dayPlannedSpend += Number(logged.estimated_price || 0);
          if (logged.menu_item_id) usedItemIds.add(logged.menu_item_id);
          plannedWeek.push({
            date: dateStr,
            item_name: logged.custom_item_name || 'Logged Meal',
            price: logged.estimated_price || 0,
            vendor_name: '',
            meal_time: mealTime,
            plan_id: logged.id,
            is_logged: true,
          });
          continue;
        }

        // Score candidates for this slot
        const remainingTodayBudget = Math.max(0, maxBudgetPerDay - dayPlannedSpend);
        const slotBudget = Math.max(mealBenchmark, Math.round(maxBudgetPerDay * slot.targetFraction));

        const candidates = allItems.map(item => {
          let score = 50;
          const kw = getDishKeyword(item.name);
          const mealType = item.meal_type || 'lunch';

          // 1. Meal Type Affinity
          if (slot.key === 'breakfast') {
            if (mealType === 'breakfast') score += 75;
            else if (mealType === 'snack') score += 30;
            else if (['egg', 'bread', 'pancake', 'waffle', 'tea', 'sandwich', 'plantain', 'yam', 'beans'].includes(kw)) score += 45;
            else score -= 35;
          } else if (slot.key === 'lunch') {
            if (mealType === 'lunch') score += 55;
            else if (mealType === 'dinner') score += 35;
            else if (mealType === 'breakfast') score -= 20;
            else if (mealType === 'snack') score += 10;
          } else if (slot.key === 'dinner') {
            if (mealType === 'dinner') score += 55;
            else if (mealType === 'lunch') score += 35;
            else if (mealType === 'breakfast') score -= 30;
            else if (mealType === 'snack') score += 15;
          }

          // 2. Intra-Day Anti-Repetition (Strict)
          if (usedItemIdsDay.has(item.id)) score -= 500;
          if (usedKeywordsDay.has(kw)) score -= 120;
          if (usedVendorsDay.has(item.vendor_id)) score -= 45;

          // 3. Weekly Variety
          if (usedItemIds.has(item.id)) score -= 85;
          const kwWeekCount = usedKeywordsWeek.get(kw) || 0;
          if (kwWeekCount > 0) score -= (kwWeekCount * 25);
          if (!usedVendorsWeek.has(item.vendor_id)) score += 30;

          // 4. Budget fit
          const price = Number(item.price || 0);
          if (price <= slotBudget) score += 20;
          if (remainingTodayBudget > 0 && price > remainingTodayBudget) {
            score -= Math.min(150, Math.round(((price - remainingTodayBudget) / 1000) * 1.5));
          }

          // 5. Jitter
          score += Math.random() * 14;

          return { item, score, kw };
        });

        candidates.sort((a, b) => b.score - a.score);
        const chosen = candidates[0].item;
        const chosenKw = candidates[0].kw;

        usedItemIdsDay.add(chosen.id);
        usedKeywordsDay.add(chosenKw);
        usedVendorsDay.add(chosen.vendor_id);

        usedItemIds.add(chosen.id);
        usedVendorsWeek.add(chosen.vendor_id);
        usedKeywordsWeek.set(chosenKw, (usedKeywordsWeek.get(chosenKw) || 0) + 1);
        dayPlannedSpend += Number(chosen.price || 0);

        let planRecord;
        if (existingRows.length > 0) {
          planRecord = await db.query(
            `UPDATE meal_plans SET
               menu_item_id = $1,
               custom_item_name = $2,
               is_provisions_stash = $3,
               estimated_price = $4
             WHERE id = $5 AND user_id = $6
             RETURNING *`,
            [chosen.id, chosen.name, chosen.is_provisions, chosen.price, existingRows[0].id, req.userId]
          );
          // Clean up any extra redundant unlogged records for this slot
          if (existingRows.length > 1) {
            const extraIds = existingRows.slice(1).filter(r => !r.is_logged).map(r => r.id);
            if (extraIds.length > 0) {
              await db.query(
                'DELETE FROM meal_plans WHERE id = ANY($1::int[]) AND user_id = $2',
                [extraIds, req.userId]
              );
            }
          }
        } else {
          planRecord = await db.query(
            `INSERT INTO meal_plans (user_id, plan_date, meal_time, menu_item_id, custom_item_name, is_provisions_stash, estimated_price)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [req.userId, dateStr, mealTime, chosen.id, chosen.name, chosen.is_provisions, chosen.price]
          );
        }

        plannedWeek.push({
          date: dateStr,
          item_name: chosen.name,
          price: chosen.price,
          vendor_name: chosen.vendor_name,
          meal_time: mealTime,
          plan_id: planRecord.rows[0].id,
        });
      }
    }

    return res.json({
      message: 'Generated a smart, variety-filled 7-day budget meal plan for all meals!',
      plans: plannedWeek,
    });
  } catch (err) {
    console.error('Error generating weekly meal plan:', err);
    return res.status(500).json({ error: { message: 'Failed to auto-plan week.' } });
  }
});

module.exports = router;

