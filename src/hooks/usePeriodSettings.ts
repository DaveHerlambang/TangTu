import { useCallback } from 'react';

import { useT } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { periodKey, periodWord } from '@/utils/format';

/**
 * The user's period setup (§3): the start day, the word the UI uses for one period ("month" when
 * it starts on the 1st, "period" otherwise, translated), and the key of the period that contains now.
 */
export function usePeriodSettings() {
  const startDay = useAppStore((s) => s.periodStartDay);
  const { t } = useT();
  const kind = periodWord(startDay);
  const word = t(kind === 'month' ? 'period.word.month' : 'period.word.period');
  const currentKey = useCallback((now: Date = new Date()) => periodKey(now, startDay), [startDay]);
  return { startDay, kind, word, currentKey };
}

/** The period Home and Charts are showing (shared, §8.5). Picking the current one stores `null`, so it follows the date. */
export function useSelectedPeriod() {
  const { currentKey } = usePeriodSettings();
  const selected = useAppStore((s) => s.selectedPeriod);
  const setSelected = useAppStore((s) => s.setSelectedPeriod);
  const now = currentKey();
  const key = selected ?? now;
  const setKey = useCallback((next: string) => setSelected(next === currentKey() ? null : next), [currentKey, setSelected]);
  return { key, isCurrent: key === now, setKey };
}
