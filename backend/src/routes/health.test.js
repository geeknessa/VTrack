import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index.js';

describe('Production Health & Security Headers (/api/health)', () => {
  it('returns database connection status and service uptime', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('VTrack JSON API');
    expect(res.body.database).toBe('connected');
    expect(typeof res.body.uptime_seconds).toBe('number');
    expect(res.body.timestamp).toBeDefined();
  });

  it('includes production HTTP security headers set by helmet', async () => {
    const res = await request(app).get('/api/health');

    // Helmet security headers verification
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-download-options']).toBe('noopen');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-xss-protection']).toBe('0');
  });

  it('handles unknown API endpoints with clean JSON 404 message', async () => {
    const res = await request(app).get('/api/non-existent-endpoint');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.action).toBe('check_endpoint');
  });
});
