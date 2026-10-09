import type { HealthStatus, PublicConfig } from '@app/shared';
import { api, unwrap } from './api';

export const systemService = {
  getHealth: () => unwrap(api.get<{ success: true; data: HealthStatus }>('/health')),
  getPublicConfig: () => unwrap(api.get<{ success: true; data: PublicConfig }>('/config/public')),
};
