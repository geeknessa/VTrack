import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { createTestUser, cleanupUser, cleanupAllTestUsers, db } from '../test/helpers.js';

describe('Campus Menus & Food Logging API Endpoints (/api/menus)', () => {
  let testUser;

  beforeAll(async () => {
    testUser = await createTestUser({
      name: 'Menus Test Student',
      settings: {
        home_currency: 'NGN',
        base_income: 12000000
      }
    });
  });

  afterAll(async () => {
    await cleanupUser(testUser?.user?.id);
    await cleanupAllTestUsers();
  });

  describe('GET /api/menus/vendors', () => {
    it('returns authentic global campus vendors and excludes legacy mock vendors', async () => {
      const res = await request(app)
        .get('/api/menus/vendors')
        .set('x-session-token', testUser.sessionToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.vendors)).toBe(true);
      expect(res.body.vendors.length).toBeGreaterThan(0);

      const vendorNames = res.body.vendors.map(v => v.name);

      // Verify authentic campus vendors are present globally
      expect(vendorNames).toContain('Zulkys Cafe');
      expect(vendorNames).toContain('Street Food');
      expect(vendorNames).toContain('Pizza 360 Pro Max');

      // Verify old stub/mock vendors have been completely removed
      expect(vendorNames).not.toContain('Paprimz');
      expect(vendorNames).not.toContain('Roots');
      expect(vendorNames).not.toContain('Quick Bites & Grills');
    });
  });

  describe('GET /api/menus/items', () => {
    it('returns campus dishes with integer minor units (kobo)', async () => {
      const res = await request(app)
        .get('/api/menus/items')
        .set('x-session-token', testUser.sessionToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThan(10);

      // Verify price format on dishes with price
      const pricedDish = res.body.items.find(i => Number(i.price) > 0);
      expect(pricedDish).toBeDefined();
      expect(Number.isInteger(Number(pricedDish.price))).toBe(true);
      expect(Number(pricedDish.price)).toBeGreaterThan(0);
      expect(pricedDish.currency).toBe('NGN');
    });

    it('supports chunked loading with limit, offset, and pagination metadata', async () => {
      // Chunk 1: first 10 items
      const chunk1Res = await request(app)
        .get('/api/menus/items?limit=10&offset=0')
        .set('x-session-token', testUser.sessionToken);

      expect(chunk1Res.status).toBe(200);
      expect(chunk1Res.body.items.length).toBe(10);
      expect(chunk1Res.body.pagination).toBeDefined();
      expect(chunk1Res.body.pagination.total).toBeGreaterThan(500);
      expect(chunk1Res.body.pagination.limit).toBe(10);
      expect(chunk1Res.body.pagination.offset).toBe(0);
      expect(chunk1Res.body.pagination.has_more).toBe(true);
      expect(chunk1Res.body.pagination.next_offset).toBe(10);
      expect(chunk1Res.body.category_counts).toBeDefined();
      expect(chunk1Res.body.category_counts['Rice Dishes']).toBeGreaterThan(0);

      // Chunk 2: next 10 items (Load More...)
      const chunk2Res = await request(app)
        .get('/api/menus/items?limit=10&offset=10')
        .set('x-session-token', testUser.sessionToken);

      expect(chunk2Res.status).toBe(200);
      expect(chunk2Res.body.items.length).toBe(10);
      expect(chunk2Res.body.pagination.offset).toBe(10);

      // Verify chunk 1 and chunk 2 have distinct items
      const chunk1Ids = new Set(chunk1Res.body.items.map(i => i.id));
      const chunk2Ids = chunk2Res.body.items.map(i => i.id);
      for (const id of chunk2Ids) {
        expect(chunk1Ids.has(id)).toBe(false);
      }
    });

    it('supports section/category-specific chunking', async () => {
      const res = await request(app)
        .get('/api/menus/items?category=Rice+Dishes&limit=15&offset=0')
        .set('x-session-token', testUser.sessionToken);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(15);
      expect(res.body.pagination.has_more).toBe(true);
      for (const item of res.body.items) {
        expect(item.category).toBe('Rice Dishes');
      }
    });
  });

  describe('POST /api/menus/items/:id/log-expense', () => {
    it('logs a 1-tap food expense and links it to Food Court category', async () => {
      // Find a dish from Zulkys Cafe or any global vendor
      const itemRes = await db.query(
        `SELECT m.id, m.name, m.price, v.name as vendor_name
         FROM menu_items m
         JOIN food_vendors v ON m.vendor_id = v.id
         WHERE m.user_id IS NULL AND m.is_provisions = false AND m.price > 0
         LIMIT 1`
      );
      expect(itemRes.rows.length).toBeGreaterThan(0);
      const dish = itemRes.rows[0];

      const res = await request(app)
        .post(`/api/menus/items/${dish.id}/log-expense`)
        .set('x-session-token', testUser.sessionToken);

      expect(res.status).toBe(201);
      expect(res.body.transaction).toBeDefined();

      const tx = res.body.transaction;
      expect(Number(tx.amount)).toBe(Number(dish.price));
      expect(tx.type).toBe('expense');
      expect(tx.source_group).toBe('food_court');
      expect(tx.note).toContain(dish.name);
    });
  });

  describe('GET /api/menus/spoil-yourself', () => {
    it('computes safe cushion and returns weekend treat options', async () => {
      const res = await request(app)
        .get('/api/menus/spoil-yourself')
        .set('x-session-token', testUser.sessionToken);

      expect(res.status).toBe(200);
      expect(res.body.budget_cushion).toBeDefined();
      expect(typeof res.body.is_budget_safe).toBe('boolean');
      expect(Array.isArray(res.body.treats)).toBe(true);
    });
  });

  describe('POST /api/menus/auto-plan-week', () => {
    it('generates a 7-day multi-slot meal plan across campus dishes', async () => {
      const res = await request(app)
        .post('/api/menus/auto-plan-week')
        .set('x-session-token', testUser.sessionToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.plans)).toBe(true);
      // 7 days * 3 slots = 21 meal slots
      expect(res.body.plans.length).toBe(21);

      const slots = res.body.plans.map(p => p.meal_time);
      expect(slots).toContain('breakfast');
      expect(slots).toContain('lunch');
      expect(slots).toContain('dinner');
    });
  });
});
