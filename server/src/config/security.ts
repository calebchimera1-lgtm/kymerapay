/** Authentication and session policy. Tuned for a consumer wallet. */
export const SECURITY = {
  /** Failed password attempts before the account is temporarily locked. */
  maxFailedLogins: 5,
  loginLockMinutes: 15,
  /** Failed PIN attempts before money movement is temporarily blocked. */
  maxFailedPins: 5,
  pinLockMinutes: 15,

  refreshCookieName: 'refresh_token',
  /** The refresh cookie is only ever sent to the auth endpoints. */
  refreshCookiePath: '/api/auth',
  /**
   * Two tabs can race to refresh with the same cookie. A token rotated within
   * this window is treated as that benign race rather than as token theft.
   */
  refreshReuseGraceSeconds: 30,
} as const;
