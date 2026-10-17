const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

/**
 * Helper to compute budget details & live spending
 */
async function getBudgetDetails(budget, userId) {
  const budgetId = budget.id;
  const startDate = typeof budget.start_date === 'string' ? budget.start_date.split('T')[0] : budget.start_date.toISOString().split('T')[0];
  const endDate = typeof budget.end_date === 'string' ? budget.end_date.split('T')[0] : budget.end_date.toISOString().split('T')[0];

  const startIso = `${startDate}T00:00:00.000Z`;
  const endIso = `${endDate}T23:59:59.999Z`;

  // 1. Total spent across cycle
  const spentRes = await db.query(
    `SELECT COALESCE(SUM(amount), 0) as total_spent, COUNT(*) as tx_count
     FROM transactions
     WHERE user_id = $1 AND type = 'expense'
       AND source_group IS DISTINCT FROM 'piggybank'
       AND occurred_at >= $2 AND occurred_at <= $3`,
    [userId, startIso, endIso]
  );
  const totalSpent = Number(spentRes.rows[0].total_spent);
  const txCountInCycle = Number(spentRes.rows[0].tx_count);

  const totalAmount = Number(budget.total_amount);
  const remaining = totalAmount - totalSpent;
  const percentageUsed = totalAmount > 0
    ? Number(((totalSpent / totalAmount) * 100).toFixed(1))
    : 0;

  // Status caption
  let statusCaption = '';
  if (totalSpent > totalAmount) {
    statusCaption = `${percentageUsed}% used · Over budget`;
  } else if (percentageUsed >= 90) {
    statusCaption = `${percentageUsed}% used · Getting close to your limit`;
  } else if (percentageUsed >= 75) {
    statusCaption = `${percentageUsed}% used · Pace your spending`;
  } else {
    statusCaption = `${percentageUsed}% used · On track`;
  }

  // 2. Cycle days calculation
  const startD = new Date(startDate);
  const endD = new Date(endDate);
  const now = new Date();
  const msDuration = endD.getTime() - startD.getTime();
  const totalDays = Math.max(1, Math.round(msDuration / (1000 * 60 * 60 * 24)) + 1);
  const msRemaining = endD.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  // 3. Category allocations & category spending
  const allocRes = await db.query(
    `SELECT bc.id, bc.category_id, bc.allocated_amount, c.name as category_name, c.icon_key, c.kind
     FROM budget_categories bc
     JOIN categories c ON bc.category_id = c.id
     WHERE bc.budget_id = $1
     ORDER BY bc.allocated_amount DESC`,
    [budgetId]
  );

  const catSpendRes = await db.query(
    `SELECT category_id, COALESCE(SUM(amount), 0) as spent
     FROM transactions
     WHERE user_id = $1 AND type = 'expense'
       AND source_group IS DISTINCT FROM 'piggybank'
       AND occurred_at >= $2 AND occurred_at <= $3
       AND category_id IS NOT NULL
     GROUP BY category_id`,
    [userId, startIso, endIso]
  );

  const spendByCatMap = new Map();
  catSpendRes.rows.forEach(r => spendByCatMap.set(r.category_id, Number(r.spent)));

  let totalAllocated = 0;
  const categories = allocRes.rows.map(row => {
    const allocated = Number(row.allocated_amount);
    totalAllocated += allocated;
    const spent = spendByCatMap.get(row.category_id) || 0;
    const rem = allocated - spent;
    const pct = allocated > 0 ? Number(((spent / allocated) * 100).toFixed(1)) : 0;
    return {
      category_id: row.category_id,
      category_name: row.category_name,
      icon_key: row.icon_key,
      kind: row.kind,
      allocated_amount: allocated,
      spent_amount: spent,
      remaining_amount: rem,
      percentage_used: pct,
    };
  });

  const unallocatedAmount = Math.max(0, totalAmount - totalAllocated);

  // 4. Guardrails: Today & This Week
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);
  const weekStart = monday.toISOString();
  const weekEnd = sunday.toISOString();

  const [todaySpendRes, weekSpendRes] = await Promise.all([
    db.query(
      `SELECT COALESCE(SUM(amount), 0) as spent
       FROM transactions
       WHERE user_id = $1 AND type = 'expense'
         AND source_group IS DISTINCT FROM 'piggybank'
         AND occurred_at >= $2 AND occurred_at <= $3`,
      [userId, todayStart, todayEnd]
    ),
    db.query(
      `SELECT COALESCE(SUM(amount), 0) as spent
       FROM transactions
       WHERE user_id = $1 AND type = 'expense'
         AND source_group IS DISTINCT FROM 'piggybank'
         AND occurred_at >= $2 AND occurred_at <= $3`,
      [userId, weekStart, weekEnd]
    ),
  ]);

  const spentToday = Number(todaySpendRes.rows[0].spent);
  const spentThisWeek = Number(weekSpendRes.rows[0].spent);

  // Upcoming active subscription renewals due before this cycle ends
  let upcomingSubscriptionsReserved = 0;
  try {
    const subsRes = await db.query(
      `SELECT amount, billing_day, cycle, trial_ends_on, status FROM subscriptions
       WHERE user_id = $1 AND status IN ('active', 'trial')`,
      [userId]
    );

    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const cycleEndDate = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate());

    subsRes.rows.forEach(sub => {
      const amt = Number(sub.amount);
      const bDay = Math.min(31, Math.max(1, parseInt(sub.billing_day, 10) || 1));
      const curYear = now.getFullYear();
      const curMonth = now.getMonth();

      let nextDate;
      if (sub.status === 'trial' && sub.trial_ends_on) {
        nextDate = new Date(sub.trial_ends_on);
      } else {
        const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
        const cand = new Date(curYear, curMonth, Math.min(bDay, daysInMonth));
        if (cand >= todayDate) {
          nextDate = cand;
        } else {
          const nextY = curMonth === 11 ? curYear + 1 : curYear;
          const nextM = curMonth === 11 ? 0 : curMonth + 1;
          const daysInNextM = new Date(nextY, nextM + 1, 0).getDate();
          nextDate = new Date(nextY, nextM, Math.min(bDay, daysInNextM));
        }
      }

      if (nextDate && nextDate >= todayDate && nextDate <= cycleEndDate) {
        upcomingSubscriptionsReserved += amt;
      }
    });
  } catch (err) {
    console.error('Error calculating upcoming subscription renewals:', err);
  }

  // Daily limit: deduct upcoming renewals before calculating per-day safe spend
  const remainingForDaily = Math.max(0, remaining - upcomingSubscriptionsReserved);
  const explicitDailyLimit = budget.daily_limit ? Number(budget.daily_limit) : null;
  const pacedDailyLimit = daysRemaining > 0 && remainingForDaily > 0 
    ? Math.round(remainingForDaily / daysRemaining) 
    : Math.round(totalAmount / totalDays);
  const dailyLimit = explicitDailyLimit || pacedDailyLimit;
  const dailyRemaining = dailyLimit - spentToday;

  // Weekly limit: explicit or pacing fallback
  const explicitWeeklyLimit = budget.weekly_limit ? Number(budget.weekly_limit) : null;
  const pacedWeeklyLimit = Math.round((totalAmount / totalDays) * 7);
  const weeklyLimit = explicitWeeklyLimit || pacedWeeklyLimit;
  const weeklyRemaining = weeklyLimit - spentThisWeek;

  // 5. Savings target & settings info
  const settingsRes = await db.query(
    'SELECT vault_balance, vault_goal FROM user_settings WHERE user_id = $1',
    [userId]
  );
  const vaultBalance = Number(settingsRes.rows[0]?.vault_balance || 0);
  const savingsTarget = Number(budget.savings_target || 0);

  return {
    id: budget.id,
    name: budget.name || 'Current Budget',
    cycle_type: budget.cycle_type,
    start_date: startDate,
    end_date: endDate,
    total_amount: totalAmount,
    spent: totalSpent,
    remaining,
    percentage_used: percentageUsed,
    status_caption: statusCaption,
    days_remaining: daysRemaining,
    total_days: totalDays,
    tx_count_in_cycle: txCountInCycle,
    daily: {
      limit: dailyLimit,
      is_explicit: explicitDailyLimit !== null,
      spent: spentToday,
      remaining: dailyRemaining,
    },
    weekly: {
      limit: weeklyLimit,
      is_explicit: explicitWeeklyLimit !== null,
      spent: spentThisWeek,
      remaining: weeklyRemaining,
    },
    savings_target: savingsTarget,
    vault_balance: vaultBalance,
    upcoming_subscriptions_reserved: upcomingSubscriptionsReserved,
    categories,
    has_category_allocations: categories.length > 0,
    unallocated_amount: unallocatedAmount,
  };
}

