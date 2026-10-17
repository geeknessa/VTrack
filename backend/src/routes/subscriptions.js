const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

// Helper to calculate next billing date and days until renewal
function calculateRenewalMetrics(sub) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let nextRenewalDate;
  const isTrial = sub.status === 'trial' || (sub.trial_ends_on && new Date(sub.trial_ends_on) >= today);
  let trialDaysRemaining = null;

  if (isTrial && sub.trial_ends_on) {
    const trialDate = new Date(sub.trial_ends_on);
    nextRenewalDate = new Date(trialDate.getFullYear(), trialDate.getMonth(), trialDate.getDate());
    trialDaysRemaining = Math.max(0, Math.ceil((nextRenewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  } else {
    const billingDay = Math.min(31, Math.max(1, parseInt(sub.billing_day, 10) || 1));
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Check this month
    const thisMonthDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const safeDayThisMonth = Math.min(billingDay, thisMonthDays);
    const candidateThisMonth = new Date(currentYear, currentMonth, safeDayThisMonth);

    if (candidateThisMonth >= today) {
      nextRenewalDate = candidateThisMonth;
    } else {
      // Moves to next month
      const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextMonthDays = new Date(nextMonthYear, nextMonth + 1, 0).getDate();
      const safeDayNextMonth = Math.min(billingDay, nextMonthDays);
      nextRenewalDate = new Date(nextMonthYear, nextMonth, safeDayNextMonth);
    }
  }

  const diffMs = nextRenewalDate.getTime() - today.getTime();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isRenewingSoon = daysUntil <= 3 && daysUntil >= 0;
  const isRenewingToday = daysUntil === 0;

  return {
    next_renewal_date: nextRenewalDate.toISOString().split('T')[0],
    days_until_renewal: daysUntil,
    is_renewing_soon: isRenewingSoon,
    is_renewing_today: isRenewingToday,
    is_trial: isTrial,
    trial_days_remaining: trialDaysRemaining,
  };
}

// ── GET /api/subscriptions/catalog ──────────────────────────────────────────
router.get('/catalog', async (req, res) => {
  try {
    const catalogRes = await db.query(
      'SELECT id, name, icon_key, default_amount, default_currency FROM subscription_catalog ORDER BY name ASC'
    );
    return res.json({ catalog: catalogRes.rows });
  } catch (err) {
    console.error('Catalog fetch error:', err);
    return res.status(500).json({ error: { message: 'Failed to fetch subscription catalog.' } });
  }
});

// ── GET /api/subscriptions ──────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const subsRes = await db.query(
      `SELECT s.*, c.name as category_name
       FROM subscriptions s
       LEFT JOIN categories c ON s.category_id = c.id
       WHERE s.user_id = $1
       ORDER BY s.status ASC, s.billing_day ASC, s.name ASC`,
      [req.userId]
    );

    let monthlyTotal = 0;
    let yearlyTotal = 0;
    let activeCount = 0;
    const upcomingAlerts = [];

    const subscriptions = subsRes.rows.map((row) => {
      const amount = Number(row.amount);
      const metrics = calculateRenewalMetrics(row);
      const isActive = row.status === 'active' || metrics.is_trial;

      if (isActive) {
        activeCount++;
        if (row.cycle === 'yearly') {
          yearlyTotal += amount;
          monthlyTotal += Math.round(amount / 12);
        } else {
          monthlyTotal += amount;
          yearlyTotal += amount * 12;
        }

        if (metrics.is_renewing_soon) {
          upcomingAlerts.push({
            id: row.id,
            name: row.name,
            amount: amount,
            currency: row.currency || 'NGN',
            days_until_renewal: metrics.days_until_renewal,
            is_renewing_today: metrics.is_renewing_today,
            is_trial: metrics.is_trial,
            trial_days_remaining: metrics.trial_days_remaining,
            icon_key: row.icon_key || 'credit-card',
          });
        }
      }

      return {
        id: row.id,
        name: row.name,
        catalog_id: row.catalog_id,
        amount: amount,
        currency: row.currency || 'NGN',
        billing_day: row.billing_day,
        cycle: row.cycle,
        trial_ends_on: row.trial_ends_on,
        status: row.status,
        icon_key: row.icon_key || 'credit-card',
        category_id: row.category_id,
        category_name: row.category_name,
        last_renewed_at: row.last_renewed_at,
        created_at: row.created_at,
        ...metrics,
      };
    });

    // Sort upcoming alerts by closest date
    upcomingAlerts.sort((a, b) => a.days_until_renewal - b.days_until_renewal);

    return res.json({
      summary: {
        monthly_total: monthlyTotal,
        yearly_total: yearlyTotal,
        active_count: activeCount,
      },
      upcoming_alerts: upcomingAlerts,
      subscriptions,
    });
  } catch (err) {
    console.error('Subscriptions fetch error:', err);
    return res.status(500).json({ error: { message: 'Failed to fetch subscriptions.' } });
  }
});

