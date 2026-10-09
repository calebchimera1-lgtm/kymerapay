import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { registerUser, type RegisteredUser } from '../helpers/auth.js';
import { prisma, resetDatabase } from '../helpers/db.js';

const app = createApp();
let caleb: RegisteredUser;

const search = (q: string, user = caleb) =>
  request(app)
    .get('/api/users/search')
    .query({ q })
    .set('Authorization', `Bearer ${user.accessToken}`);

beforeEach(async () => {
  await resetDatabase();
  caleb = await registerUser(app, { username: 'caleb254', fullName: 'Caleb Chimera' });
  await registerUser(app, { username: 'john254', fullName: 'John Kamau' });
  await registerUser(app, { username: 'johnny_k', fullName: 'Johnny Kiprono' });
  await registerUser(app, { username: 'mary254', fullName: 'Mary Johnson' });
});

describe('GET /api/users/search', () => {
  it('matches username prefixes and names', async () => {
    const res = await search('john');
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { username: string }) => p.username)).toEqual([
      'john254',
      'johnny_k',
      'mary254',
    ]);
  });

  it('accepts a leading @', async () => {
    const res = await search('@john2');
    expect(res.body.data.map((p: { username: string }) => p.username)).toEqual(['john254']);
  });

  it('never returns private fields', async () => {
    const res = await search('john');
    expect(res.body.data[0]).toEqual({
      id: expect.any(String),
      kind: 'person',
      displayName: 'John Kamau',
      username: 'john254',
      avatarUrl: null,
      businessCategory: null,
      isVerified: false,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/@example\.test|\+254|balance|status/);
  });

  it('excludes the caller, suspended accounts, admins and the system account', async () => {
    await prisma.user.update({ where: { username: 'mary254' }, data: { status: 'SUSPENDED' } });
    expect((await search('caleb')).body.data).toEqual([]);
    expect((await search('mary')).body.data).toEqual([]);
    expect((await search('system')).body.data).toEqual([]);
  });

  it('treats SQL wildcards literally', async () => {
    expect((await search('%%')).body.data).toEqual([]);
    expect((await search('__')).body.data).toEqual([]);
  });

  it('requires at least 2 characters', async () => {
    expect((await search('j')).status).toBe(422);
  });
});

describe('GET /api/users/:username', () => {
  it('returns a public profile', async () => {
    const res = await request(app)
      .get('/api/users/john254')
      .set('Authorization', `Bearer ${caleb.accessToken}`);
    expect(res.body.data).toMatchObject({
      username: 'john254',
      displayName: 'John Kamau',
      kind: 'person',
    });
  });

  it('404s for unknown and suspended accounts', async () => {
    await prisma.user.update({ where: { username: 'mary254' }, data: { status: 'SUSPENDED' } });
    for (const username of ['nobody_here', 'mary254']) {
      const res = await request(app)
        .get(`/api/users/${username}`)
        .set('Authorization', `Bearer ${caleb.accessToken}`);
      expect(res.status).toBe(404);
    }
  });

  it('does not shadow /users/me', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${caleb.accessToken}`);
    expect(res.body.data.email).toBeDefined();
  });
});
