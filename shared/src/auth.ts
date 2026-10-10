import type { BusinessCategory, Role, UserStatus, Visibility } from './enums.js';

export interface BusinessSummary {
  id: string;
  businessName: string;
  category: BusinessCategory;
  location: string;
  description: string | null;
  logoUrl: string | null;
  isVerified: boolean;
  /** Owner-only placeholder for a future business registration number. */
  registrationNumber: string | null;
}

/** The signed-in account as returned by `/auth/*` and `GET /users/me`. Never contains secrets. */
export interface AuthUser {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  avatarUrl: string | null;
  isDemo: boolean;
  defaultVisibility: Visibility;
  createdAt: string;
  business: BusinessSummary | null;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  /** ISO timestamp when the access token expires. */
  accessTokenExpiresAt: string;
}
