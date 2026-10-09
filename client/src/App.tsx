import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { BRAND } from '@/config/brand';
import { router } from '@/router';
import { authService } from '@/services/auth.service';
import { queryClient } from '@/services/queryClient';
import { initThemeSync } from '@/store/uiStore';

export function App() {
  useEffect(() => {
    document.title = `${BRAND.name} — Demo`;
    // Restore the session from the httpOnly refresh cookie (single-flight, StrictMode-safe).
    void authService.restore();
    return initThemeSync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