/**
 * GET /api/budgets/active
 * Returns current active budget with live spent and remaining numbers
 */
router.get('/active', async (req, res) => {
  try {
    const budgetRes = await db.query(
      `SELECT * FROM budgets
       WHERE user_id = $1 AND is_active = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.userId]
    );

    if (budgetRes.rows.length === 0) {
      return res.json({ has_budget: false, budget: null });
    }

    const budgetDetails = await getBudgetDetails(budgetRes.rows[0], req.userId);
    return res.json({ has_budget: true, budget: budgetDetails });
  } catch (err) {
    console.error('Get active budget error:', err);
    return res.status(500).json({ error: { message: 'Failed to retrieve active budget.' } });
  }
});

/**
 * POST /api/budgets/suggest
 * Generates an editable budget proposal based on available funds, duration, and past spending
 */
router.post('/suggest', async (req, res) => {
  try {
    const { cycle_type = 'monthly', start_date, end_date, total_funds } = req.body;

    // Determine cycle window
    const now = new Date();
    let sDate = start_date;
    let eDate = end_date;

    if (!sDate || !eDate) {
      if (cycle_type === 'monthly') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        sDate = firstDay.toISOString().split('T')[0];
        eDate = lastDay.toISOString().split('T')[0];
      } else if (cycle_type === 'weekly') {
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
        const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
        sDate = monday.toISOString().split('T')[0];
        eDate = sunday.toISOString().split('T')[0];
      } else {
        // Default 30 days
        sDate = now.toISOString().split('T')[0];
        const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        eDate = future.toISOString().split('T')[0];
      }
    }

    // Determine baseline income / available funds
    let baselineIncome = total_funds ? Number(total_funds) : 0;
    const settingsRes = await db.query(
      'SELECT base_income, opening_balance, main_goal FROM user_settings WHERE user_id = $1',
      [req.userId]
    );

    const userGoal = req.body.goal || settingsRes.rows[0]?.main_goal || 'balanced';

    if (!baselineIncome) {
      if (settingsRes.rows.length > 0) {
        baselineIncome = Number(settingsRes.rows[0].base_income) || Number(settingsRes.rows[0].opening_balance) || 0;
      }
    }

    if (!baselineIncome || baselineIncome <= 0) {
      // Default sensible starter of ₦50,000 (5,000,000 kobo)
      baselineIncome = 5000000;
    }

    const { wants_to_save = false, custom_savings = 0 } = req.body;

    let suggestedSavings = 0;
    let adviceTitle = 'Full Spending Allowance Plan';
    let adviceSubtitle = '100% of your allowance is dedicated to everyday spending—no forced savings.';
    let adviceMessage = '';

    if (wants_to_save) {
      if (custom_savings && Number(custom_savings) > 0) {
        suggestedSavings = Math.min(baselineIncome, Math.round(Number(custom_savings)));
      } else {
        const rate = userGoal === 'save' ? 0.20 : 0.10;
        suggestedSavings = Math.round(baselineIncome * rate);
      }
      adviceTitle = 'Savings & Spending Plan';
      adviceSubtitle = `Tucking away ${formatNairaBackend(suggestedSavings)} into Piggybank while keeping the rest for everyday life.`;
    }

    const spendingBudget = Math.max(0, baselineIncome - suggestedSavings);

    // Calculate days in window
    const startObj = new Date(sDate);
    const endObj = new Date(eDate);
    const days = Math.max(1, Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const suggestedDaily = Math.round(spendingBudget / days);
    const suggestedWeekly = Math.min(spendingBudget, Math.round((spendingBudget / days) * 7));

    // Get user categories
    const categoriesRes = await db.query(
      `SELECT id, name, icon_key, kind
       FROM categories
       WHERE user_id = $1 OR is_default = true
       ORDER BY id ASC`,
      [req.userId]
    );

    // Analyze past 60 days spending distribution
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const pastTxRes = await db.query(
      `SELECT category_id, SUM(amount) as total
       FROM transactions
       WHERE user_id = $1 AND type = 'expense'
         AND source_group IS DISTINCT FROM 'piggybank'
         AND occurred_at >= $2
         AND category_id IS NOT NULL
       GROUP BY category_id`,
      [req.userId, sixtyDaysAgo]
    );

    const pastTotal = pastTxRes.rows.reduce((sum, r) => sum + Number(r.total), 0);
    const pastByCat = new Map();
    pastTxRes.rows.forEach(r => pastByCat.set(r.category_id, Number(r.total)));

    // Standard baseline weights for students & young adults
    const defaultWeights = {
      'Food & Groceries': 0.35,
      'Transport & Commute': 0.15,
      'Rent & Utilities': 0.15,
      'Data & Airtime': 0.10,
      'Health & Toiletries': 0.05,
      'Snacks & Drinks': 0.05,
      'Academics & Books': 0.05,
      'Outings & Hangouts': 0.05,
      'Clothes & Fashion': 0.03,
      'Tech & Accessories': 0.02,
    };

    let allocatedSum = 0;
    const suggestedAllocations = categoriesRes.rows.map(cat => {
      let share = 0;
      if (pastTotal > 0 && pastByCat.has(cat.id)) {
        // 60% based on past habit + 40% based on baseline rule
        const historicalWeight = pastByCat.get(cat.id) / pastTotal;
        const baselineWeight = defaultWeights[cat.name] || 0.04;
        share = historicalWeight * 0.6 + baselineWeight * 0.4;
      } else {
        share = defaultWeights[cat.name] || (cat.kind === 'needs' ? 0.08 : 0.04);
      }

      const allocatedAmount = Math.round(spendingBudget * share);
      allocatedSum += allocatedAmount;

      return {
        category_id: cat.id,
        category_name: cat.name,
        icon_key: cat.icon_key,
        kind: cat.kind,
        allocated_amount: allocatedAmount,
      };
    });

    return res.json({
      suggestion: {
        cycle_type,
        start_date: sDate,
        end_date: eDate,
        total_funds: baselineIncome,
        total_amount: spendingBudget,
        daily_limit: suggestedDaily,
        weekly_limit: suggestedWeekly,
        savings_target: suggestedSavings,
        allocations: suggestedAllocations,
        goal: userGoal,
        advice_title: adviceTitle,
        advice_subtitle: adviceSubtitle,
        advice_message: wants_to_save
          ? `Based on your allowance of ${formatNairaBackend(baselineIncome)}, tucking ${formatNairaBackend(suggestedSavings)} into Piggybank leaves you with a safe spending budget of ${formatNairaBackend(spendingBudget)}. Aim for ~${formatNairaBackend(suggestedDaily)}/day so your money stays stress-free!`
          : `Based on your allowance of ${formatNairaBackend(baselineIncome)}, your full spending budget is ${formatNairaBackend(baselineIncome)}. Aim for around ~${formatNairaBackend(suggestedDaily)}/day to comfortably make your money last without running dry!`
      }
    });
  } catch (err) {
    console.error('Suggest budget error:', err);
    return res.status(500).json({ error: { message: 'Failed to generate budget suggestion.' } });
  }
});

function formatNairaBackend(minorUnits) {
  const major = minorUnits / 100;
  return '₦' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(major);
}

/**
 * POST /api/budgets
 * Creates and activates a new budget
 */
router.post('/', async (req, res) => {
  const {
    name,
    cycle_type = 'monthly',
    start_date,
    end_date,
    total_amount,
    daily_limit,
    weekly_limit,
    savings_target,
    allocations,
  } = req.body;

  if (!start_date || !end_date || !total_amount) {
    return res.status(400).json({
      error: { message: 'start_date, end_date, and total_amount are required.' }
    });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Deactivate previous active budgets
    await client.query(
      'UPDATE budgets SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [req.userId]
    );

    // Insert new budget
    const budgetRes = await client.query(
      `INSERT INTO budgets (
        user_id, name, cycle_type, start_date, end_date,
        total_amount, daily_limit, weekly_limit, savings_target, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *`,
      [
        req.userId,
        name || null,
        cycle_type,
        start_date,
        end_date,
        Math.round(Number(total_amount)),
        daily_limit ? Math.round(Number(daily_limit)) : null,
        weekly_limit ? Math.round(Number(weekly_limit)) : null,
        savings_target ? Math.round(Number(savings_target)) : 0,
      ]
    );

    const newBudget = budgetRes.rows[0];

    // Insert category allocations if provided
    if (Array.isArray(allocations) && allocations.length > 0) {
      for (const alloc of allocations) {
        if (alloc.category_id && alloc.allocated_amount > 0) {
          await client.query(
            `INSERT INTO budget_categories (budget_id, category_id, allocated_amount)
             VALUES ($1, $2, $3)
             ON CONFLICT (budget_id, category_id) DO UPDATE SET allocated_amount = EXCLUDED.allocated_amount`,
            [newBudget.id, alloc.category_id, Math.round(Number(alloc.allocated_amount))]
          );
        }
      }
    }

    // Sync settings period anchor & next income dates so PeriodContext and Dashboard are in lockstep
    await client.query(
      `UPDATE user_settings SET
        period_anchor_date = $2,
        expected_next_income_date = $3,
        period_type = $4,
        vault_goal = $5,
        updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [
        req.userId,
        start_date,
        end_date,
        cycle_type,
        savings_target ? Math.round(Number(savings_target)) : 0,
      ]
    );

    await client.query('COMMIT');

    const details = await getBudgetDetails(newBudget, req.userId);
    return res.status(201).json({
      message: 'Budget successfully created!',
      budget: details,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Budget creation error:', err);
    return res.status(500).json({ error: { message: 'Could not create budget. Please try again.' } });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/budgets/:id
 * Updates an existing budget
 */
router.put('/:id', async (req, res) => {
  const budgetId = req.params.id;
  const {
    name,
    cycle_type,
    start_date,
    end_date,
    total_amount,
    daily_limit,
    weekly_limit,
    savings_target,
    allocations,
  } = req.body;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Verify ownership
    const checkRes = await client.query(
      'SELECT * FROM budgets WHERE id = $1 AND user_id = $2',
      [budgetId, req.userId]
    );

    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: { message: 'Budget not found.' } });
    }

    const current = checkRes.rows[0];

    const updatedRes = await client.query(
      `UPDATE budgets SET
        name = COALESCE($1, name),
        cycle_type = COALESCE($2, cycle_type),
        start_date = COALESCE($3, start_date),
        end_date = COALESCE($4, end_date),
        total_amount = COALESCE($5, total_amount),
        daily_limit = $6,
        weekly_limit = $7,
        savings_target = COALESCE($8, savings_target),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [
        name !== undefined ? name : current.name,
        cycle_type || current.cycle_type,
        start_date || current.start_date,
        end_date || current.end_date,
        total_amount ? Math.round(Number(total_amount)) : current.total_amount,
        daily_limit !== undefined ? (daily_limit ? Math.round(Number(daily_limit)) : null) : current.daily_limit,
        weekly_limit !== undefined ? (weekly_limit ? Math.round(Number(weekly_limit)) : null) : current.weekly_limit,
        savings_target !== undefined ? Math.round(Number(savings_target)) : current.savings_target,
        budgetId,
        req.userId,
      ]
    );

    // Update allocations if provided
    if (Array.isArray(allocations)) {
      await client.query('DELETE FROM budget_categories WHERE budget_id = $1', [budgetId]);
      for (const alloc of allocations) {
        if (alloc.category_id && alloc.allocated_amount > 0) {
          await client.query(
            `INSERT INTO budget_categories (budget_id, category_id, allocated_amount)
             VALUES ($1, $2, $3)`,
            [budgetId, alloc.category_id, Math.round(Number(alloc.allocated_amount))]
          );
        }
      }
    }

    if (savings_target !== undefined) {
      await client.query(
        'UPDATE user_settings SET vault_goal = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        [Math.max(0, Math.round(Number(savings_target))) || 0, req.userId]
      );
    }

    await client.query('COMMIT');

    const details = await getBudgetDetails(updatedRes.rows[0], req.userId);
    return res.json({
      message: 'Budget updated successfully!',
      budget: details,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Budget update error:', err);
    return res.status(500).json({ error: { message: 'Failed to update budget.' } });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/budgets/:id
 * Deactivates or removes a budget
 */
router.delete('/:id', async (req, res) => {
  const budgetId = req.params.id;
  try {
    const delRes = await db.query(
      'UPDATE budgets SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *',
      [budgetId, req.userId]
    );

    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Budget not found.' } });
    }

    return res.json({ message: 'Budget deactivated successfully.' });
  } catch (err) {
    console.error('Budget delete error:', err);
    return res.status(500).json({ error: { message: 'Failed to deactivate budget.' } });
  }
});

module.exports = router;
