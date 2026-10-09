import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates and *replaces* request input with the parsed result, so handlers
 * only ever see trimmed, normalised, typed values. Unknown keys are stripped.
 * Failures become a 422 VALIDATION_ERROR via the error handler.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
    // Express 5 exposes query/params through getters; shadow them with the parsed values.
    if (schemas.query) {
      Object.defineProperty(req, 'query', {
        value: schemas.query.parse(req.query),
        writable: true,
      });
    }
    if (schemas.params) {
      Object.defineProperty(req, 'params', {
        value: schemas.params.parse(req.params),
        writable: true,
      });
    }
    next();
  };
}
