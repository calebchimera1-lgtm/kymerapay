import { ERROR_CODES } from '@app/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { getRefreshCookie, login, registerUser } from '../helpers/auth.js';

const app = createApp();

beforeEach(resetDatabase);

describe('POST /api/auth/login', () => {
  it.each([
    ['e-mail', (u: { email: string }) => u.email.toUpperCase()],
    ['username', () => 'login_user'],
    ['@username', () => '@Login_User'],
    ['phone (07…)', () => '0711 222 333'],
    ['phone (+254…)', () => '+254711222333'],
  ])('signs in with %s', async (_label, identifierFor) => {
    const { input } = await registerUser(app, {
      username: 'login_user',
      email: 'login@example.test',
      phone: '0711222333',
    });
    const res = await login(app, identifierFor({ email: input.email }));

    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe('login_user');
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(getRefreshCookie(res)).toBeDefined();
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    const { input } = await registerUser(app);
    const wrongPassword = await login(app, input.username, 'Wrong12345');
    const unknownUser = await login(app, 'nobody_here', 'Wrong12345');

    for (const res of [wrongPassword, unknownUser]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(ERROR_CODES.INVALID_CREDENTIALS);
    }
    expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
  });

  it('locks the account after 5 failed attempts, even for the right password', async () => {
    const { input, userId } = await registerUser(app);

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      expect((await login(app, input.username, 'Wrong12345')).status).toBe(401);
    }
    const fifth = await login(app, input.username, 'Wrong12345');
    expect(fifth.status).toBe(423);
    expect(fifth.body.error.code).toBe(ERROR_CODES.ACCOUNT_LOCKED);

    const correct = await login(app, input.username);
    expect(correct.status).toBe(423);

    const audit = await prisma.auditLog.count({
      where: { actorId: userId, action: 'LOGIN_LOCKED' },
    });
    expect(audit).toBe(1);
  });

  it('unlocks once the lock period has passed and resets the counter', async () => {
    const { input, userId } = await registerUser(app);
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: new Date(Date.now() - 1000), failedLoginCount: 3 },
    });

    expect((await login(app, input.username)).status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.failedLoginCount).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(user.lastLoginAt).not.toBeNull();
  });

  it('blocks suspended accounts after verifying the password', async () => {
    const { input, userId } = await registerUser(app);
    await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });

    const res = await login(app, input.username);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.ACCOUNT_SUSPENDED);

    const wrong = await login(app, input.username, 'Wrong12345');
    expect(wrong.body.error.code).toBe(ERROR_CODES.INVALID_CREDENTIALS);
  });

  it('never lets the SYSTEM account sign in', async () => {
    const res = await login(app, 'system_treasury', 'anything123');
    expect(res.status).toBe(401);
  });

  it('notifies the user about a sign-in from a new device only', async () => {
    const { input, userId } = await registerUser(app);

    await login(app, input.username, undefined, 'device-aaaaaaaa');
    await login(app, input.username, undefined, 'device-aaaaaaaa');
    await login(app, input.username, undefined, 'device-bbbbbbbb');

    const alerts = await prisma.notification.findMany({
      where: { userId, type: 'SECURITY', title: 'New sign-in to your account' },
    });
    expect(alerts).toHaveLength(2);
    expect(alerts[0]!.body).toBe(
      'Your account was logged in from a new device. If this was not you, change your password now.',
    );
  });
});
