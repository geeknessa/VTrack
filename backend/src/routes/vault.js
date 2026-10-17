const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { resolveCurrencyConversion } = require('../utils/money');
const router = express.Router();

router.use(requireAuth);

// Stash money into the vault
router.post('/stash', async (req, res) => {
  const { amount, currency, exchange_rate } = req.body;
  const numAmount = Math.max(0, Math.round(Number(amount)));
  
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: { message: 'Invalid amount.' } });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { exchangeRate, convertedAmount } = await resolveCurrencyConversion(
      numAmount,
      currency,
      req.userId,
      exchange_rate,
      client
    );

    // 1. Log the transfer as an expense transaction so the main balance drops
    await client.query(
      `INSERT INTO transactions 
       (user_id, type, amount, currency, exchange_rate, converted_amount, note, source_group) 
       VALUES ($1, 'expense', $2, $3, $4, $5, 'Piggybank Stash', 'piggybank')`,
      [req.userId, numAmount, currency || 'NGN', exchangeRate, convertedAmount]
    );

    // 2. Increase the vault_balance in user_settings using converted amount
    const updatedSettings = await client.query(
      `UPDATE user_settings 
       SET vault_balance = vault_balance + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING vault_balance`,
      [convertedAmount, req.userId]
    );

    await client.query('COMMIT');

    return res.json({ 
      message: 'Successfully stashed!',
      vault_balance: Number(updatedSettings.rows[0].vault_balance)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Stash error:', err);
    return res.status(500).json({ error: { message: 'Failed to stash money.' } });
  } finally {
    client.release();
  }
});

// Withdraw money from the vault back to spending balance
router.post('/withdraw', async (req, res) => {
  const { amount, currency, exchange_rate } = req.body;
  const numAmount = Math.max(0, Math.round(Number(amount)));

  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: { message: 'Please specify a valid amount to withdraw.' } });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { exchangeRate, convertedAmount } = await resolveCurrencyConversion(
      numAmount,
      currency,
      req.userId,
      exchange_rate,
      client
    );

    // Check available vault balance with lock
    const settingsRes = await client.query(
      'SELECT vault_balance FROM user_settings WHERE user_id = $1 FOR UPDATE',
      [req.userId]
    );

    const currentVault = Number(settingsRes.rows[0]?.vault_balance || 0);
    if (convertedAmount > currentVault) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: { message: 'You cannot withdraw more than your current Piggybank balance.' }
      });
    }

    // 1. Log an income transaction to return funds to active spending balance
    await client.query(
      `INSERT INTO transactions
       (user_id, type, amount, currency, exchange_rate, converted_amount, note, source_group)
       VALUES ($1, 'income', $2, $3, $4, $5, 'Piggybank Withdrawal', 'piggybank')`,
      [req.userId, numAmount, currency || 'NGN', exchangeRate, convertedAmount]
    );

    // 2. Reduce vault balance
    const updated = await client.query(
      `UPDATE user_settings
       SET vault_balance = vault_balance - $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING vault_balance`,
      [convertedAmount, req.userId]
    );

    await client.query('COMMIT');
    return res.json({
      message: 'Successfully withdrawn from Piggybank!',
      vault_balance: Number(updated.rows[0].vault_balance)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Withdraw error:', err);
    return res.status(500).json({ error: { message: 'Failed to withdraw from Piggybank.' } });
  } finally {
    client.release();
  }
});

module.exports = router;
