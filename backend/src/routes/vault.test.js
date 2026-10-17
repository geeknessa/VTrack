import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { createTestUser, cleanupUser, cleanupAllTestUsers, db } from '../test/helpers.js';

describe('Vault (Piggybank) API Endpoints (/api/vault)', () => {
  let testUser;

  beforeAll(async () => {
    testUser = await createTestUser({
      name: 'Vault Test Student',
      settings: {
        home_currency: 'NGN',
        opening_balance: 10000000
      }
    });
  });

  afterAll(async () => {
    await cleanupUser(testUser?.user?.id);
    await cleanupAllTestUsers();
  });

  it('stashes funds in home currency and increments vault balance', async () => {
    const res = await request(app)
      .post('/api/vault/stash')
      .set('x-session-token', testUser.sessionToken)
      .send({
        amount: 2500000, // ₦25,000.00
        currency: 'NGN'
      });

    expect(res.status).toBe(200);
    expect(res.body.vault_balance).toBe(2500000);
  });

  it('stashes foreign currency with FX conversion into home currency', async () => {
    // $10.00 USD (1,000 cents) at custom rate 1500 = ₦15,000.00 (1,500,000 kobo)
    const res = await request(app)
      .post('/api/vault/stash')
      .set('x-session-token', testUser.sessionToken)
      .send({
        amount: 1000,
        currency: 'USD',
        exchange_rate: 1500.0
      });

    expect(res.status).toBe(200);
    // Previous balance 2,500,000 + 1,500,000 = 4,000,000
    expect(res.body.vault_balance).toBe(4000000);
  });

  it('withdraws funds back to spending balance and prevents overdrawing', async () => {
    // Withdraw ₦10,000.00 (1,000,000 kobo)
    const res = await request(app)
      .post('/api/vault/withdraw')
      .set('x-session-token', testUser.sessionToken)
      .send({
        amount: 1000000,
        currency: 'NGN'
      });

    expect(res.status).toBe(200);
    // 4,000,000 - 1,000,000 = 3,000,000
    expect(res.body.vault_balance).toBe(3000000);

    // Attempt to withdraw more than available balance (e.g. ₦100,000.00)
    const overdrawRes = await request(app)
      .post('/api/vault/withdraw')
      .set('x-session-token', testUser.sessionToken)
      .send({
        amount: 10000000,
        currency: 'NGN'
      });

    expect(overdrawRes.status).toBe(400);
    expect(overdrawRes.body.error).toBeDefined();
  });
});