// ── POST /api/subscriptions ─────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    name,
    amount,
    currency,
    billing_day,
    cycle,
    trial_ends_on,
    catalog_id,
    icon_key,
    category_id,
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: { message: 'Subscription name is required.' } });
  }

  const numAmount = parseInt(amount, 10);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: { message: 'Please provide a valid subscription price.' } });
  }

  const bDay = Math.min(31, Math.max(1, parseInt(billing_day, 10) || 1));
  const subCycle = cycle === 'yearly' ? 'yearly' : 'monthly';
  const subStatus = trial_ends_on ? 'trial' : 'active';

  try {
    // If category_id not provided, default to Entertainment & Subscriptions
    let finalCatId = category_id || null;
    if (!finalCatId) {
      const catCheck = await db.query(
        "SELECT id FROM categories WHERE name ILIKE '%entertainment%' OR name ILIKE '%subscription%' LIMIT 1"
      );
      if (catCheck.rows.length > 0) finalCatId = catCheck.rows[0].id;
    }

    const insertRes = await db.query(
      `INSERT INTO subscriptions (
        user_id, catalog_id, name, amount, currency, billing_day, cycle, trial_ends_on, status, icon_key, category_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        req.userId,
        catalog_id || null,
        name.trim(),
        numAmount,
        currency || 'NGN',
        bDay,
        subCycle,
        trial_ends_on ? new Date(trial_ends_on).toISOString().split('T')[0] : null,
        subStatus,
        icon_key || 'credit-card',
        finalCatId,
      ]
    );

    return res.status(201).json({
      message: 'Subscription added successfully!',
      subscription: insertRes.rows[0],
    });
  } catch (err) {
    console.error('Create subscription error:', err);
    return res.status(500).json({ error: { message: 'Failed to add subscription.' } });
  }
});

// ── PUT /api/subscriptions/:id ──────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const subId = parseInt(req.params.id, 10);
  const {
    name,
    amount,
    currency,
    billing_day,
    cycle,
    trial_ends_on,
    status,
    icon_key,
    category_id,
  } = req.body;

  try {
    const existing = await db.query('SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2', [subId, req.userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Subscription not found.' } });
    }

    const current = existing.rows[0];
    const updateRes = await db.query(
      `UPDATE subscriptions SET
        name = COALESCE($1, name),
        amount = COALESCE($2, amount),
        currency = COALESCE($3, currency),
        billing_day = COALESCE($4, billing_day),
        cycle = COALESCE($5, cycle),
        trial_ends_on = $6,
        status = COALESCE($7, status),
        icon_key = COALESCE($8, icon_key),
        category_id = COALESCE($9, category_id)
       WHERE id = $10 AND user_id = $11
       RETURNING *`,
      [
        name ? name.trim() : null,
        amount !== undefined ? parseInt(amount, 10) : null,
        currency || null,
        billing_day !== undefined ? Math.min(31, Math.max(1, parseInt(billing_day, 10))) : null,
        cycle || null,
        trial_ends_on !== undefined ? (trial_ends_on ? new Date(trial_ends_on).toISOString().split('T')[0] : null) : current.trial_ends_on,
        status || null,
        icon_key || null,
        category_id !== undefined ? category_id : null,
        subId,
        req.userId,
      ]
    );

    return res.json({
      message: 'Subscription updated successfully!',
      subscription: updateRes.rows[0],
    });
  } catch (err) {
    console.error('Update subscription error:', err);
    return res.status(500).json({ error: { message: 'Failed to update subscription.' } });
  }
});

// ── DELETE /api/subscriptions/:id ───────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const subId = parseInt(req.params.id, 10);
  try {
    const delRes = await db.query('DELETE FROM subscriptions WHERE id = $1 AND user_id = $2 RETURNING *', [subId, req.userId]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Subscription not found.' } });
    }
    return res.json({ message: 'Subscription removed successfully!' });
  } catch (err) {
    console.error('Delete subscription error:', err);
    return res.status(500).json({ error: { message: 'Failed to delete subscription.' } });
  }
});

// ── POST /api/subscriptions/:id/renew (Action: Keep & Log Renewal) ───────────
router.post('/:id/renew', async (req, res) => {
  const subId = parseInt(req.params.id, 10);
  try {
    const subRes = await db.query('SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2', [subId, req.userId]);
    if (subRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Subscription not found.' } });
    }

    const sub = subRes.rows[0];
    const amount = Number(sub.amount);

    // Record as transaction
    const txRes = await db.query(
      `INSERT INTO transactions (user_id, type, amount, currency, converted_amount, category_id, note, occurred_at)
       VALUES ($1, 'expense', $2, $3, $2, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [req.userId, amount, sub.currency || 'NGN', sub.category_id || null, `Subscription Renewal: ${sub.name}`]
    );

    // Update last_renewed_at and switch trial to active if applicable
    await db.query(
      `UPDATE subscriptions SET
         last_renewed_at = CURRENT_TIMESTAMP,
         status = 'active'
       WHERE id = $1 AND user_id = $2`,
      [subId, req.userId]
    );

    return res.json({
      message: `Renewal logged for ${sub.name}!`,
      transaction: txRes.rows[0],
    });
  } catch (err) {
    console.error('Subscription renew error:', err);
    return res.status(500).json({ error: { message: 'Failed to process subscription renewal.' } });
  }
});

// ── POST /api/subscriptions/:id/cancel (Action: Cancel Subscription) ─────────
router.post('/:id/cancel', async (req, res) => {
  const subId = parseInt(req.params.id, 10);
  try {
    const updateRes = await db.query(
      `UPDATE subscriptions SET status = 'cancelled'
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [subId, req.userId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Subscription not found.' } });
    }

    return res.json({
      message: `${updateRes.rows[0].name} marked as cancelled.`,
      subscription: updateRes.rows[0],
    });
  } catch (err) {
    console.error('Subscription cancel error:', err);
    return res.status(500).json({ error: { message: 'Failed to cancel subscription.' } });
  }
});

module.exports = router;
