import type { RegisterBusinessInput, RegisterUserInput } from '@app/shared';
import type { Express } from 'express';
import request, { type Response } from 'supertest';

export const TEST_PASSWORD = 'Sunrise2026';
export const TEST_PIN = '4826';
export const CSRF_HEADER = { 'X-Requested-With': 'XMLHttpRequest' } as const;

let sequence = 0;

/** Valid, unique registration input. Unique within a test run. */
export function newUserInput(overrides: Partial<RegisterUserInput> = {}): RegisterUserInput {
  sequence += 1;
  return {
    fullName: 'Test Person',
    username: `tester${sequence}`,
    email: `tester${sequence}@example.test`,
    phone: `0712${String(sequence).padStart(6, '0')}`,
    password: TEST_PASSWORD,
    pin: TEST_PIN,
    ...overrides,
  };
}

export function newBusinessInput(
  overrides: Partial<RegisterBusinessInput> = {},
): RegisterBusinessInput {
  sequence += 1;
  return {
    businessName: 'Visible General Supplies Ltd',
    category: 'RETAIL',
    location: 'Nairobi CBD',
    description: 'Hardware and general supplies.',
    username: `shop${sequence}`,
    email: `shop${sequence}@example.test`,
    phone: `0113${String(sequence).padStart(6, '0')}`,
    password: TEST_PASSWORD,
    pin: TEST_PIN,
    ...overrides,
  };
}

/** `refresh_token=<value>` from a response's Set-Cookie header, if present. */
export function getRefreshCookie(res: Response): string | undefined {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  const raw = cookies?.find((cookie) => cookie.startsWith('refresh_token='));
  const pair = raw?.split(';')[0];
  return pair && pair !== 'refresh_token=' ? pair : undefined;
}

export interface RegisteredUser {
  input: RegisterUserInput;
  userId: string;
  accessToken: string;
  refreshCookie: string;
}

export async function registerUser(
  app: Express,
  overrides: Partial<RegisterUserInput> = {},
): Promise<RegisteredUser> {
  const input = newUserInput(overrides);
  const res = await request(app).post('/api/auth/register').send(input);
  if (res.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(res.body)}`);
  return {
    input,
    userId: res.body.data.user.id,
    accessToken: res.body.data.accessToken,
    refreshCookie: getRefreshCookie(res)!,
  };
}

export function login(
  app: Express,
  identifier: string,
  password = TEST_PASSWORD,
  deviceId?: string,
) {
  const req = request(app).post('/api/auth/login');
  if (deviceId) req.set('X-Device-Id', deviceId);
  return req.send({ identifier, password });
}

export function refresh(app: Express, cookie: string) {
  return request(app).post('/api/auth/refresh').set('Cookie', cookie).set(CSRF_HEADER).send();
}

export function getMe(app: Express, accessToken: string) {
  return request(app).get('/api/users/me').set('Authorization', `Bearer ${accessToken}`);
}
