import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { createTestUser, cleanupUser, cleanupAllTestUsers, db } from '../test/helpers.js';

describe('Budgets API Endpoints (/api/budgets)', () => {
  let testUser;

  beforeAll(async () => {
    testUser = await createTestUser({
      name: 'Budget Test Student',
      settings: {
        base_income: 15000000, // ₦150,000.00
        opening_balance: 15000000
      }
    });
  });

  afterAll(async () => {
    await cleanupUser(testUser?.user?.id);
    await cleanupAllTestUsers();
  });

  it('returns has_budget: false when user has no active budget yet', async () => {
    const res = await request(app)
      .get('/api/budgets/active')
      .set('x-session-token', testUser.sessionToken);

    expect(res.status).toBe(200);
    expect(res.body.has_budget).toBe(false);
    expect(res.body.budget).toBeNull();
  });

  it('rejects budget creation when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/budgets')
      .set('x-session-token', testUser.sessionToken)
      .send({
        name: 'Incomplete Budget'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('successfully creates an active budget with category allocations', async () => {
    // Fetch Food Court category ID for allocation
    const catRes = await db.query(
      "SELECT id FROM categories WHERE name = 'Food Court' LIMIT 1"
    );
    const foodCatId = catRes.rows[0]?.id;

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000); // 14-day cycle

    const payload = {
      name: 'Mid-Semester 2-Week Budget',
      cycle_type: 'biweekly',
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      total_amount: 8000000, // ₦80,000.00
      daily_limit: 571428,   // ~₦5,714.28
      savings_target: 1000000, // ₦10,000.00
      allocations: foodCatId ? [
        { category_id: foodCatId, allocated_amount: 3500000 } // ₦35,000.00
      ] : []
    };

    const res = await request(app)
      .post('/api/budgets')
      .set('x-session-token', testUser.sessionToken)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.budget).toBeDefined();
    expect(res.body.budget.name).toBe('Mid-Semester 2-Week Budget');
    expect(Number(res.body.budget.total_amount)).toBe(8000000);
  });

  it('retrieves active budget with calculated remaining and daily runway', async () => {
    // Add a test expense transaction in this cycle
    const nowIso = new Date().toISOString();
    await db.query(
      `INSERT INTO transactions (user_id, type, amount, currency, converted_amount, note, occurred_at)
       VALUES ($1, 'expense', 1500000, 'NGN', 1500000, 'Campus Supermarket', $2)`,
      [testUser.user.id, nowIso]
    );

    const res = await request(app)
      .get('/api/budgets/active')
      .set('x-session-token', testUser.sessionToken);

    expect(res.status).toBe(200);
    expect(res.body.has_budget).toBe(true);
    expect(res.body.budget).toBeDefined();

    const b = res.body.budget;
    expect(b.total_amount).toBe(8000000);
    expect(b.spent).toBe(1500000); // ₦15,000.00
    expect(b.remaining).toBe(6500000); // 80,000.00 - 15,000.00 = ₦65,000.00
    expect(b.daily).toBeDefined();
    expect(b.daily.limit).toBeGreaterThan(0);
  });

  it('provides automated budget proposals via /api/budgets/suggest', async () => {
    const res = await request(app)
      .post('/api/budgets/suggest')
      .set('x-session-token', testUser.sessionToken)
      .send({
        cycle_type: 'monthly',
        total_funds: 12000000 // ₦120,000.00
      });

    expect(res.status).toBe(200);
    expect(res.body.suggestion).toBeDefined();
    expect(res.body.suggestion.total_funds).toBe(12000000);
    expect(Array.isArray(res.body.suggestion.allocations)).toBe(true);
    expect(res.body.suggestion.allocations.length).toBeGreaterThan(0);
  });
});
