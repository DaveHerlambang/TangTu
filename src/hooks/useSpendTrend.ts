import { useCallback, useMemo } from 'react';

import type { Db } from '@/db/db';
import { firstTransactionAt, listTransactions } from '@/db/transactionsRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { usePeriodSettings } from '@/hooks/usePeriodSettings';
import { periodEnd, periodKey, periodStart } from '@/utils/format';
import { trendKeys, trendPoints, type TrendPoint } from '@/utils/summary';
import type { Id } from '@/types/models';
import { DEFAULT_CURRENCY } from '@/utils/money';

/**
 * The trend's data (§9.2): up to 6 periods ending at `shown`, starting at the first period with data —
 * of every transaction, or of one category. `points` is undefined while loading and empty when
 * there's no data at all.
 */
export function useSpendTrend(shown: string, categoryId?: Id): { points: TrendPoint[] | undefined; current: string } {
  const { startDay, currentKey } = usePeriodSettings();
  const currency = DEFAULT_CURRENCY;
  const current = currentKey();

  const load = useCallback(
    async (db: Db) => {
      const first = await firstTransactionAt(db, categoryId);
      const keys = trendKeys(shown, current, first ? periodKey(new Date(first), startDay) : null);
      if (keys.length === 0) return { keys, rows: [] };
      const rows = await listTransactions(db, {
        start: periodStart(keys[0], startDay).toISOString(),
        end: periodEnd(keys[keys.length - 1], startDay).toISOString(),
        categoryId,
      });
      return { keys, rows };
    },
    [shown, current, startDay, categoryId],
  );
  const { data } = useDbQuery(load);
  const points = useMemo(() => (data ? trendPoints(data.rows, currency, data.keys, startDay) : undefined), [data, currency, startDay]);
  return { points, current };
}
