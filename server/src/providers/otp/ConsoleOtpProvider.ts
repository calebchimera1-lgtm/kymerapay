import { logger } from '../../utils/logger.js';
import type { OtpMessage, OtpProvider } from './OtpProvider.js';

/** Development-only provider: writes the code to the server log instead of sending it. */
export class ConsoleOtpProvider implements OtpProvider {
  readonly id = 'console';

  async send(message: OtpMessage): Promise<void> {
    logger.info(
      { destination: message.destination, purpose: message.purpose, code: message.code },
      'DEMO OTP (not sent — console provider)',
    );
  }
}
