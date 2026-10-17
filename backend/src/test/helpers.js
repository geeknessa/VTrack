const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');

/**
 * Creates an isolated test user with settings and a valid active session.
 */
async function createTestUser(overrides = {}) {
  const randomSuffix = crypto.randomBytes(6).toString('hex');
  const email = overrides.email || `test_${randomSuffix}@vtrack-test.com`;
  const rawPassword = overrides.password || 'TestPass123!';
  const name = overrides.name || `Test User ${randomSuffix}`;
  
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(rawPassword, salt);

  const userRes = await db.query(
    'INSERT INTO users (email, password_hash, name) VALUES (LOWER($1), $2, $3) RETURNING id, email, name, created_at',
    [email, passwordHash, name]
  );
  const user = userRes.rows[0];

  const settings = overrides.settings || {};
  await db.query(
    `INSERT INTO user_settings 
     (user_id, home_currency, period_type, main_goal, expected_next_income_date, opening_balance, base_income, onboarding_completed) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id) DO UPDATE SET
       home_currency = EXCLUDED.home_currency,
       period_type = EXCLUDED.period_type`,
    [
      user.id,
      settings.home_currency || 'NGN',
      settings.period_type || 'monthly',
      settings.main_goal || 'see_spending',
      settings.expected_next_income_date || null,
      settings.opening_balance || 5000000, // ₦50,000.00 in minor units
      settings.base_income || 5000000,
      true
    ]
  );

  // Generate an isolated session token
  const sessionToken = `test_sess_${crypto.randomBytes(16).toString('hex')}`;
  const sessData = {
    cookie: {
      originalMaxAge: 30 * 24 * 60 * 60 * 1000,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      httpOnly: true,
      path: '/'
    },
    userId: user.id
  };

  await db.query(
    `INSERT INTO session (sid, sess, expire)
     VALUES ($1, $2, NOW() + INTERVAL '30 days')
     ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = NOW() + INTERVAL '30 days'`,
    [sessionToken, JSON.stringify(sessData)]
  );

  return {
    user,
    sessionToken,
    password: rawPassword,
    authHeaders: {
      'x-session-token': sessionToken
    }
  };
}

/**
 * Removes a specific test user and all cascaded data.
 */
async function cleanupUser(userId) {
  if (!userId) return;
  try {
    await db.query('DELETE FROM session WHERE sess::text LIKE $1', [`%"userId":"${userId}"%`]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
  } catch (err) {
    console.error(`Error cleaning up test user ${userId}:`, err);
  }
}

/**
 * Cleans up all test users created matching the test domain.
 */
async function cleanupAllTestUsers() {
  try {
    const res = await db.query("SELECT id FROM users WHERE email LIKE '%@vtrack-test.com'");
    for (const row of res.rows) {
      await cleanupUser(row.id);
    }
  } catch (err) {
    console.error('Error cleaning up test users:', err);
  }
}

module.exports = {
  createTestUser,
  cleanupUser,
  cleanupAllTestUsers,
  db
};
