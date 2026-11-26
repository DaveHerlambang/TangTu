// Transactions and totals (§3, §14.1): the app's rules before writing and the one totals function. What the
// database enforces (a used category kept, the grid's order, rows per account) is in schema.test.ts.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getCategory } from '@/db/categoriesRepository';
import { isId, type Db } from '@/db/db';
import { DomainError } from '@/db/errors';
import {
  cleanTransaction,
  firstTransactionAt,
  getTransaction,
  listTransactions,
  NOTE_MAX_LENGTH,
  toTransaction,
  type TransactionInput,
} from '@/db/transactionsRepository';
import { periodRange } from '@/utils/format';
import { daysCounted, groupByDay, summarize } from '@/utils/summary';

import { memoryData, testId } from './support/memory';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const rejectsWith = (p: Promise<unknown>, code: string) => assert.rejects(p, (e: unknown) => e instanceof DomainError && e.code === code);

async function setup() {
  const db = memoryData();
  const food = await db.createCategory({ kind: 'EXPENSE', name: null, templateKey: 'food', icon: 'fast-food', tint: 'peach' });
  const transport = await db.createCategory({ kind: 'EXPENSE', name: null, templateKey: 'transport', icon: 'car', tint: 'sky' });
  const salary = await db.createCategory({ kind: 'INCOME', name: null, templateKey: 'salary', icon: 'cash', tint: 'mint' });
  const spend = (amount: number, occurredAt: string, categoryId = food, currency: TransactionInput['currency'] = 'IDR') =>
    db.createTransaction({ kind: 'EXPENSE', amount, currency, categoryId, note: '', occurredAt });
  return { db, food, transport, salary, spend };
}

describe('transactions', () => {
  test('list by range: newest first, the end left out', async () => {
    const { db, food, spend } = await setup();
    const id = await spend(25_000, at(2026, 10, 6));
    await spend(10_000, at(2026, 9, 30));
    const october = await db.listTransactions(periodRange('2026-10', 1));
    assert.deepEqual(october.map((r) => [r.id, r.category.id]), [[id, food]]);
  });
  test('amount must be a positive integer; category kind must match', async () => {
    const { db, food, salary } = await setup();
    const base = { kind: 'EXPENSE' as const, currency: 'IDR' as const, categoryId: food, note: '', occurredAt: at(2026, 10, 1) };
    await rejectsWith(db.createTransaction({ ...base, amount: 0 }), 'transaction.amount');
    await rejectsWith(db.createTransaction({ ...base, amount: -5 }), 'transaction.amount');
    await rejectsWith(db.createTransaction({ ...base, amount: 1.5 }), 'transaction.amount');
    await rejectsWith(db.createTransaction({ ...base, amount: 100, categoryId: salary }), 'transaction.category');
    await rejectsWith(db.createTransaction({ ...base, amount: 100, categoryId: testId(999) }), 'transaction.category');
  });
  test('notes are trimmed and capped', () => {
    const input = { kind: 'EXPENSE' as const, amount: 1, currency: 'IDR' as const, categoryId: testId(1), occurredAt: at(2026, 10, 1) };
    assert.equal(cleanTransaction({ ...input, note: '  kopi   susu  ' }, { kind: 'EXPENSE' }).note, 'kopi susu');
    assert.equal(cleanTransaction({ ...input, note: 'x'.repeat(NOTE_MAX_LENGTH + 50) }, { kind: 'EXPENSE' }).note.length, NOTE_MAX_LENGTH);
  });
  test('a row from the database comes back in the app\'s shape (ISO dates, a known currency, a number amount)', () => {
    const t = toTransaction({
      id: testId(7),
      kind: 'INCOME',
      amount: 8_500_000,
      currency: 'XYZ',
      category_id: testId(2),
      note: '',
      occurred_at: '2026-11-25T09:00:00+07:00',
      created_at: '2026-11-25T02:00:00+00:00',
      updated_at: '2026-11-25T02:00:00+00:00',
    });
    assert.equal(t.kind, 'INCOME');
    assert.equal(t.currency, 'IDR', 'an unknown currency shows as the default');
    assert.equal(t.occurred_at, '2026-11-25T02:00:00.000Z');
    assert.equal(t.created_at, '2026-11-25T02:00:00.000Z');
  });
});

