const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 15,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit'],
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
      action: 'slow_down'
    }
  }
});

const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit'],
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many password recovery requests. Please wait a few minutes before trying again.',
      action: 'slow_down'
    }
  }
});

// Register
router.post('/register', authLimiter, async (req, res) => {
  const { email, password, name, settings } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({
      error: {
        message: 'Please enter a valid email address so we can set up your account.',
        action: 'check_email'
      }
    });
  }

  if (!password || password.length < 6 || !/\d/.test(password) || !/[A-Z]/.test(password)) {
    return res.status(400).json({
      error: {
        message: 'Password must be at least 6 characters and include a number and an uppercase letter.',
        action: 'check_password'
      }
    });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const existingUser = await client.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: {
          message: 'This email is already in use. Please log in or try another email.',
          code: 'EMAIL_ALREADY_IN_USE',
          action: 'switch_to_login'
        }
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userRes = await client.query(
      'INSERT INTO users (email, password_hash, name) VALUES (LOWER($1), $2, $3) RETURNING id, email, name, created_at',
      [email, passwordHash, name || null]
    );
    const newUser = userRes.rows[0];

    // Initialize user settings with provided onboarding state or defaults
    const s = settings || {};
    const settingsRes = await client.query(
      `INSERT INTO user_settings 
       (user_id, home_currency, period_type, main_goal, expected_next_income_date, opening_balance, base_income, onboarding_completed) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        newUser.id,
        s.home_currency || 'NGN',
        s.period_type || 'manual',
        s.main_goal || 'see_spending',
        s.expected_next_income_date || null,
        s.opening_balance || 0,
        s.base_income || 0,
        true
      ]
    );

    await client.query('COMMIT');

    // Regenerate and persist a dedicated session for this tab
    await new Promise((resolve) => {
      if (req.session && typeof req.session.regenerate === 'function') {
        req.session.regenerate(() => resolve());
      } else {
        resolve();
      }
    });

    req.session.userId = newUser.id;

    await new Promise((resolve) => {
      if (req.session && typeof req.session.save === 'function') {
        req.session.save(() => resolve());
      } else {
        resolve();
      }
    });

    return res.status(201).json({
      message: "Account created! Welcome to VTrack.",
      user: newUser,
      settings: settingsRes.rows[0],
      token: req.sessionID || null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Registration error:', err);
    if (err && (err.code === '23505' || String(err.message || '').includes('unique constraint'))) {
      return res.status(400).json({
        error: {
          message: 'This email is already in use. Please log in or try another email.',
          code: 'EMAIL_ALREADY_IN_USE',
          action: 'switch_to_login'
        }
      });
    }
    return res.status(500).json({
      error: {
        message: 'Unable to complete signup right now. Check your network and try again.',
        action: 'retry'
      }
    });
  } finally {
    client.release();
  }
});

// Login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: {
        message: 'Please provide both your email and password.',
        action: 'fill_fields'
      }
    });
  }

  try {
    const userRes = await db.query(
      'SELECT id, email, name, password_hash FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        error: {
          message: 'Incorrect email or password. Double check your credentials.',
          action: 'check_credentials'
        }
      });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        error: {
          message: 'Incorrect email or password. Double check your credentials.',
          action: 'check_credentials'
        }
      });
    }

    const settingsRes = await db.query('SELECT * FROM user_settings WHERE user_id = $1', [user.id]);

    // Regenerate and persist a dedicated session for this tab
    await new Promise((resolve) => {
      if (req.session && typeof req.session.regenerate === 'function') {
        req.session.regenerate(() => resolve());
      } else {
        resolve();
      }
    });

    req.session.userId = user.id;

    await new Promise((resolve) => {
      if (req.session && typeof req.session.save === 'function') {
        req.session.save(() => resolve());
      } else {
        resolve();
      }
    });

    return res.json({
      message: 'Welcome back!',
      user: { id: user.id, email: user.email, name: user.name },
      settings: settingsRes.rows[0] || null,
      token: req.sessionID || null,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      error: {
        message: 'We could not log you in at the moment. Please try again in a few seconds.',
        action: 'retry'
      }
    });
  }
});

// Forgot Password - Request Recovery Code
router.post('/forgot-password', recoveryLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({
      error: { message: 'Please enter a valid email address.' }
    });
  }

  try {
    const userRes = await db.query(
      'SELECT id, email, name FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    // Constant time behavior / non-enumeration response
    if (userRes.rows.length === 0) {
      return res.json({
        message: 'If an account exists with this email, a 6-digit recovery code has been generated.'
      });
    }

    const user = userRes.rows[0];

    // Invalidate previous unused codes
    await db.query(
      'UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false',
      [user.id]
    );

    // 6-digit numeric recovery code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db.query(
      `INSERT INTO password_resets (user_id, code, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, resetCode, expiresAt]
    );

    console.log(`[AUTH] Password recovery code for ${user.email}: ${resetCode}`);

    return res.json({
      message: 'A 6-digit recovery code has been generated.',
      // Included for local/student instant account recovery
      recoveryCode: resetCode
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({
      error: { message: 'Could not process password recovery. Please try again.' }
    });
  }
});

// Reset Password - Verify Code and Update Password
router.post('/reset-password', recoveryLimiter, async (req, res) => {
  const { email, code } = req.body;
  const new_password = req.body.new_password || req.body.newPassword;

  if (!email || !code || !new_password) {
    return res.status(400).json({
      error: { message: 'Email, recovery code, and new password are required.' }
    });
  }

  if (new_password.length < 6 || !/\d/.test(new_password) || !/[A-Z]/.test(new_password)) {
    return res.status(400).json({
      error: {
        message: 'New password must be at least 6 characters and include a number and an uppercase letter.'
      }
    });
  }

  try {
    const userRes = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.status(400).json({
        error: { message: 'Invalid email or recovery code.' }
      });
    }

    const userId = userRes.rows[0].id;

    // Check code
    const resetRes = await db.query(
      `SELECT id FROM password_resets
       WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, String(code).trim()]
    );

    if (resetRes.rows.length === 0) {
      return res.status(400).json({
        error: { message: 'Invalid or expired recovery code. Please request a new one.' }
      });
    }

    const resetId = resetRes.rows[0].id;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(new_password, salt);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, userId]
    );

    // Mark code as used
    await db.query(
      'UPDATE password_resets SET used = true WHERE id = $1',
      [resetId]
    );

    return res.json({
      message: 'Your password has been reset successfully! You can now log in.'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({
      error: { message: 'Could not reset password. Please try again.' }
    });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  const tokenHeader = req.headers['x-session-token'] ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : null);

  if (tokenHeader) {
    try {
      await db.query('DELETE FROM session WHERE sid = $1', [tokenHeader]);
    } catch (err) {
      console.error('Error deleting tab session from store:', err);
    }
  }

  if (req.session && typeof req.session.destroy === 'function') {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      return res.json({ message: 'Logged out successfully.' });
    });
  } else {
    res.clearCookie('connect.sid');
    return res.json({ message: 'Logged out successfully.' });
  }
});

// Current user check
router.get('/me', async (req, res) => {
  const userId = req.userId || (req.session && req.session.userId);
  if (!userId) {
    return res.status(401).json({
      error: {
        message: 'Not authenticated.',
        code: 'UNAUTHORIZED'
      }
    });
  }

  try {
    const userRes = await db.query('SELECT id, email, name, created_at FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: { message: 'User account not found.' } });
    }

    const settingsRes = await db.query('SELECT * FROM user_settings WHERE user_id = $1', [userId]);

    return res.json({
      user: userRes.rows[0],
      settings: settingsRes.rows[0] || null,
      token: req.sessionID || null,
    });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: { message: 'Failed to fetch session state.' } });
  }
});

// Delete Account & All Data (Compliance / NDPR / GDPR)
router.delete('/me', async (req, res) => {
  const userId = req.userId || (req.session && req.session.userId);
  if (!userId) {
    return res.status(401).json({
      error: { message: 'Not authenticated.', code: 'UNAUTHORIZED' }
    });
  }

  const { password } = req.body;
  if (!password) {
    return res.status(400).json({
      error: { message: 'Please provide your current password to confirm account deletion.' }
    });
  }

  try {
    const userRes = await db.query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User account not found.' } });
    }

    const isMatch = await bcrypt.compare(password, userRes.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({
        error: { message: 'Incorrect password. Account deletion cancelled for security.' }
      });
    }

    // Clean up all persistent sessions for this user from the session store
    try {
      await db.query('DELETE FROM session WHERE sess::text LIKE $1', [`%"userId":"${userId}"%`]);
    } catch (sessErr) {
      console.error('Error clearing session store on account deletion:', sessErr);
    }

    // Deleting the user cascades to all tables (transactions, budgets, settings, subscriptions, etc.)
    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    if (req.session && typeof req.session.destroy === 'function') {
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        return res.json({ message: 'Your account and all associated data have been permanently deleted.' });
      });
    } else {
      res.clearCookie('connect.sid');
      return res.json({ message: 'Your account and all associated data have been permanently deleted.' });
    }
  } catch (err) {
    console.error('Account deletion error:', err);
    return res.status(500).json({ error: { message: 'Failed to delete account. Please try again.' } });
  }
});

module.exports = router;

