const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const publicShareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 60,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many requests for this share link. Please wait a few moments and try again.',
      action: 'slow_down'
    }
  }
});

// ── Public Endpoint: View Sponsor Statement (No Authentication Required) ──
router.get('/public/:token', publicShareLimiter, async (req, res) => {
  const { token } = req.params;

  try {
    const linkRes = await db.query(
      `SELECT s.id, s.token, s.user_id, s.expires_at,
              u.name as student_name,
              COALESCE(us.home_currency, 'NGN') as home_currency
       FROM share_links s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN user_settings us ON s.user_id = us.user_id
       WHERE s.token = $1 AND s.is_revoked = false AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)`,
      [token]
    );

    if (linkRes.rows.length === 0) {
      return res.status(404).json({
        error: { message: 'This share link is either expired, revoked, or invalid.' }
      });
    }

    const shareInfo = linkRes.rows[0];
    const userId = shareInfo.user_id;
    const currency = shareInfo.home_currency;

    // 1. Check for active budget
    const budgetRes = await db.query(
      `SELECT * FROM budgets
       WHERE user_id = $1 AND is_active = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    let budgetSummary = null;
    let periodFrom = null;
    let periodTo = null;

    if (budgetRes.rows.length > 0) {
      const b = budgetRes.rows[0];
      periodFrom = b.start_date;
      periodTo = b.end_date;

      const spentRes = await db.query(
        `SELECT SUM(COALESCE(converted_amount, amount)) as total_spent
         FROM transactions
         WHERE user_id = $1 AND type = 'expense'
           AND source_group IS DISTINCT FROM 'piggybank'
           AND occurred_at >= $2 AND occurred_at <= $3`,
        [userId, b.start_date, b.end_date]
      );

      const totalSpent = Number(spentRes.rows[0]?.total_spent || 0);
      const totalAmount = Number(b.total_amount);
      const remaining = totalAmount - totalSpent;

      const now = new Date();
      const end = new Date(b.end_date);
      const daysRemaining = Math.max(1, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      budgetSummary = {
        name: b.name || 'Current Budget Cycle',
        total_amount: totalAmount,
        spent: totalSpent,
        remaining,
        days_remaining: daysRemaining,
        start_date: b.start_date,
        end_date: b.end_date
      };
    }

    // Date filters for category & transactions
    const dateParams = [userId];
    let dateFilter = '';
    if (periodFrom) { dateParams.push(periodFrom); dateFilter += ` AND t.occurred_at >= $${dateParams.length}`; }
    if (periodTo)   { dateParams.push(periodTo);   dateFilter += ` AND t.occurred_at <= $${dateParams.length}`; }

    // 2. Spending by category
    const catRes = await db.query(
      `SELECT 
         COALESCE(c.name, 'Other') as category_name,
         SUM(COALESCE(t.converted_amount, t.amount)) as total
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 AND t.type = 'expense'
         AND t.source_group IS DISTINCT FROM 'piggybank'
         ${dateFilter}
       GROUP BY c.name
       ORDER BY total DESC
       LIMIT 8`,
      dateParams
    );

    // 3. Recent 20 sanitized transactions
    const txParams = [userId];
    let txDateFilter = '';
    if (periodFrom) { txParams.push(periodFrom); txDateFilter += ` AND t.occurred_at >= $${txParams.length}`; }
    if (periodTo)   { txParams.push(periodTo);   txDateFilter += ` AND t.occurred_at <= $${txParams.length}`; }

    const txRes = await db.query(
      `SELECT t.id, t.occurred_at, t.type, t.amount, t.currency,
              t.converted_amount, t.note, c.name as category_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 AND t.source_group IS DISTINCT FROM 'piggybank'
         ${txDateFilter}
       ORDER BY t.occurred_at DESC
       LIMIT 20`,
      txParams
    );

    // Sanitize display name (only first name or clean display)
    const rawName = shareInfo.student_name || 'Student';
    const studentDisplayName = rawName.trim().split(' ')[0] || 'Student';

    return res.json({
      student_name: studentDisplayName,
      home_currency: currency,
      budget: budgetSummary,
      categories: catRes.rows,
      transactions: txRes.rows,
      expires_at: shareInfo.expires_at
    });
  } catch (err) {
    console.error('Public share link error:', err);
    return res.status(500).json({ error: { message: 'Could not load student financial overview.' } });
  }
});

// ── Authenticated Endpoints: Create, List & Revoke Share Links ──

router.post('/', requireAuth, async (req, res) => {
  try {
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const insertRes = await db.query(
      `INSERT INTO share_links (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, token, is_revoked, expires_at, created_at`,
      [req.userId, token, expiresAt]
    );

    return res.status(201).json({
      message: 'Share link generated successfully!',
      share_link: insertRes.rows[0]
    });
  } catch (err) {
    console.error('Create share link error:', err);
    return res.status(500).json({ error: { message: 'Failed to create share link.' } });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const listRes = await db.query(
      `SELECT id, token, is_revoked, expires_at, created_at
       FROM share_links
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [req.userId]
    );

    return res.json({ share_links: listRes.rows });
  } catch (err) {
    console.error('List share links error:', err);
    return res.status(500).json({ error: { message: 'Failed to fetch share links.' } });
  }
});

router.delete('/:token', requireAuth, async (req, res) => {
  const { token } = req.params;

  try {
    const updateRes = await db.query(
      `UPDATE share_links
       SET is_revoked = true
       WHERE token = $1 AND user_id = $2
       RETURNING id`,
      [token, req.userId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Share link not found.' } });
    }

    return res.json({ message: 'Share link has been revoked.' });
  } catch (err) {
    console.error('Revoke share link error:', err);
    return res.status(500).json({ error: { message: 'Failed to revoke share link.' } });
  }
});

module.exports = router;
