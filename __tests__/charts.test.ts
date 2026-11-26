// Chart data (§9) against real SQLite: ranked categories, the trend, daily spend, day keys.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { type TransactionInput } from '@/db/transactionsRepository';
import { dayRange, formatPeriodShort, localDayKey, parseDayKey, periodKey, periodRange, periodStart, periodEnd } from '@/utils/format';
import { formatShare, rankCategories, spendByDay, summarize, trendKeys, trendPoints } from '@/utils/summary';
import type { Id } from '@/types/models';

import { memoryData, testId } from './support/memory';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

async function setup() {
  const db = memoryData();
  const cat = (templateKey: 'food' | 'transport' | 'shopping', icon: 'fast-food' | 'car' | 'cart') =>
    db.createCategory({ kind: 'EXPENSE', name: null, templateKey, icon, tint: 'peach' });
  const food = await cat('food', 'fast-food');
  const transport = await cat('transport', 'car');
  const shopping = await cat('shopping', 'cart');
  const salary = await db.createCategory({ kind: 'INCOME', name: null, templateKey: 'salary', icon: 'cash', tint: 'mint' });
  const add = (kind: 'EXPENSE' | 'INCOME', amount: number, occurredAt: string, categoryId: Id, currency: TransactionInput['currency'] = 'IDR') =>
    db.createTransaction({ kind, amount, currency, categoryId, note: '', occurredAt });
  return { db, food, transport, shopping, salary, add };
}

describe('ranked categories', () => {
  test('largest first, with shares of the period’s spending', async () => {
    const { db, food, transport, shopping, add } = await setup();
    await add('EXPENSE', 50_000, at(2026, 10, 2), food);
    await add('EXPENSE', 30_000, at(2026, 10, 3), transport);
    await add('EXPENSE', 20_000, at(2026, 10, 4), shopping);
    await add('EXPENSE', 9_00, at(2026, 10, 4), food, 'USD'); // not in totals
    const rows = await db.listTransactions(periodRange('2026-10', 1));
    const r = rankCategories(summarize(rows, 'IDR', { key: '2026-10', startDay: 1 }));
    assert.deepEqual(
      r.top.map((c) => [c.category.id, c.spent, c.share]),
      [
        [food, 50_000, 0.5],
        [transport, 30_000, 0.3],
        [shopping, 20_000, 0.2],
      ],
    );
    assert.deepEqual(r.rest, []);
  });

  test('top 7 + Other, but never an Other of one', () => {
    const summary = (n: number) => {
      const byCategory = Array.from({ length: n }, (_, i) => ({ category: { id: i } as never, spent: (n - i) * 100 }));
      const spent = byCategory.reduce((s, c) => s + c.spent, 0);
      return { spent, byCategory } as unknown as ReturnType<typeof summarize>;
    };
    const eight = rankCategories(summary(8));
    assert.equal(eight.top.length, 8);
    assert.equal(eight.rest.length, 0);
    const ten = rankCategories(summary(10));
    assert.equal(ten.top.length, 7);
    assert.equal(ten.rest.length, 3);
    assert.equal(ten.restSpent, 300 + 200 + 100);
  });

  test('shares print as whole percentages', () => {
    assert.equal(formatShare(0.336), '34%');
    assert.equal(formatShare(1), '100%');
    assert.equal(formatShare(0.004), '<1%');
    assert.equal(formatShare(0), '0%');
  });
});

