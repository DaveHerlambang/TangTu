import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

import { useT } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { formatRupiah } from '@/utils/format';

/**
 * The eye on the Home summary (§8.6). Amounts are hidden by default so they aren't on show the
 * moment the app opens; the eye reveals them for as long as you stay on the screen.
 */
export function useAmounts() {
  const visible = useAppStore((s) => s.amountsVisible);
  const setVisible = useAppStore((s) => s.setAmountsVisible);
  const toggle = useCallback(() => setVisible(!useAppStore.getState().amountsVisible), [setVisible]);
  const hide = useCallback(() => setVisible(false), [setVisible]);
  const { t } = useT();
  /** What a screen reader says — never a row of asterisks. */
  const spoken = useCallback((amount: number) => (visible ? formatRupiah(amount) : t('amounts.hidden')), [visible, t]);
  return { visible, toggle, hide, spoken };
}

/** Call once per screen that has amounts: leaving it (or coming back to it) starts hidden again. */
export function useHideAmountsOnLeave() {
  const setVisible = useAppStore((s) => s.setAmountsVisible);
  useFocusEffect(useCallback(() => () => setVisible(false), [setVisible]));
}

/** Call once at the root: sending the app to the background hides amounts too. */
export function useHideAmountsInBackground() {
  const setVisible = useAppStore((s) => s.setAmountsVisible);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') setVisible(false);
    });
    return () => sub.remove();
  }, [setVisible]);
}

