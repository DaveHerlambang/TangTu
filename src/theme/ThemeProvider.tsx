import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useAppStore } from '@/store/useAppStore';
import { themes, type Theme } from '@/theme/themes';

interface ThemeContextValue {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The theme is chosen in Settings only; there is no per-session override.
  const themeName = useAppStore((s) => s.defaultTheme);

  const value = useMemo<ThemeContextValue>(() => ({ theme: themes[themeName] ?? themes.sakura }), [themeName]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/**
 * Memoizes a theme-dependent style factory, rebuilding only when the theme changes.
 * Factories should be module-level and return `StyleSheet.create(...)`.
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const { theme } = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
