import { ERROR_CODES } from '@app/shared';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { CSRF_HEADER, getMe, getRefreshCookie, refresh, registerUser } from '../helpers/auth.js';

const app = createApp();

beforeEach(resetDatabase);

describe('GET /api/users/me', () => {
  it('returns the signed-in user', async () => {
    const { accessToken, input } = await registerUser(app);
    const res = await getMe(app, accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe(input.username);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it.each([
    ['no header', undefined],
    ['a malformed header', 'Token abc'],
    ['a garbage token', 'Bearer not.a.jwt'],
  ])('rejects %s', async (_label, header) => {
    const req = request(app).get('/api/users/me');
    if (header) req.set('Authorization', header);
    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHENTICATED);
  });

  it('rejects a token signed with another secret', async () => {
    const { accessToken } = await registerUser(app);
    const claims = jwt.decode(accessToken) as jwt.JwtPayload;
    const forged = jwt.sign({ ...claims, role: 'ADMIN' }, 'attacker-secret-attacker-secret-0123');
    expect((await getMe(app, forged)).status).toBe(401);
  });

  it('reports an expired token distinctly so the client can refresh', async () => {
    const { accessToken } = await registerUser(app);
    const { exp: _exp, iat: _iat, ...claims } = jwt.decode(accessToken) as jwt.JwtPayload;
    const expired = jwt.sign(
      { ...claims, exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET!,
    );

    const res = await getMe(app, expired);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.TOKEN_EXPIRED);
  });

  it('rejects a valid token once the account is suspended', async () => {
    const { accessToken, userId } = await registerUser(app);
    await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });

    const res = await getMe(app, accessToken);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.ACCOUNT_SUSPENDED);
  });

  it('rejects tokens issued before a token-version bump', async () => {
    const { accessToken, userId } = await registerUser(app);
    await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    expect((await getMe(app, accessToken)).status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    const { refreshCookie } = await registerUser(app);
    const res = await refresh(app, refreshCookie);

    expect(res.status).toBe(200);
    const rotated = getRefreshCookie(res);
    expect(rotated).toBeDefined();
    expect(rotated).not.toBe(refreshCookie);
    expect((await getMe(app, res.body.data.accessToken)).status).toBe(200);
  });

  it('requires the CSRF header', async () => {
    const { refreshCookie } = await registerUser(app);
    const res = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie).send();
    expect(res.status).toBe(403);
  });

  it('rejects a foreign Origin', async () => {
    const { refreshCookie } = await registerUser(app);
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie)
      .set(CSRF_HEADER)
      .set('Origin', 'https://evil.example')
      .send();
    expect(res.status).toBe(403);
  });

  it('rejects a missing or unknown cookie and clears it', async () => {
    const missing = await request(app).post('/api/auth/refresh').set(CSRF_HEADER).send();
    expect(missing.status).toBe(401);

    const unknown = await refresh(app, 'refresh_token=not-a-real-token');
    expect(unknown.status).toBe(401);
    const cleared = (unknown.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cleared).toMatch(/refresh_token=;/);
  });

  it('treats a near-simultaneous second refresh as a benign race', async () => {
    const { refreshCookie } = await registerUser(app);
    const [first, second] = await Promise.all([
      refresh(app, refreshCookie),
      refresh(app, refreshCookie),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await getMe(app, second.body.data.accessToken)).status).toBe(200);
  });

  it('detects reuse of an old token and revokes the whole session family', async () => {
    const { refreshCookie, userId } = await registerUser(app);
    const firstRotation = await refresh(app, refreshCookie);
    const newCookie = getRefreshCookie(firstRotation)!;

    // Simulate an attacker replaying the stolen original token after the grace window.
    await prisma.session.updateMany({
      where: { userId, revokedReason: 'ROTATED' },
      data: { revokedAt: new Date(Date.now() - 5 * 60_000) },
    });

    const replay = await refresh(app, refreshCookie);
    expect(replay.status).toBe(401);

    // The legitimate holder of the rotated token is signed out too.
    expect((await refresh(app, newCookie)).status).toBe(401);
    expect((await getMe(app, firstRotation.body.data.accessToken)).status).toBe(401);

    expect(
      await prisma.auditLog.count({ where: { actorId: userId, action: 'SESSION_REUSE_DETECTED' } }),
    ).toBe(1);
    expect(await prisma.notification.count({ where: { userId, type: 'SECURITY' } })).toBe(1);
  });

  it('rejects an expired session', async () => {
    const { refreshCookie, userId } = await registerUser(app);
    await prisma.session.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await refresh(app, refreshCookie)).status).toBe(401);
  });

  it('refuses to refresh a suspended account', async () => {
    const { refreshCookie, userId } = await registerUser(app);
    await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });

    const res = await refresh(app, refreshCookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.ACCOUNT_SUSPENDED);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the session so neither token works afterwards', async () => {
    const { refreshCookie, accessToken, userId } = await registerUser(app);
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', refreshCookie)
      .set(CSRF_HEADER)
      .send();

    expect(res.status).toBe(200);
    expect((res.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(/refresh_token=;/);
    expect((await getMe(app, accessToken)).status).toBe(401);
    expect((await refresh(app, refreshCookie)).status).toBe(401);
    expect(await prisma.auditLog.count({ where: { actorId: userId, action: 'LOGOUT' } })).toBe(1);
  });

  it('succeeds even without a session (idempotent)', async () => {
    const res = await request(app).post('/api/auth/logout').set(CSRF_HEADER).send();
    expect(res.status).toBe(200);
  });
});
