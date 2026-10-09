import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark' | 'system';

interface UiState {
  theme: ThemePreference;
  /** Mask balances on screen (e.g. in public). Purely cosmetic. */
  hideBalances: boolean;
  setTheme: (theme: ThemePreference) => void;
  toggleHideBalances: () => void;
}

/** Persisted UI preferences. The key must match the inline script in index.html. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      hideBalances: false,
      setTheme: (theme) => set({ theme }),
      toggleHideBalances: () => set((state) => ({ hideBalances: !state.hideBalances })),
    }),
    {
      name: 'app-ui',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export function resolveTheme(theme: ThemePreference): 'light' | 'dark' {
  if (theme === 'system') return darkQuery().matches ? 'dark' : 'light';
  return theme;
}

export function applyTheme(theme: ThemePreference): void {
  document.documentElement.classList.toggle('dark', resolveTheme(theme) === 'dark');
}

/** Keeps <html class="dark"> in sync with the store and the OS setting. */
export function initThemeSync(): () => void {
  applyTheme(useUiStore.getState().theme);
  const unsubscribe = useUiStore.subscribe((state) => applyTheme(state.theme));
  const query = darkQuery();
  const onSystemChange = () => {
    if (useUiStore.getState().theme === 'system') applyTheme('system');
  };
  query.addEventListener('change', onSystemChange);
  return () => {
    unsubscribe();
    query.removeEventListener('change', onSystemChange);
  };
}
