import { ERROR_CODES } from '@app/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

const app = createApp();
const ALLOWED_ORIGIN = 'http://localhost:5173';

describe('system endpoints', () => {
  it('GET /api/health reports ok, demo mode and a reachable database', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      status: 'ok',
      demoMode: true,
      checks: { api: 'ok', database: 'ok' },
    });
  });

  it('GET /api/config/public exposes only non-secret configuration', async () => {
    const res = await request(app).get('/api/config/public');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      demoMode: true,
      demoBannerText: 'DEMO MODE — NO REAL MONEY',
      disclaimer: 'Demo environment. No real money is transferred.',
      currency: 'KES',
    });
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(process.env.JWT_SECRET);
    expect(serialized).not.toContain('postgresql://');
  });
});

describe('error handling', () => {
  it('returns a structured 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: ERROR_CODES.NOT_FOUND,
        message: expect.any(String),
        requestId: expect.any(String),
      },
    });
  });

  it('rejects malformed JSON without leaking parser internals', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.INVALID_JSON);
    expect(JSON.stringify(res.body)).not.toMatch(/SyntaxError|at JSON\.parse|node_modules/);
  });

  it('rejects oversized payloads', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ blob: 'x'.repeat(200 * 1024) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe(ERROR_CODES.PAYLOAD_TOO_LARGE);
  });
});

describe('request correlation', () => {
  it('generates a request id and echoes it in the response', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps a safe caller-supplied request id', async () => {
    const res = await request(app).get('/api/health').set('X-Request-Id', 'abc12345-trace');
    expect(res.headers['x-request-id']).toBe('abc12345-trace');
  });

  it('replaces an unsafe caller-supplied request id', async () => {
    const unsafe = '<script>alert(1)</script> forged=entry';
    const res = await request(app).get('/api/health').set('X-Request-Id', unsafe);
    expect(res.headers['x-request-id']).not.toBe(unsafe);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('security headers & CORS', () => {
  it('sets helmet headers and hides the framework', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('allows the configured client origin with credentials', async () => {
    const res = await request(app).get('/api/health').set('Origin', ALLOWED_ORIGIN);

    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not grant CORS to unknown origins', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers preflight requests for the idempotency header', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Idempotency-Key,Authorization');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-headers']).toContain('Idempotency-Key');
  });
});
