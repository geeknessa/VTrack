const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

function parseDateParam(str, isEnd = false) {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  if (isEnd && !str.includes('T')) {
    d.setHours(23, 59, 59, 999);
  }
  return d.toISOString();
}

// ── GET /api/insights ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const rawFrom = req.query.from;
    const rawTo = req.query.to;

    // Fetch user settings and active budget
    const [settingsRes, budgetRes] = await Promise.all([
      db.query('SELECT * FROM user_settings WHERE user_id = $1', [req.userId]),
      db.query('SELECT * FROM budgets WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1', [req.userId])
    ]);

    const settings = settingsRes.rows[0] || {};
    const activeBudget = budgetRes.rows[0] || null;

    // Resolve date window
    let fromIso = parseDateParam(rawFrom);
    let toIso = parseDateParam(rawTo, true);

    if (!fromIso && !toIso) {
      if (activeBudget) {
        fromIso = new Date(activeBudget.start_date).toISOString();
        toIso = new Date(new Date(activeBudget.end_date).setHours(23, 59, 59, 999)).toISOString();
      } else {
        const now = new Date();
        fromIso = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
        toIso = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
      }
    }

    // ── 1. Category Breakdown ──
    const catRes = await db.query(
      `SELECT 
         COALESCE(c.name, 'Other') as category_name,
         COALESCE(c.icon_key, 'tag') as icon_key,
         COALESCE(c.kind, 'wants') as kind,
         SUM(COALESCE(t.converted_amount, t.amount))::bigint as total,
         COUNT(t.id)::int as count
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 
         AND t.type = 'expense'
         AND t.source_group IS DISTINCT FROM 'piggybank'
         AND ($2::timestamptz IS NULL OR t.occurred_at >= $2::timestamptz)
         AND ($3::timestamptz IS NULL OR t.occurred_at <= $3::timestamptz)
       GROUP BY c.name, c.icon_key, c.kind
       ORDER BY total DESC`,
      [req.userId, fromIso, toIso]
    );

    const categories = catRes.rows;
    const totalSpent = categories.reduce((acc, c) => acc + Number(c.total), 0);

    const categoryList = categories.map((c) => ({
      category_name: c.category_name,
      icon_key: c.icon_key,
      kind: c.kind,
      total: Number(c.total),
      count: Number(c.count),
      percentage: totalSpent > 0 ? Math.round((Number(c.total) / totalSpent) * 100) : 0,
    }));

    // ── 2. Weekly Spending Bars ──
    let weeklyBars = [];
    if (fromIso && toIso) {
      const start = new Date(fromIso);
      const end = new Date(toIso);
      const durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

      const numBuckets = Math.min(6, Math.max(2, Math.ceil(durationDays / 7)));
      const bucketSizeMs = (end.getTime() - start.getTime()) / numBuckets;

      for (let i = 0; i < numBuckets; i++) {
        const bStart = new Date(start.getTime() + i * bucketSizeMs);
        const bEnd = new Date(Math.min(end.getTime(), start.getTime() + (i + 1) * bucketSizeMs - 1));

        const weekSum = await db.query(
          `SELECT COALESCE(SUM(COALESCE(converted_amount, amount)), 0)::bigint as total
           FROM transactions
           WHERE user_id = $1 
             AND type = 'expense'
             AND source_group IS DISTINCT FROM 'piggybank'
             AND occurred_at >= $2 AND occurred_at <= $3`,
          [req.userId, bStart.toISOString(), bEnd.toISOString()]
        );

        const startLabel = bStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endLabel = bEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        weeklyBars.push({
          week_label: `Wk ${i + 1}`,
          sub_label: `${startLabel} – ${endLabel}`,
          from: bStart.toISOString(),
          to: bEnd.toISOString(),
          total_spent: Number(weekSum.rows[0].total),
        });
      }
    } else {
      // All time: group past 5 calendar weeks
      const now = new Date();
      for (let i = 4; i >= 0; i--) {
        const bStart = new Date();
        bStart.setDate(now.getDate() - (i + 1) * 7);
        const bEnd = new Date();
        bEnd.setDate(now.getDate() - i * 7);

        const weekSum = await db.query(
          `SELECT COALESCE(SUM(COALESCE(converted_amount, amount)), 0)::bigint as total
           FROM transactions
           WHERE user_id = $1 
             AND type = 'expense'
             AND source_group IS DISTINCT FROM 'piggybank'
             AND occurred_at >= $2 AND occurred_at <= $3`,
          [req.userId, bStart.toISOString(), bEnd.toISOString()]
        );

        weeklyBars.push({
          week_label: i === 0 ? 'This Wk' : `${i}w ago`,
          sub_label: `${bStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${bEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          from: bStart.toISOString(),
          to: bEnd.toISOString(),
          total_spent: Number(weekSum.rows[0].total),
        });
      }
    }

    // ── 3. Cycle Comparison (This cycle vs Previous cycle) ──
    let cycleComparison = {
      has_comparison: false,
      current_cycle_spent: totalSpent,
      previous_cycle_spent: 0,
      diff_amount: 0,
      diff_percentage: 0,
      status: 'neutral',
      insight_text: 'Track more cycles to see your pace comparison!',
    };

    if (fromIso && toIso) {
      const start = new Date(fromIso);
      const end = new Date(toIso);
      const spanMs = end.getTime() - start.getTime();

      const prevStart = new Date(start.getTime() - spanMs);
      const prevEnd = new Date(start.getTime() - 1);

      const prevRes = await db.query(
        `SELECT COALESCE(SUM(COALESCE(converted_amount, amount)), 0)::bigint as total
         FROM transactions
         WHERE user_id = $1 
           AND type = 'expense'
           AND source_group IS DISTINCT FROM 'piggybank'
           AND occurred_at >= $2 AND occurred_at <= $3`,
        [req.userId, prevStart.toISOString(), prevEnd.toISOString()]
      );

      const prevTotal = Number(prevRes.rows[0].total);
      if (prevTotal > 0 || totalSpent > 0) {
        const diffAmount = totalSpent - prevTotal;
        const diffPct = prevTotal > 0 ? Math.round(((totalSpent - prevTotal) / prevTotal) * 100) : 100;
        const status = diffAmount < 0 ? 'spending_less' : (diffAmount > 0 ? 'spending_more' : 'equal');

        let insightText = '';
        if (status === 'spending_less') {
          insightText = `You're spending ${Math.abs(diffPct)}% less than the last cycle. Awesome discipline!`;
        } else if (status === 'spending_more') {
          insightText = `You're pacing ${Math.abs(diffPct)}% higher than the last cycle. Keep an eye on non-essentials.`;
        } else {
          insightText = 'Your spending pace is completely on par with the previous cycle.';
        }

        cycleComparison = {
          has_comparison: true,
          current_cycle_spent: totalSpent,
          previous_cycle_spent: prevTotal,
          diff_amount: diffAmount,
          diff_percentage: diffPct,
          status,
          insight_text: insightText,
        };
      }
    }

    // ── 4. Top Individual Purchases ──
    const topPurchasesRes = await db.query(
      `SELECT 
         t.id, 
         COALESCE(t.converted_amount, t.amount) as amount, 
         t.occurred_at, 
         t.note, 
         COALESCE(c.name, 'Expense') as category_name, 
         COALESCE(c.icon_key, 'tag') as icon_key
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 
         AND t.type = 'expense'
         AND t.source_group IS DISTINCT FROM 'piggybank'
         AND ($2::timestamptz IS NULL OR t.occurred_at >= $2::timestamptz)
         AND ($3::timestamptz IS NULL OR t.occurred_at <= $3::timestamptz)
       ORDER BY COALESCE(t.converted_amount, t.amount) DESC
       LIMIT 5`,
      [req.userId, fromIso, toIso]
    );

    const topPurchases = topPurchasesRes.rows.map(r => ({
      id: r.id,
      amount: Number(r.amount),
      occurred_at: r.occurred_at,
      date: r.occurred_at,
      note: r.note,
      category_name: r.category_name,
      icon_key: r.icon_key,
    }));

    // ── 5. Food & Eating Habits Breakdown (Food Court vs Outside Outings vs Provisions) ──
    // All 3 fall under eating: tracks where/how money was spent to guide meal planning
    const foodTxRes = await db.query(
      `SELECT 
         c.name as category_name,
         t.note,
         COALESCE(t.converted_amount, t.amount) as amount,
         t.occurred_at
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 
         AND t.type = 'expense'
         AND (
           c.name ILIKE '%food%' OR 
           c.name ILIKE '%cafeteria%' OR 
           c.name ILIKE '%outside dining%' OR 
           c.name ILIKE '%outing%' OR 
           c.name ILIKE '%hangout%' OR
           c.name ILIKE '%snack%' OR 
           c.name ILIKE '%provision%' OR 
           c.name ILIKE '%grocer%'
         )
         AND ($2::timestamptz IS NULL OR t.occurred_at >= $2::timestamptz)
         AND ($3::timestamptz IS NULL OR t.occurred_at <= $3::timestamptz)`,
      [req.userId, fromIso, toIso]
    );

    let foodCourtTotal = 0;
    let outsideDiningTotal = 0;
    let provisionsTotal = 0;

    foodTxRes.rows.forEach(r => {
      const name = (r.category_name || '').toLowerCase();
      const note = (r.note || '').toLowerCase();
      const amt = Number(r.amount);

      // 1. Food Court (campus cooked meals / cafeteria / canteen)
      if (name.includes('food court') || name.includes('cafeteria') || note.includes('cafeteria') || note.includes('canteen')) {
        foodCourtTotal += amt;
      }
      // 2. Outings / Outside Dining (fast food / takeout / restaurants / off-campus eating out)
      else if (name.includes('outside dining') || name.includes('outing') || name.includes('hangout') || note.includes('eat out') || note.includes('restaurant')) {
        outsideDiningTotal += amt;
      }
      // 3. Snacks & Provisions (hostel stash, cereal, snacks, drinks, biscuits)
      else if (name.includes('provision') || name.includes('snack') || note.includes('provision') || note.includes('cereal') || note.includes('chips')) {
        provisionsTotal += amt;
      }
      // 4. Default food meals (e.g. 'Food & Groceries' with notes like 'J RICE') -> defaults to campus Food Court / daily meal
      else {
        foodCourtTotal += amt;
      }
    });

    const totalFoodSpent = foodCourtTotal + outsideDiningTotal + provisionsTotal;
    const foodSplit = {
      total_food_spent: totalFoodSpent,
      food_court: {
        amount: foodCourtTotal,
        percentage: totalFoodSpent > 0 ? Math.round((foodCourtTotal / totalFoodSpent) * 100) : 0,
      },
      outside_dining: {
        amount: outsideDiningTotal,
        percentage: totalFoodSpent > 0 ? Math.round((outsideDiningTotal / totalFoodSpent) * 100) : 0,
      },
      provisions: {
        amount: provisionsTotal,
        percentage: totalFoodSpent > 0 ? Math.round((provisionsTotal / totalFoodSpent) * 100) : 0,
      },
    };

    // ── 6. Meal Plan Comparison & Zero-Spend Stash Days ──
    const now = new Date();
    // Monday of current week
    const dayOfWeek = now.getDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon, 0, 0, 0, 0);
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6, 23, 59, 59, 999);

    // This week's total food/eating spend
    const thisWeekFoodRes = await db.query(
      `SELECT COALESCE(SUM(COALESCE(t.converted_amount, t.amount)), 0)::bigint as total
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 
         AND t.type = 'expense'
         AND (
           c.name ILIKE '%food%' OR 
           c.name ILIKE '%cafeteria%' OR 
           c.name ILIKE '%outside dining%' OR 
           c.name ILIKE '%outing%' OR 
           c.name ILIKE '%hangout%' OR 
           c.name ILIKE '%snack%' OR 
           c.name ILIKE '%provision%' OR 
           c.name ILIKE '%grocer%'
         )
         AND t.occurred_at >= $2 AND t.occurred_at <= $3`,
      [req.userId, weekStart.toISOString(), weekEnd.toISOString()]
    );
    const thisWeekFoodSpent = Number(thisWeekFoodRes.rows[0].total);

    // Calculate zero-spend days in current week up to today
    const daysElapsed = Math.max(1, Math.floor((now.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    
    const dailyFoodSpendRes = await db.query(
      `SELECT DATE(t.occurred_at) as spend_date, SUM(COALESCE(t.converted_amount, t.amount))::bigint as daily_total
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 
         AND t.type = 'expense'
         AND (
           c.name ILIKE '%food%' OR 
           c.name ILIKE '%cafeteria%' OR 
           c.name ILIKE '%outside dining%' OR 
           c.name ILIKE '%outing%' OR 
           c.name ILIKE '%hangout%' OR 
           c.name ILIKE '%snack%' OR 
           c.name ILIKE '%provision%'
         )
         AND t.occurred_at >= $2 AND t.occurred_at <= $3
       GROUP BY DATE(t.occurred_at)`,
      [req.userId, weekStart.toISOString(), now.toISOString()]
    );

    const spendDaysSet = new Set(dailyFoodSpendRes.rows.map(r => new Date(r.spend_date).toISOString().split('T')[0]));
    let zeroSpendDaysCount = 0;
    for (let d = 0; d < daysElapsed; d++) {
      const checkDate = new Date(weekStart.getTime() + d * 24 * 60 * 60 * 1000);
      const isoDate = checkDate.toISOString().split('T')[0];
      if (!spendDaysSet.has(isoDate)) {
        zeroSpendDaysCount++;
      }
    }

    const weeklyTarget = Number(settings.meal_plan_weekly_target || 0);
    const remainingMealBudget = weeklyTarget > 0 ? Math.max(0, weeklyTarget - thisWeekFoodSpent) : 0;
    
    // Stash savings estimate based on days elapsed vs budget
    const expectedSpendToDate = weeklyTarget > 0 ? Math.round((weeklyTarget / 7) * daysElapsed) : 0;
    const stashSavings = Math.max(0, expectedSpendToDate - thisWeekFoodSpent);

    const mealPlan = {
      weekly_target: weeklyTarget,
      is_set: weeklyTarget > 0,
      this_week_food_spent: thisWeekFoodSpent,
      remaining_meal_budget: remainingMealBudget,
      zero_spend_days_count: zeroSpendDaysCount,
      days_elapsed: daysElapsed,
      stash_savings: stashSavings,
      week_label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    };

    return res.json({
      period: {
        from: fromIso,
        to: toIso,
        total_spent: totalSpent,
      },
      categories: categoryList,
      weekly_bars: weeklyBars,
      cycle_comparison: cycleComparison,
      top_purchases: topPurchases,
      food_split: foodSplit,
      meal_plan: mealPlan,
    });
  } catch (err) {
    console.error('Insights fetch error:', err);
    return res.status(500).json({ error: { message: 'Failed to generate spending insights.' } });
  }
});

// ── PUT /api/insights/meal-plan ──────────────────────────────────────────────
router.put('/meal-plan', async (req, res) => {
  const { weekly_target } = req.body;
  const numTarget = Math.max(0, parseInt(weekly_target, 10) || 0);

  try {
    const updated = await db.query(
      `UPDATE user_settings 
       SET meal_plan_weekly_target = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING meal_plan_weekly_target`,
      [numTarget, req.userId]
    );

    return res.json({
      message: 'Weekly meal plan target saved!',
      weekly_target: Number(updated.rows[0].meal_plan_weekly_target),
    });
  } catch (err) {
    console.error('Update meal plan target error:', err);
    return res.status(500).json({ error: { message: 'Failed to update meal plan target.' } });
  }
});

module.exports = router;
