import type {
  ApiSuccess,
  AuthSession,
  AuthUser,
  LoginInput,
  RegisterBusinessInput,
  RegisterUserInput,
} from '@app/shared';
import { api, refreshSession, unwrap } from './api';

/** Auth endpoints never trigger the automatic refresh-and-retry. */
const noRefresh = { skipAuthRefresh: true } as const;

export const authService = {
  login: (input: LoginInput) =>
    unwrap(api.post<ApiSuccess<AuthSession>>('/auth/login', input, noRefresh)),

  register: (input: RegisterUserInput) =>
    unwrap(api.post<ApiSuccess<AuthSession>>('/auth/register', input, noRefresh)),

  registerBusiness: (input: RegisterBusinessInput) =>
    unwrap(api.post<ApiSuccess<AuthSession>>('/auth/register/business', input, noRefresh)),

  logout: () =>
    unwrap(api.post<ApiSuccess<{ signedOut: true }>>('/auth/logout', undefined, noRefresh)),

  me: () => unwrap(api.get<ApiSuccess<AuthUser>>('/users/me')),

  /** Restores the session from the refresh cookie on page load. */
  restore: refreshSession,
};
