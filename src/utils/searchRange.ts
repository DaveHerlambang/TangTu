import { periodEnd, periodRange, periodStart, shiftPeriodKey } from '@/utils/format';

/**
 * The date chips of search on Home (§4, §5): the period Home shows, the one before it, the last three
 * (shown included), all time, or days the user picked. Pure, so the tests can check it.
 */
export type SearchRangeChoice = 'this' | 'last' | 'three' | 'all' | 'custom';
export const SEARCH_RANGE_CHOICES: readonly SearchRangeChoice[] = ['this', 'last', 'three', 'all', 'custom'];

/** Two picked days (00:00 local), in either order. */
export interface PickedDays {
  from: Date;
  to: Date;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** [start, end) as ISO UTC strings for `searchTransactions`; undefined = all time (or "custom" with nothing picked). */
export function searchRange(
  choice: SearchRangeChoice,
  shownKey: string,
  startDay: number,
  picked: PickedDays | null,
): { start: string; end: string } | undefined {
  switch (choice) {
    case 'this':
      return periodRange(shownKey, startDay);
    case 'last':
      return periodRange(shiftPeriodKey(shownKey, -1), startDay);
    case 'three':
      return { start: periodStart(shiftPeriodKey(shownKey, -2), startDay).toISOString(), end: periodEnd(shownKey, startDay).toISOString() };
    case 'all':
      return undefined;
    case 'custom': {
      if (!picked) return undefined;
      const [a, b] = [startOfDay(picked.from), startOfDay(picked.to)].sort((x, y) => x.getTime() - y.getTime());
      return { start: a.toISOString(), end: new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1).toISOString() };
    }
  }
}
