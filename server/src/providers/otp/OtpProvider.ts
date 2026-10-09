/**
 * Delivery channel for one-time passcodes. V1 ships only a console provider;
 * an SMS gateway or e-mail provider can implement this interface later
 * without touching the auth flows.
 */
export interface OtpMessage {
  /** E.164 phone number or e-mail address. */
  destination: string;
  code: string;
  purpose: 'PHONE_VERIFY' | 'LOGIN' | 'PIN_RESET';
  expiresAt: Date;
}

export interface OtpProvider {
  readonly id: string;
  send(message: OtpMessage): Promise<void>;
}
