import { periodKey, shiftPeriodKey } from '@/utils/format';

/**
 * When the bell's period and year recaps are due (§8.7). Pure, so the tests can check it; the launch checks
 * in `@/services/activityEvents` and the store's start-day change use it.
 */

/** The year recap is written in the first periods of the next year (keys -01 and -02); later it's old news. */
export const YEAR_RECAP_LAST_MONTH = 2;

/**
 * The period whose recap counts as handled when the start day changes (or a restore brings another one):
 * the one just before now under the *new* start day. So a change never writes a recap at once, and the
 * next boundary under the new rule does — no period is skipped, none is recapped twice (0.4.1, B5).
 */
export const recapHandledThrough = (startDay: number, now: Date = new Date()): string => shiftPeriodKey(periodKey(now, startDay), -1);

/**
 * A recap's dedupe key carries the start day: with start day 25, "2026-11" is 25 Oct – 24 Nov; with start
 * day 1 it is 1–30 Nov. Without it, the second would be taken for the first and never written.
 */
export const recapDedupeKey = (startDay: number, period: string): string => `recap:${startDay}:${period}`;

/**
 * The year to recap now, or null: in the first `YEAR_RECAP_LAST_MONTH` periods of a year, last year's — unless
 * it was already written (`lastYearRecap`, a device marker; not the bell's history, which is trimmed after
 * 60 days and could otherwise let the same recap through twice — 0.4.1, B2).
 */
export function yearToRecap(currentKey: string, lastYearRecap: number | null): number | null {
  const [year, month] = currentKey.split('-').map(Number);
  if (month > YEAR_RECAP_LAST_MONTH) return null;
  const due = year - 1;
  return lastYearRecap !== null && lastYearRecap >= due ? null : due;
}
