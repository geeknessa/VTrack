import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { createTestUser, cleanupUser, cleanupAllTestUsers, db } from '../test/helpers.js';

describe('Transactions & FX API Endpoints (/api/transactions)', () => {
  let testUser;

  beforeAll(async () => {
    testUser = await createTestUser({
      name: 'Transactions Test Student',
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

  it('rejects transaction creation when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('x-session-token', testUser.sessionToken)
      .send({ amount: 50000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('creates an expense in home currency (NGN) with 1.0 exchange rate', async () => {
    const catRes = await db.query(
      "SELECT id FROM categories WHERE name = 'Transport & Commute' LIMIT 1"
    );
    const transportCatId = catRes.rows[0]?.id;

    const res = await request(app)
      .post('/api/transactions')
      .set('x-session-token', testUser.sessionToken)
      .send({
        type: 'expense',
        amount: 300000, // ₦3,000.00 in minor units
        currency: 'NGN',
        category_id: transportCatId,
        note: 'Campus Shuttle Bus'
      });

    expect(res.status).toBe(201);
    expect(res.body.transaction).toBeDefined();
    const tx = res.body.transaction;
    expect(Number(tx.amount)).toBe(300000);
    expect(Number(tx.exchange_rate)).toBe(1.0);
    expect(Number(tx.converted_amount)).toBe(300000);
    expect(tx.currency).toBe('NGN');
  });

  it('accurately converts foreign currency (USD) to home currency (NGN)', async () => {
    // $10.00 = 1000 cents with custom rate of 1500 NGN/USD -> 1,500,000 kobo (₦15,000.00)
    const res = await request(app)
      .post('/api/transactions')
      .set('x-session-token', testUser.sessionToken)
      .send({
        type: 'expense',
        amount: 1000, // 1000 cents ($10.00)
        currency: 'USD',
        exchange_rate: 1500.0,
        note: 'Online Research Paper Access'
      });

    expect(res.status).toBe(201);
    const tx = res.body.transaction;
    expect(Number(tx.amount)).toBe(1000);
    expect(tx.currency).toBe('USD');
    expect(Number(tx.exchange_rate)).toBe(1500.0);
    expect(Number(tx.converted_amount)).toBe(1500000); // 1,500,000 kobo
  });

  it('creates an income transaction and calculates accurate summary', async () => {
    await request(app)
      .post('/api/transactions')
      .set('x-session-token', testUser.sessionToken)
      .send({
        type: 'income',
        amount: 5000000, // ₦50,000.00
        currency: 'NGN',
        note: 'Monthly Allowance from Sponsor'
      });

    const res = await request(app)
      .get('/api/transactions/summary')
      .set('x-session-token', testUser.sessionToken);

    expect(res.status).toBe(200);
    expect(res.body.income).toBe(5000000);
    // Expense should be 300,000 (transport) + 1,500,000 (converted USD paper) = 1,800,000
    expect(res.body.expense).toBe(1800000);
  });

  it('updates an existing transaction and recomputes converted amount', async () => {
    // Create a transaction to edit
    const createRes = await request(app)
      .post('/api/transactions')
      .set('x-session-token', testUser.sessionToken)
      .send({
        type: 'expense',
        amount: 200000, // ₦2,000.00
        currency: 'NGN',
        note: 'Original Note'
      });

    const txId = createRes.body.transaction.id;

    // Edit transaction to ₦2,500.00
    const updateRes = await request(app)
      .put(`/api/transactions/${txId}`)
      .set('x-session-token', testUser.sessionToken)
      .send({
        amount: 250000,
        note: 'Updated Grocery Note'
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.transaction.note).toBe('Updated Grocery Note');
    expect(Number(updateRes.body.transaction.amount)).toBe(250000);
    expect(Number(updateRes.body.transaction.converted_amount)).toBe(250000);
  });

  it('deletes a transaction cleanly and prevents unauthorized access', async () => {
    const createRes = await request(app)
      .post('/api/transactions')
      .set('x-session-token', testUser.sessionToken)
      .send({
        type: 'expense',
        amount: 100000,
        currency: 'NGN',
        note: 'To be deleted'
      });

    const txId = createRes.body.transaction.id;

    // Delete it
    const delRes = await request(app)
      .delete(`/api/transactions/${txId}`)
      .set('x-session-token', testUser.sessionToken);

    expect(delRes.status).toBe(200);

    // Verify it is gone
    const checkRes = await request(app)
      .delete(`/api/transactions/${txId}`)
      .set('x-session-token', testUser.sessionToken);

    expect(checkRes.status).toBe(404);
  });

  it('exports transactions to CSV with proper MIME type and formatted values', async () => {
    const res = await request(app)
      .get('/api/transactions/export')
      .set('x-session-token', testUser.sessionToken);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment; filename="vtrack_transactions_');

    // Verify CSV header and content
    const csvContent = res.text;
    expect(csvContent).toContain('Transaction ID,Date & Time (UTC),Type,Category');
    expect(csvContent).toContain('"expense"');
    expect(csvContent).toContain('"income"');
  });

  it('batch imports multiple transactions at once', async () => {
    const res = await request(app)
      .post('/api/transactions/batch')
      .set('x-session-token', testUser.sessionToken)
      .send({
        transactions: [
          {
            type: 'expense',
            amount: 250000, // ₦2,500.00
            currency: 'NGN',
            note: 'Cherry African Kitchen - Jollof Rice'
          },
          {
            type: 'expense',
            amount: 150000, // ₦1,500.00
            currency: 'NGN',
            note: 'Campus Shuttle Pass'
          }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(2);
    expect(res.body.transactions.length).toBe(2);
  });

  it('rejects ai-scan when image data is missing', async () => {
    const res = await request(app)
      .post('/api/transactions/ai-scan')
      .set('x-session-token', testUser.sessionToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
