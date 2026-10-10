import { QR_CODE_PATTERN } from '@app/shared';
import { Navigate, useParams } from 'react-router';

/** `/pay/:code` — what a phone's camera app opens. Hands over to the confirm-first send flow. */
export function PayLinkRedirect() {
  const { code = '' } = useParams();
  if (!QR_CODE_PATTERN.test(code)) return <Navigate to="/app/scan" replace />;
  return <Navigate to={`/app/send?qr=${encodeURIComponent(code)}`} replace />;
}
