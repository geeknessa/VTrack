import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { createTestUser, cleanupUser, cleanupAllTestUsers, db } from '../test/helpers.js';

describe('Auth API Endpoints (/api/auth)', () => {
  beforeAll(async () => {
    await cleanupAllTestUsers();
  });

  afterAll(async () => {
    await cleanupAllTestUsers();
  });

  describe('POST /api/auth/register', () => {
    it('rejects registration with invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'notanemail', password: 'ValidPass123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.action).toBe('check_email');
    });

    it('rejects registration with weak password (missing uppercase or number)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test_weak@vtrack-test.com', password: 'weak' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.action).toBe('check_password');
    });

    it('registers a new user successfully and returns tab session token', async () => {
      const testEmail = `newuser_${Date.now()}@vtrack-test.com`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: 'SecurePassword123!',
          name: 'Testing Student',
          settings: {
            home_currency: 'NGN',
            period_type: 'monthly',
            base_income: 10000000
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testEmail.toLowerCase());
      expect(res.body.token).toBeDefined();
      expect(res.body.settings.home_currency).toBe('NGN');
    });

    it('prevents duplicate email registration', async () => {
      const existing = await createTestUser({ email: `dup_${Date.now()}@vtrack-test.com` });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: existing.user.email,
          password: 'AnotherPassword123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_IN_USE');
    });
  });

  describe('POST /api/auth/login', () => {
    it('rejects invalid password with 401', async () => {
      const existing = await createTestUser();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: existing.user.email,
          password: 'IncorrectPassword999'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('successfully logs in with valid credentials and issues token', async () => {
      const existing = await createTestUser({ password: 'CorrectPassword123!' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: existing.user.email,
          password: 'CorrectPassword123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(existing.user.email);
      expect(res.body.token).toBeDefined();
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns user profile when authenticated with x-session-token header', async () => {
      const testUser = await createTestUser({ name: 'Tab Isolated User' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('x-session-token', testUser.sessionToken);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(testUser.user.id);
      expect(res.body.user.name).toBe('Tab Isolated User');
      expect(res.body.settings).toBeDefined();
    });
  });

  describe('Password Recovery Workflow', () => {
    it('generates recovery code and resets password successfully', async () => {
      const testUser = await createTestUser({ password: 'OldPassword123!' });

      // Request recovery code
      const forgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.user.email });

      expect(forgotRes.status).toBe(200);

      // In test/dev environment, the 6-digit code or reset token is saved in password_resets table
      const codeRes = await db.query(
        'SELECT code FROM password_resets WHERE user_id = $1 AND used = false ORDER BY created_at DESC LIMIT 1',
        [testUser.user.id]
      );
      expect(codeRes.rows.length).toBeGreaterThan(0);
      const resetCode = codeRes.rows[0].code;

      // Submit reset password with code
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: testUser.user.email,
          code: resetCode,
          newPassword: 'BrandNewPassword123!'
        });

      expect(resetRes.status).toBe(200);

      // Verify user can now log in with the new password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.user.email,
          password: 'BrandNewPassword123!'
        });

      expect(loginRes.status).toBe(200);
    });
  });
});
