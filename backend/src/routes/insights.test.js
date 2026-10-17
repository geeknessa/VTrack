import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { createTestUser, cleanupUser, cleanupAllTestUsers, db } from '../test/helpers.js';

describe('Insights API Endpoints (/api/insights)', () => {
  let testUser;

  beforeAll(async () => {
    testUser = await createTestUser({
      name: 'Insights Test Student',
      settings: {
        home_currency: 'NGN',
        base_income: 10000000
      }
    });
  });

  afterAll(async () => {
    await cleanupUser(testUser?.user?.id);
    await cleanupAllTestUsers();
  });

  it('correctly aggregates multi-currency transactions using converted home amounts', async () => {
    // 1. Log a ₦5,000 NGN food court expense (500,000 kobo)
    const foodCat = await db.query("SELECT id FROM categories WHERE name = 'Food Court' LIMIT 1");
    const foodCatId = foodCat.rows[0]?.id;

    await db.query(
      `INSERT INTO transactions (user_id, type, amount, currency, exchange_rate, converted_amount, category_id, occurred_at)
       VALUES ($1, 'expense', 500000, 'NGN', 1.0, 500000, $2, NOW())`,
      [testUser.user.id, foodCatId]
    );

    // 2. Log a $10.00 USD expense (1,000 minor units cents) converted at 1500 to ₦15,000 (1,500,000 kobo)
    await db.query(
      `INSERT INTO transactions (user_id, type, amount, currency, exchange_rate, converted_amount, category_id, occurred_at)
       VALUES ($1, 'expense', 1000, 'USD', 1500.0, 1500000, $2, NOW())`,
      [testUser.user.id, foodCatId]
    );

    // 3. Request Insights breakdown
    const res = await request(app)
      .get('/api/insights')
      .set('x-session-token', testUser.sessionToken);

    expect(res.status).toBe(200);
    expect(res.body.categories).toBeDefined();

    const foodCategory = res.body.categories.find(c => c.category_name === 'Food Court');
    expect(foodCategory).toBeDefined();

    // The total must be 500,000 + 1,500,000 = 2,000,000 kobo (NOT 501,000 kobo!)
    expect(foodCategory.total).toBe(2000000);
  });
});
