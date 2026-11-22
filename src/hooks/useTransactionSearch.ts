import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';

import { listUsedCategories, searchTransactions } from '@/db/transactionsRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import type { TransactionWithCategory } from '@/types/models';
import { nameMatches } from '@/utils/categoryNames';
import { searchRange, type PickedDays, type SearchRangeChoice } from '@/utils/searchRange';

/**
 * Search on Home (§4, §5): off until the field is touched. While on, the list shows matches of the text
 * (note, or a category name in either language), the category chips and the date chip — starting on the
 * period Home shows, so the first results are the list you were looking at. Live: the query follows the
 * text a beat behind so typing stays smooth.
 */
export function useTransactionSearch(shownKey: string, startDay: number) {
  const [active, setActive] = useState(false);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [range, setRange] = useState<SearchRangeChoice>('this');
  const [days, setDays] = useState<PickedDays | null>(null);
  const query = useDeferredValue(text.trim());

  const { data: categories = [] } = useDbQuery(listUsedCategories);
  const nameMatchIds = useMemo(() => (query ? categories.filter((cat) => nameMatches(cat, query)).map((cat) => cat.id) : []), [categories, query]);
  const dateRange = useMemo(() => searchRange(range, shownKey, startDay, days), [range, shownKey, startDay, days]);

  const load = useCallback(
    (db: SQLiteDatabase): Promise<TransactionWithCategory[] | null> =>
      active ? searchTransactions(db, { text: query, nameMatchIds, categoryIds: picked, range: dateRange }) : Promise.resolve(null),
    [active, query, nameMatchIds, picked, dateRange],
  );
  const { data, reload } = useDbQuery(load);

  const toggleCategory = useCallback((id: number) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])), []);
  const pickDays = useCallback((next: PickedDays) => {
    setDays(next);
    setRange('custom');
  }, []);
  /** Back to the normal Home: everything reset, so the next search starts fresh. */
  const exit = useCallback(() => {
    setActive(false);
    setText('');
    setPicked([]);
    setRange('this');
    setDays(null);
  }, []);

  return {
    active,
    start: useCallback(() => setActive(true), []),
    exit,
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
    results: active ? (data ?? null) : null,
    reload,
  };
}

export type TransactionSearch = ReturnType<typeof useTransactionSearch>;
