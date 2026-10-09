import type { Role } from '@app/shared';

/** Identity attached by the `requireAuth` middleware. */
export interface AuthContext {
  userId: string;
  role: Role;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
