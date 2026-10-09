import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const REQUEST_ID_HEADER = 'X-Request-Id';
// Accept a caller-supplied ID only when it is short and boring, so it can't be
// used for log injection.
const SAFE_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/** Assigns a correlation ID to every request and echoes it in the response. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get(REQUEST_ID_HEADER);
  req.id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, req.id);
  next();
};
