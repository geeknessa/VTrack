const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

// Get User Settings
router.get('/', async (req, res) => {
  try {
    const settingsRes = await db.query('SELECT * FROM user_settings WHERE user_id = $1', [req.userId]);
    if (settingsRes.rows.length === 0) {
      // Create if missing
      const newSettings = await db.query(
        'INSERT INTO user_settings (user_id) VALUES ($1) RETURNING *',
        [req.userId]
      );
      return res.json({ settings: newSettings.rows[0] });
    }
    return res.json({ settings: settingsRes.rows[0] });
  } catch (err) {
    console.error('Get settings error:', err);
    return res.status(500).json({
      error: { message: 'Failed to retrieve settings.', action: 'retry' }
    });
  }
});

// Update User Settings
router.put('/', async (req, res) => {
  const {
    home_currency,
    period_type,
    period_anchor_date,
    expected_next_income_date,
    income_pattern,
    main_goal,
    savings_target,
    opening_balance,
    base_income,
    auto_sweep_leftovers,
    vault_goal,
    theme,
    accent,
    onboarding_completed,
    lifestyle_meal_plan,
    lifestyle_daily_meals,
    lifestyle_meal_cost,
    meal_plan_weekly_target,
    custom_period_from,
    custom_period_to,
  } = req.body;

  try {
    const updated = await db.query(
      `UPDATE user_settings SET
        home_currency = COALESCE($1, home_currency),
        period_type = COALESCE($2, period_type),
        period_anchor_date = CASE WHEN $22::boolean THEN $3 ELSE period_anchor_date END,
        expected_next_income_date = CASE WHEN $23::boolean THEN $4 ELSE expected_next_income_date END,
        income_pattern = COALESCE($5, income_pattern),
        main_goal = COALESCE($6, main_goal),
        savings_target = COALESCE($7, savings_target),
        opening_balance = COALESCE($8, opening_balance),
        theme = COALESCE($9, theme),
        accent = COALESCE($10, accent),
        onboarding_completed = COALESCE($11, onboarding_completed),
        base_income = COALESCE($13, base_income),
        auto_sweep_leftovers = COALESCE($14, auto_sweep_leftovers),
        lifestyle_meal_plan = COALESCE($15, lifestyle_meal_plan),
        lifestyle_daily_meals = COALESCE($16, lifestyle_daily_meals),
        lifestyle_meal_cost = COALESCE($17, lifestyle_meal_cost),
        vault_goal = CASE WHEN $18 IS NOT NULL THEN $18 ELSE vault_goal END,
        custom_period_from = CASE WHEN $24::boolean THEN $19 ELSE custom_period_from END,
        custom_period_to = CASE WHEN $25::boolean THEN $20 ELSE custom_period_to END,
        meal_plan_weekly_target = COALESCE($21, meal_plan_weekly_target),
        updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $12
       RETURNING *`,
      [
        home_currency,
        period_type,
        period_anchor_date !== undefined ? (period_anchor_date || null) : null,
        expected_next_income_date !== undefined ? (expected_next_income_date || null) : null,
        income_pattern || null,
        main_goal,
        savings_target !== undefined ? savings_target : null,
        opening_balance !== undefined ? opening_balance : null,
        theme,
        accent,
        onboarding_completed !== undefined ? onboarding_completed : null,
        req.userId,
        base_income !== undefined ? base_income : null,
        auto_sweep_leftovers !== undefined ? auto_sweep_leftovers : null,
        lifestyle_meal_plan !== undefined ? lifestyle_meal_plan : null,
        lifestyle_daily_meals !== undefined ? lifestyle_daily_meals : null,
        lifestyle_meal_cost !== undefined ? lifestyle_meal_cost : null,
        vault_goal !== undefined ? (vault_goal !== null ? Math.max(0, Math.round(Number(vault_goal))) : 0) : null,
        custom_period_from !== undefined ? (custom_period_from || null) : null,
        custom_period_to !== undefined ? (custom_period_to || null) : null,
        meal_plan_weekly_target !== undefined ? meal_plan_weekly_target : null,
        period_anchor_date !== undefined,
        expected_next_income_date !== undefined,
        custom_period_from !== undefined,
        custom_period_to !== undefined
      ]
    );

    return res.json({
      message: 'Settings saved successfully!',
      settings: updated.rows[0]
    });
  } catch (err) {
    console.error('Update settings error:', err);
    return res.status(500).json({
      error: { message: 'Failed to save settings. Please try again.', action: 'retry' }
    });
  }
});

module.exports = router;
