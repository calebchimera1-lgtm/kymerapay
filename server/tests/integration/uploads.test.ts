import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { uploadRoot } from '../../src/providers/storage/index.js';
import { newBusinessInput, registerUser, type RegisteredUser } from '../helpers/auth.js';
import { resetDatabase } from '../helpers/db.js';

const app = createApp();
let caleb: RegisteredUser;

const png = (width = 800, height = 600) =>
  sharp({ create: { width, height, channels: 3, background: '#0f6b4f' } })
    .png()
    .toBuffer();

const upload = (
  user: { accessToken: string },
  urlPath: string,
  data: Buffer,
  filename = 'photo.png',
) =>
  request(app)
    .post(urlPath)
    .set('Authorization', `Bearer ${user.accessToken}`)
    .attach('file', data, filename);

const fileFor = (url: string) => path.join(uploadRoot, url.replace(/^\/uploads\//, ''));

beforeEach(async () => {
  await resetDatabase();
  caleb = await registerUser(app);
});

describe('avatar upload', () => {
  it('stores a 512×512 WebP and serves it with locked-down headers', async () => {
    const res = await upload(caleb, '/api/users/me/avatar', await png());
    expect(res.status).toBe(200);
    const url: string = res.body.data.avatarUrl;
    expect(url).toMatch(/^\/uploads\/avatars\/[0-9a-f-]{36}\.webp$/);

    const meta = await sharp(fileFor(url)).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 512, height: 512 });

    const served = await request(app).get(url);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/webp');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.headers['content-security-policy']).toContain('sandbox');
  });

  it('strips EXIF metadata such as GPS location', async () => {
    const jpeg = await sharp({
      create: { width: 400, height: 400, channels: 3, background: '#ffffff' },
    })
      .jpeg()
      .withExif({ IFD0: { Copyright: 'secret-location-marker' } })
      .toBuffer();
    expect(jpeg.includes('secret-location-marker')).toBe(true);

    const res = await upload(caleb, '/api/users/me/avatar', jpeg, 'me.jpg');
    const stored = await sharp(fileFor(res.body.data.avatarUrl)).metadata();
    expect(stored.exif).toBeUndefined();
  });

  it('replaces and deletes the previous file', async () => {
    const first = (await upload(caleb, '/api/users/me/avatar', await png())).body.data.avatarUrl;
    const second = (await upload(caleb, '/api/users/me/avatar', await png(300, 300))).body.data
      .avatarUrl;
    expect(second).not.toBe(first);
    expect(existsSync(fileFor(first))).toBe(false);
    expect(existsSync(fileFor(second))).toBe(true);

    const removed = await request(app)
      .delete('/api/users/me/avatar')
      .set('Authorization', `Bearer ${caleb.accessToken}`);
    expect(removed.body.data.avatarUrl).toBeNull();
    expect(existsSync(fileFor(second))).toBe(false);
  });

  it.each([
    [
      'an SVG (can carry script)',
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      'x.svg',
    ],
    ['text disguised as a PNG', Buffer.from('definitely not an image'), 'fake.png'],
    ['a truncated PNG', Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'), 'broken.png'],
  ])('rejects %s', async (_label, data, filename) => {
    const res = await upload(caleb, '/api/users/me/avatar', data, filename);
    expect(res.status).toBe(422);
  });

  it('rejects files over 2 MB', async () => {
    const res = await upload(caleb, '/api/users/me/avatar', Buffer.alloc(2 * 1024 * 1024 + 10, 1));
    expect(res.status).toBe(413);
  });

  it('requires a file', async () => {
    const res = await request(app)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${caleb.accessToken}`)
      .send();
    expect(res.status).toBe(422);
  });

  it('does not serve arbitrary paths', async () => {
    expect((await request(app).get('/uploads/../package.json')).status).toBe(404);
    expect((await request(app).get('/uploads/')).status).toBe(404);
  });
});

describe('business logo upload', () => {
  it('sets the logo, which then appears on the public profile', async () => {
    const created = await request(app)
      .post('/api/auth/register/business')
      .send(newBusinessInput({ username: 'logo_shop' }));
    const shop = { accessToken: created.body.data.accessToken };
    const res = await upload(shop, '/api/businesses/me/logo', await png());
    expect(res.body.data.business.logoUrl).toMatch(/^\/uploads\/logos\//);

    const card = await request(app)
      .get('/api/businesses/logo_shop')
      .set('Authorization', `Bearer ${caleb.accessToken}`);
    expect(card.body.data.avatarUrl).toBe(res.body.data.business.logoUrl);
  });

  it('is forbidden for personal accounts', async () => {
    expect((await upload(caleb, '/api/businesses/me/logo', await png())).status).toBe(403);
  });
});

describe('PATCH /api/users/me', () => {
  it('updates name and default visibility', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${caleb.accessToken}`)
      .send({ fullName: 'Caleb K. Chimera', defaultVisibility: 'FRIENDS' });
    expect(res.body.data).toMatchObject({
      fullName: 'Caleb K. Chimera',
      defaultVisibility: 'FRIENDS',
    });
  });

  it('ignores attempts to change protected fields', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${caleb.accessToken}`)
      .send({ fullName: 'Caleb', role: 'ADMIN', email: 'x@y.z', username: 'hacker' });
    expect(res.body.data).toMatchObject({ role: 'USER', username: caleb.input.username });
  });
});
