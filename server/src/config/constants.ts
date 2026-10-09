/**
 * Fixed identifiers for the platform's internal accounts. The SYSTEM user owns
 * the treasury wallet — the issuer of all simulated money — and can never sign in.
 */
export const SYSTEM_ACCOUNT = {
  username: 'system_treasury',
  fullName: 'Demo Treasury (System)',
  email: 'treasury@system.invalid',
} as const;

export const CURRENCY = 'KES' as const;
