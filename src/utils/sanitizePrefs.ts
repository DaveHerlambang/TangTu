import { LANGUAGE_PREFS, type LanguagePref } from '@/i18n/core';
import type { PersistedPrefs } from '@/store/useAppStore';
import { THEME_ORDER, type ThemeName } from '@/theme/themes';

const isTheme = (v: unknown): v is ThemeName => typeof v === 'string' && (THEME_ORDER as readonly string[]).includes(v);
const isLanguage = (v: unknown): v is LanguagePref => typeof v === 'string' && (LANGUAGE_PREFS as readonly string[]).includes(v);
const isStartDay = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 31;

/**
 * Preferences read from a backup file (or the saved store) are untrusted: keep only known keys with
 * valid values, so a damaged or hand-edited file can't put the app in a broken state (e.g. an
 * unknown theme name or a start day of 40). `defaultCurrency` from 0.1.x backups is ignored: since 0.2.0
 * TangTu counts rupiah only (§14.1).
 */
export function sanitizePrefs(raw: unknown): Partial<PersistedPrefs> {
  if (!raw || typeof raw !== 'object') return {};
  const p = raw as Record<string, unknown>;
  const out: Partial<PersistedPrefs> = {};
  if (isTheme(p.defaultTheme)) out.defaultTheme = p.defaultTheme;
  if (isLanguage(p.language)) out.language = p.language;
  if (isStartDay(p.periodStartDay)) out.periodStartDay = p.periodStartDay;
  if (typeof p.devToolsHidden === 'boolean') out.devToolsHidden = p.devToolsHidden;
  return out;
}
