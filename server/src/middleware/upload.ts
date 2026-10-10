import { ERROR_CODES } from '@app/shared';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../utils/AppError.js';

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0, parts: 2 },
}).single('file');

/** Accepts exactly one file field named `file` (≤ 2 MB). Content is validated by the media service. */
export const singleImageUpload: RequestHandler = (req, res, next) => {
  parser(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new AppError(ERROR_CODES.PAYLOAD_TOO_LARGE, 'Images must be 2 MB or smaller.', 413),
        );
      }
      return next(AppError.badRequest('Send one image in a form field named "file".'));
    }
    if (err) return next(err);
    if (!req.file)
      return next(AppError.validation([{ path: 'file', message: 'Choose an image to upload.' }]));
    next();
  });
};