describe('trend', () => {
  test('up to 6 periods ending at the shown one, from the first period with data', () => {
    assert.deepEqual(trendKeys('2026-10', '2026-10', '2026-01'), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    assert.deepEqual(trendKeys('2026-10', '2026-10', '2026-09'), ['2026-09', '2026-10']);
    assert.deepEqual(trendKeys('2026-08', '2026-10', '2026-01'), ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']);
    // A future period is shown: the trend still ends now.
    assert.deepEqual(trendKeys('2026-12', '2026-10', '2026-09'), ['2026-09', '2026-10']);
    // Across the year boundary.
    assert.deepEqual(trendKeys('2027-02', '2027-02', '2026-11'), ['2026-11', '2026-12', '2027-01', '2027-02']);
    assert.deepEqual(trendKeys('2026-10', '2026-10', null), []);
  });

  test('each period’s numbers equal summarize for that period (start day 25)', async () => {
    const { db, food, salary, add } = await setup();
    await add('EXPENSE', 10_000, at(2026, 9, 24), food); // September period
    await add('EXPENSE', 20_000, at(2026, 9, 25), food); // October period
    await add('EXPENSE', 5_000, at(2026, 10, 24), food); // October period
    await add('INCOME', 900_000, at(2026, 9, 25), salary); // October period
    await add('EXPENSE', 7_000, at(2026, 10, 25), food); // November period
    const startDay = 25;
    const first = await db.firstTransactionAt();
    assert.equal(first, at(2026, 9, 24));
    const keys = trendKeys('2026-11', '2026-11', periodKey(new Date(first!), startDay));
    assert.deepEqual(keys, ['2026-09', '2026-10', '2026-11']);
    const rows = await db.listTransactions({ start: periodStart(keys[0], startDay).toISOString(), end: periodEnd(keys.at(-1)!, startDay).toISOString() });
    const points = trendPoints(rows, 'IDR', keys, startDay);
    assert.deepEqual(points, [
      { key: '2026-09', spent: 10_000, income: 0 },
      { key: '2026-10', spent: 25_000, income: 900_000 },
      { key: '2026-11', spent: 7_000, income: 0 },
    ]);
    for (const p of points) {
      const s = summarize(await db.listTransactions(periodRange(p.key, startDay)), 'IDR', { key: p.key, startDay });
      assert.equal(p.spent, s.spent);
      assert.equal(p.income, s.income);
    }
  });

  test('one category: its own first transaction and its own rows', async () => {
    const { db, food, transport, add } = await setup();
    await add('EXPENSE', 1_000, at(2026, 8, 3), transport);
    await add('EXPENSE', 2_000, at(2026, 9, 3), food);
    await add('EXPENSE', 3_000, at(2026, 10, 3), food);
    assert.equal(await db.firstTransactionAt(food), at(2026, 9, 3));
    assert.equal(await db.firstTransactionAt(testId(999)), null);
    const rows = await db.listTransactions({ ...periodRange('2026-08', 1), end: periodEnd('2026-10', 1).toISOString(), categoryId: food });
    assert.deepEqual(
      trendPoints(rows, 'IDR', ['2026-09', '2026-10'], 1).map((p) => p.spent),
      [2_000, 3_000],
    );
  });
});

describe('daily spend', () => {
  test('one entry per day of the period, default currency only', async () => {
    const { db, food, salary, add } = await setup();
    await add('EXPENSE', 10_000, at(2026, 2, 1, 8), food);
    await add('EXPENSE', 15_000, at(2026, 2, 1, 20), food);
    await add('EXPENSE', 4_00, at(2026, 2, 1, 21), food, 'USD');
    await add('INCOME', 500_000, at(2026, 2, 2), salary);
    await add('EXPENSE', 3_000, at(2026, 2, 28, 23), food);
    const rows = await db.listTransactions(periodRange('2026-02', 1));
    const days = spendByDay(rows, 'IDR', { key: '2026-02', startDay: 1 });
    assert.equal(days.length, 28);
    assert.equal(days[0].key, '2026-02-01');
    assert.equal(days[0].spent, 25_000);
    assert.equal(days[1].spent, 0);
    assert.equal(days[27].key, '2026-02-28');
    assert.equal(days[27].spent, 3_000);
    // The bars add up to the period's spent.
    const s = summarize(rows, 'IDR', { key: '2026-02', startDay: 1 });
    assert.equal(days.reduce((sum, d) => sum + d.spent, 0), s.spent);
  });

  test('a payday period spans two months (start day 25)', () => {
    const days = spendByDay([], 'IDR', { key: '2026-10', startDay: 25 });
    assert.equal(days[0].key, '2026-09-25');
    assert.equal(days.at(-1)!.key, '2026-10-24');
    assert.equal(days.length, 30);
  });

  test('start day 31 in a short month', () => {
    const days = spendByDay([], 'IDR', { key: '2026-03', startDay: 31 });
    assert.equal(days[0].key, '2026-02-28');
    assert.equal(days.at(-1)!.key, '2026-03-30');
  });
});

describe('day keys', () => {
  test('round trip, and junk is rejected', () => {
    const d = new Date(2026, 9, 6, 15, 30);
    assert.equal(localDayKey(d), '2026-10-06');
    assert.equal(parseDayKey('2026-10-06')!.getTime(), new Date(2026, 9, 6).getTime());
    for (const bad of ['2026-02-30', '2026-13-01', '2026-1-6', 'today', '', '2026-10-06T00:00']) assert.equal(parseDayKey(bad), null, bad);
  });

  test('a day’s range holds exactly that day’s transactions', async () => {
    const { db, food, add } = await setup();
    await add('EXPENSE', 1, at(2026, 10, 5, 23), food);
    const mine = await add('EXPENSE', 2, at(2026, 10, 6, 0), food);
    const late = await add('EXPENSE', 3, new Date(2026, 9, 6, 23, 59).toISOString(), food);
    await add('EXPENSE', 4, at(2026, 10, 7, 0), food);
    const rows = await db.listTransactions(dayRange(parseDayKey('2026-10-06')!));
    assert.deepEqual(rows.map((r) => r.id), [late, mine]);
  });

  test('short period names per language', () => {
    assert.equal(formatPeriodShort('2026-10', 'en'), 'Oct');
    assert.equal(formatPeriodShort('2026-10', 'id'), 'Okt');
    assert.equal(formatPeriodShort('2027-01', 'id'), 'Jan');
  });
});
