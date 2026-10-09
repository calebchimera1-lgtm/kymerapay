import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Client errors (4xx) won't fix themselves; only retry network/server failures.
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError && error.status >= 400 && error.status < 500)
          return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});