describe('summarize (the one totals function)', () => {
  test('spent, income, left, count, by category, top category', async () => {
    const { db, food, transport, salary, spend } = await setup();
    await spend(50_000, at(2026, 10, 2), food);
    await spend(30_000, at(2026, 10, 3), transport);
    await spend(20_000, at(2026, 10, 4), food);
    await db.createTransaction({ kind: 'INCOME', amount: 1_000_000, currency: 'IDR', categoryId: salary, note: '', occurredAt: at(2026, 10, 1) });
    const rows = await db.listTransactions(periodRange('2026-10', 1));
    const s = summarize(rows, 'IDR', { key: '2026-10', startDay: 1, now: new Date(2026, 10, 18) });
    assert.equal(s.spent, 100_000);
    assert.equal(s.income, 1_000_000);
    assert.equal(s.left, 900_000);
    assert.equal(s.count, 4);
    assert.deepEqual(s.byCategory.map((c) => [c.category.id, c.spent]), [[food, 70_000], [transport, 30_000]]);
    // October is over: 31 days.
    assert.equal(s.daysCounted, 31);
    assert.equal(s.dailyAverage, Math.round(100_000 / 31));
  });
  test('other currencies are listed, never added to the totals', async () => {
    const { db, food, spend } = await setup();
    await spend(50_000, at(2026, 10, 2));
    await spend(1250, at(2026, 10, 3), food, 'USD');
    await spend(3000, at(2026, 10, 4), food, 'JPY');
    const rows = await db.listTransactions(periodRange('2026-10', 1));
    const s = summarize(rows, 'IDR', { key: '2026-10', startDay: 1 });
    assert.equal(s.spent, 50_000);
    assert.equal(s.count, 3);
    assert.deepEqual(s.others, [
      { currency: 'USD', spent: 1250, income: 0, count: 1 },
      { currency: 'JPY', spent: 3000, income: 0, count: 1 },
    ]);
    // With USD as the default, the roles swap.
    const usd = summarize(rows, 'USD', { key: '2026-10', startDay: 1 });
    assert.equal(usd.spent, 1250);
    assert.deepEqual(usd.others.map((o) => o.currency), ['IDR', 'JPY']);
  });
  test('period start day decides what counts (25 Sep – 24 Oct)', async () => {
    const { db, spend } = await setup();
    await spend(1, at(2026, 9, 24));
    await spend(10, at(2026, 9, 25));
    await spend(100, at(2026, 10, 24, 23));
    await spend(1000, at(2026, 10, 25));
    const rows = await db.listTransactions(periodRange('2026-10', 25));
    assert.equal(summarize(rows, 'IDR', { key: '2026-10', startDay: 25 }).spent, 110);
  });
  test('daily average divides by the days so far in the current period', () => {
    assert.equal(daysCounted('2026-11', 1, new Date(2026, 10, 18, 9)), 18);
    assert.equal(daysCounted('2026-12', 1, new Date(2026, 10, 18)), 0);
    assert.equal(daysCounted('2026-11', 25, new Date(2026, 10, 18)), 25); // 25 Oct → 18 Nov
  });
});

test('groupByDay: newest day first, with the day total in the default currency', async () => {
  const { db, salary, spend } = await setup();
  await spend(10_000, at(2026, 10, 6, 9));
  await spend(5_000, at(2026, 10, 6, 18));
  await spend(999, at(2026, 10, 6, 19), undefined, 'USD');
  await db.createTransaction({ kind: 'INCOME', amount: 7, currency: 'IDR', categoryId: salary, note: '', occurredAt: at(2026, 10, 5) });
  const groups = groupByDay(await db.listTransactions(periodRange('2026-10', 1)), 'IDR');
  assert.deepEqual(groups.map((g) => [g.key, g.items.length, g.spent, g.income]), [
    ['2026-10-06', 3, 15_000, 0],
    ['2026-10-05', 1, 0, 7],
  ]);
});

test('ids: only a UUID reaches the database; a route with anything else finds nothing instead of an error', async () => {
  assert.ok(isId(testId(1)));
  assert.ok(isId('6F1C2A4E-8B0D-4C3E-9A51-2D7F0E9B4C11'));
  for (const bad of ['12', 'abc', '', `${testId(1)} `, 12, null, undefined]) assert.equal(isId(bad), false, String(bad));
  const noDatabase = null as unknown as Db; // never touched: the guard answers first
  assert.equal(await getTransaction(noDatabase, '42'), null);
  assert.equal(await getCategory(noDatabase, 'garbage'), null);
  assert.deepEqual(await listTransactions(noDatabase, { ...periodRange('2026-10', 1), categoryId: '7' }), []);
  assert.equal(await firstTransactionAt(noDatabase, '7'), null);
});
