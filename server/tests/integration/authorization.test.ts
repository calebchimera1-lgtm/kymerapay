import { ERROR_CODES } from '@app/shared';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { requireAuth, requireRole } from '../../src/middleware/authenticate.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { createSession } from '../../src/services/session.service.js';
import { signAccessToken } from '../../src/services/token.service.js';
import { hashSecret } from '../../src/utils/password.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { registerUser, TEST_PIN } from '../helpers/auth.js';

const app = createApp();

/** A throwaway app with role-protected routes, to test the middleware in isolation. */
const guarded = express();
guarded.get('/admin-only', requireAuth, requireRole('ADMIN'), (_req, res) => {
  res.json({ ok: true });
});
guarded.get('/business-or-admin', requireAuth, requireRole('BUSINESS', 'ADMIN'), (_req, res) => {
  res.json({ ok: true });
});
guarded.use(errorHandler);

async function adminToken(): Promise<string> {
  const admin = await prisma.user.create({
    data: {
      fullName: 'Demo Admin',
      username: 'demo_admin',
      email: 'admin@example.test',
      passwordHash: await hashSecret('AdminPass2026'),
      role: 'ADMIN',
    },
  });
  const ctx = { ip: null, userAgent: null, requestId: 'test', deviceId: null };
  const { session } = await createSession(prisma, admin.id, ctx);
  return signAccessToken({
    userId: admin.id,
    role: 'ADMIN',
    sessionId: session.id,
    tokenVersion: 0,
  }).token;
}

beforeEach(resetDatabase);

describe('requireRole', () => {
  it('forbids a USER from admin routes', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(guarded)
      .get('/admin-only')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it('allows an ADMIN', async () => {
    const token = await adminToken();
    const res = await request(guarded).get('/admin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('accepts any of several roles', async () => {
    const token = await adminToken();
    const res = await request(guarded)
      .get('/business-or-admin')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('uses the role stored in the database, not the one in the token', async () => {
    const { userId } = await registerUser(app);
    const session = await prisma.session.findFirstOrThrow({ where: { userId } });
    // A token that *claims* ADMIN for a USER account (e.g. issued before a demotion).
    const { token } = signAccessToken({
      userId,
      role: 'ADMIN',
      sessionId: session.id,
      tokenVersion: 0,
    });

    const res = await request(guarded).get('/admin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('requires authentication first', async () => {
    expect((await request(guarded).get('/admin-only')).status).toBe(401);
  });
});

describe('POST /api/auth/pin/verify', () => {
  const verify = (token: string, pin: string) =>
    request(app).post('/api/auth/pin/verify').set('Authorization', `Bearer ${token}`).send({ pin });

  it('accepts the correct PIN', async () => {
    const { accessToken } = await registerUser(app);
    const res = await verify(accessToken, TEST_PIN);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ verified: true });
  });

  it('counts down attempts and pauses payments after 5 wrong PINs', async () => {
    const { accessToken, userId } = await registerUser(app);

    const first = await verify(accessToken, '9999');
    expect(first.status).toBe(403);
    expect(first.body.error).toMatchObject({
      code: ERROR_CODES.INVALID_PIN,
      message: 'Incorrect PIN. 4 attempts left.',
    });

    for (let i = 0; i < 3; i += 1) await verify(accessToken, '9999');
    const fifth = await verify(accessToken, '9999');
    expect(fifth.status).toBe(423);
    expect(fifth.body.error.code).toBe(ERROR_CODES.PIN_LOCKED);

    // Even the correct PIN is refused while locked.
    expect((await verify(accessToken, TEST_PIN)).status).toBe(423);
    expect(await prisma.auditLog.count({ where: { actorId: userId, action: 'PIN_LOCKED' } })).toBe(
      1,
    );
  });

  it('resets the failure counter after a correct PIN', async () => {
    const { accessToken, userId } = await registerUser(app);
    await verify(accessToken, '9999');
    await verify(accessToken, TEST_PIN);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.failedPinCount).toBe(0);
  });

  it('does not lock the password when the PIN locks (separate counters)', async () => {
    const { accessToken, input } = await registerUser(app);
    for (let i = 0; i < 5; i += 1) await verify(accessToken, '9999');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: input.username, password: input.password });
    expect(res.status).toBe(200);
  });

  it('rejects a malformed PIN with a validation error', async () => {
    const { accessToken } = await registerUser(app);
    expect((await verify(accessToken, '12')).status).toBe(422);
  });
});
