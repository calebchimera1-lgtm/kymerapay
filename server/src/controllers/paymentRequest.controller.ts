import type {
  CreatePaymentRequestData,
  ListPaymentRequestsQuery,
  PayRequestResult,
} from '@app/shared';
import type { Request, Response } from 'express';
import { getAuth } from '../middleware/authenticate.js';
import { idempotent } from '../middleware/idempotency.js';
import { paymentRequestService } from '../services/paymentRequest.service.js';
import { getRequestContext } from '../utils/requestContext.js';
import { sendSuccess } from '../utils/response.js';

const idParam = (req: Request) => (req.params as { id: string }).id;

export async function createPaymentRequest(req: Request, res: Response): Promise<void> {
  const dto = await paymentRequestService.create(
    getAuth(req).userId,
    req.body as CreatePaymentRequestData,
    getRequestContext(req),
  );
  sendSuccess(res, dto, 201);
}

export async function listPaymentRequests(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListPaymentRequestsQuery;
  sendSuccess(res, await paymentRequestService.list(getAuth(req).userId, query));
}

export async function getPaymentRequestSummary(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await paymentRequestService.summary(getAuth(req).userId));
}

export async function getPaymentRequest(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await paymentRequestService.get(getAuth(req).userId, idParam(req)));
}

/** `POST /api/payment-requests/:id/pay` — requires `Idempotency-Key` and the PIN. */
export const payPaymentRequest = idempotent<PayRequestResult>(
  'payment-requests.pay',
  async (req, reservation) => ({
    statusCode: 201,
    body: await paymentRequestService.pay(
      getAuth(req).userId,
      idParam(req),
      (req.body as { pin: string }).pin,
      getRequestContext(req),
      reservation,
    ),
  }),
);

export async function declinePaymentRequest(req: Request, res: Response): Promise<void> {
  sendSuccess(
    res,
    await paymentRequestService.decline(getAuth(req).userId, idParam(req), getRequestContext(req)),
  );
}

export async function cancelPaymentRequest(req: Request, res: Response): Promise<void> {
  sendSuccess(
    res,
    await paymentRequestService.cancel(getAuth(req).userId, idParam(req), getRequestContext(req)),
  );
}
