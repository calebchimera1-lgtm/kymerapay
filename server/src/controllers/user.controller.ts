import type { Request, Response } from 'express';
import { getAuth } from '../middleware/authenticate.js';
import { authService } from '../services/auth.service.js';
import { directoryService } from '../services/directory.service.js';
import { profileService } from '../services/profile.service.js';
import { getRequestContext } from '../utils/requestContext.js';
import type { UpdateProfileInput } from '@app/shared';
import { sendSuccess } from '../utils/response.js';

export async function getMe(req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, await authService.getMe(getAuth(req).userId));
}

export async function searchUsers(req: Request, res: Response): Promise<void> {
  const { q } = req.query as { q: string };
  sendSuccess(res, await directoryService.search(q, getAuth(req).userId));
}

export async function getPublicProfile(req: Request, res: Response): Promise<void> {
  const { username } = req.params as { username: string };
  sendSuccess(res, await directoryService.getByUsername(username));
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  sendSuccess(
    res,
    await profileService.update(
      getAuth(req).userId,
      req.body as UpdateProfileInput,
      getRequestContext(req),
    ),
  );
}

export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  sendSuccess(
    res,
    await profileService.setAvatar(getAuth(req).userId, req.file!.buffer, getRequestContext(req)),
  );
}

export async function deleteAvatar(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await profileService.removeAvatar(getAuth(req).userId));
}
