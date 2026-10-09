/** Typed access to build-time client configuration (VITE_* variables only). */
export const clientEnv = {
  apiUrl: import.meta.env.VITE_API_URL || '/api',
  isDev: import.meta.env.DEV,
} as const;
