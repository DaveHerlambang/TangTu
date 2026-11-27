import { useCallback, useDeferredValue, useMemo, useState } from 'react';

import type { Db } from '@/db/db';
import { listUsedCategories, searchTransactions } from '@/db/transactionsRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import type { Id, TransactionWithCategory } from '@/types/models';
import { nameMatches } from '@/utils/categoryNames';
import { searchRange, type PickedDays, type SearchRangeChoice } from '@/utils/searchRange';

/**
 * Search on Home (§4, §5): off until the field is touched. While on, the list shows matches of the text
 * (note, or a category name in either language), the category chips and the date chip — starting on the
 * period Home shows, so the first results are the list you were looking at. Live: the query follows the
 * text a beat behind so typing stays smooth.
 *
 * `panel` (the wide web layout, 0.6.0, §13.9): the filters are always on screen, so there is no on/off; a search
 * runs only once a filter differs from the defaults (text, a category, a date other than the shown period) —
 * until then the screen shows its own period list and nothing is read twice.
 */
export function useTransactionSearch(shownKey: string, startDay: number, { panel = false }: { panel?: boolean } = {}) {
  const [active, setActive] = useState(false);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<Id[]>([]);
  const [range, setRange] = useState<SearchRangeChoice>('this');
  const [days, setDays] = useState<PickedDays | null>(null);
  const query = useDeferredValue(text.trim());

  const { data: categories = [] } = useDbQuery(listUsedCategories);
  const nameMatchIds = useMemo(() => (query ? categories.filter((cat) => nameMatches(cat, query)).map((cat) => cat.id) : []), [categories, query]);
  const dateRange = useMemo(() => searchRange(range, shownKey, startDay, days), [range, shownKey, startDay, days]);
  const filtered = query !== '' || picked.length > 0 || range !== 'this';
  const running = panel ? filtered : active;

  const load = useCallback(
    (db: Db): Promise<TransactionWithCategory[] | null> =>
      running ? searchTransactions(db, { text: query, nameMatchIds, categoryIds: picked, range: dateRange }) : Promise.resolve(null),
    [running, query, nameMatchIds, picked, dateRange],
  );
  const { data, reload } = useDbQuery(load);

  const toggleCategory = useCallback((id: Id) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])), []);
  const pickDays = useCallback((next: PickedDays) => {
    setDays(next);
    setRange('custom');
  }, []);
  /** Every filter back to its default. */
  const reset = useCallback(() => {
    setText('');
    setPicked([]);
    setRange('this');
    setDays(null);
  }, []);
  /** Back to the normal Home: everything reset, so the next search starts fresh. */
  const exit = useCallback(() => {
    setActive(false);
    reset();
  }, [reset]);

  return {
    active,
    start: useCallback(() => setActive(true), []),
    exit,
    reset,
    /** A filter differs from the defaults (what `panel` searches on). */
    filtered,
    text,
    setText,
    categories,
    picked,
    toggleCategory,
    range,
    setRange,
    days,
    pickDays,
    /** Null until the first results arrive (or while search is off). */
    results: running ? (data ?? null) : null,
    reload,
  };
}

export type TransactionSearch = ReturnType<typeof useTransactionSearch>;
