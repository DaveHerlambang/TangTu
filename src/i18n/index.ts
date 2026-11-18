import { getLocales, useLocales } from 'expo-localization';
import { useMemo } from 'react';

import { useAppStore } from '@/store/useAppStore';

import { makeTranslator, resolveLanguage, type Language, type Translator } from './core';

export type { Language, LanguagePref, Translator } from './core';
export type { MessageKey } from './en';

/** The language the app speaks right now: the Settings choice, or the phone's when "Follow phone". */
export function useLanguage(): Language {
  const pref = useAppStore((s) => s.language);
  // `useLocales` re-renders when the phone's language changes while the app is open.
  const phone = useLocales()[0]?.languageCode;
  return resolveLanguage(pref, phone);
}

/**
 * `const { t, tp, lang } = useT()` — every string the user reads goes through `t()` (§6.5).
 * Switching the language re-renders at once; no restart.
 */
export function useT(): Translator {
  const lang = useLanguage();
  return useMemo(() => makeTranslator(lang), [lang]);
}

/** For code outside React (toasts from services, alerts): the language as of now. */
export function currentTranslator(): Translator {
  return makeTranslator(resolveLanguage(useAppStore.getState().language, getLocales()[0]?.languageCode));
}
