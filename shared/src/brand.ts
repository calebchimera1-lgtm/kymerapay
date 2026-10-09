/**
 * Single source of truth for product branding.
 *
 * KESPAY is a temporary product name — rebranding means editing this file
 * (plus the optional APP_NAME env override on the server). Nothing else in the
 * codebase should hard-code the product name, QR scheme or legal copy.
 */
export const BRAND = {
  name: 'KESPAY',
  shortName: 'KESPAY',
  tagline: 'Send, request and split money with the people you know.',
  /** URI scheme embedded in payment QR codes, e.g. `kespay://pay/<code>`. */
  qrScheme: 'kespay',
  supportEmail: 'support@example.com',
  currency: {
    code: 'KES',
    symbol: 'KSh',
    locale: 'en-KE',
  },
  timezone: 'Africa/Nairobi',
  demo: {
    bannerText: 'DEMO MODE — NO REAL MONEY',
    disclaimer: 'Demo environment. No real money is transferred.',
    legalNotice:
      'This application is a software demonstration that uses simulated Kenyan Shillings only. ' +
      'It is not a licensed payment service provider, bank or money-transfer operator, and it is ' +
      'not connected to M-Pesa, Airtel Money, any bank or any card network.',
  },
} as const;

export type Brand = typeof BRAND;
