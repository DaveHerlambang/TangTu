// Transactions and totals (§3, §14.1) against real SQLite.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { archiveCategory, categoryUsage, createCategory, deleteCategory, listCategoriesByUse } from '@/db/categoriesRepository';
import { DomainError } from '@/db/errors';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  putTransaction,
  updateTransaction,
  type TransactionInput,
} from '@/db/transactionsRepository';
import { periodRange } from '@/utils/format';
import { daysCounted, groupByDay, summarize } from '@/utils/summary';

import { testDb } from './support/db';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const rejectsWith = (p: Promise<unknown>, code: string) => assert.rejects(p, (e: unknown) => e instanceof DomainError && e.code === code);

async function setup() {
  const db = await testDb();
  const food = await createCategory(db, { kind: 'EXPENSE', name: null, templateKey: 'food', icon: 'fast-food', tint: 'peach' });
  const transport = await createCategory(db, { kind: 'EXPENSE', name: null, templateKey: 'transport', icon: 'car', tint: 'sky' });
  const salary = await createCategory(db, { kind: 'INCOME', name: null, templateKey: 'salary', icon: 'cash', tint: 'mint' });
  const spend = (amount: number, occurredAt: string, categoryId = food, currency: TransactionInput['currency'] = 'IDR') =>
    createTransaction(db, { kind: 'EXPENSE', amount, currency, categoryId, note: '', occurredAt });
  return { db, food, transport, salary, spend };
}

describe('transactions', () => {
  test('create, read, list by range', async () => {
    const { db, food, spend } = await setup();
    const id = await spend(25_000, at(2026, 10, 6));
    await spend(10_000, at(2026, 9, 30));
    const t = (await getTransaction(db, id))!;
    assert.equal(t.amount, 25_000);
    assert.equal(t.category.id, food);
    const october = await listTransactions(db, periodRange('2026-10', 1));
    assert.deepEqual(october.map((r) => r.id), [id]);
  });
  test('amount must be a positive integer; category kind must match', async () => {
    const { db, food, salary } = await setup();
    const base = { kind: 'EXPENSE' as const, currency: 'IDR' as const, categoryId: food, note: '', occurredAt: at(2026, 10, 1) };
    await rejectsWith(createTransaction(db, { ...base, amount: 0 }), 'transaction.amount');
    await rejectsWith(createTransaction(db, { ...base, amount: -5 }), 'transaction.amount');
    await rejectsWith(createTransaction(db, { ...base, amount: 1.5 }), 'transaction.amount');
    await rejectsWith(createTransaction(db, { ...base, amount: 100, categoryId: salary }), 'transaction.category');
    await rejectsWith(createTransaction(db, { ...base, amount: 100, categoryId: 999 }), 'transaction.category');
  });
  test('notes are trimmed and capped', async () => {
    const { db, food } = await setup();
    const id = await createTransaction(db, { kind: 'EXPENSE', amount: 1, currency: 'IDR', categoryId: food, note: '  kopi   susu  ', occurredAt: at(2026, 10, 1) });
    assert.equal((await getTransaction(db, id))!.note, 'kopi susu');
  });
  test('edit + undo, delete + undo restore the exact row', async () => {
    const { db, transport, spend } = await setup();
    const id = await spend(25_000, at(2026, 10, 6));
    const { category: _c, ...before } = (await getTransaction(db, id))!;
    await updateTransaction(db, id, { kind: 'EXPENSE', amount: 30_000, currency: 'USD', categoryId: transport, note: 'taxi', occurredAt: at(2026, 10, 7) });
    assert.equal((await getTransaction(db, id))!.currency, 'USD');
    await putTransaction(db, before);
    const { category: _c2, ...restored } = (await getTransaction(db, id))!;
    assert.deepEqual(restored, before);
    const removed = await deleteTransaction(db, id);
    assert.equal(await getTransaction(db, id), null);
    await putTransaction(db, removed);
    const { category: _c3, ...back } = (await getTransaction(db, id))!;
    assert.deepEqual(back, before);
  });
});

describe('categories with transactions', () => {
  test('a used category cannot be deleted, only archived — and stays in history', async () => {
    const { db, food, spend } = await setup();
    const id = await spend(25_000, at(2026, 10, 6));
    assert.equal(await categoryUsage(db, food), 1);
    await rejectsWith(deleteCategory(db, food), 'category.inUse');
    await archiveCategory(db, food);
    const t = (await getTransaction(db, id))!;
    assert.equal(t.category.id, food);
    assert.ok(t.category.archived_at);
  });
  test('the add grid puts the most used of the last 60 days first', async () => {
    const { db, food, transport, spend } = await setup();
    const now = new Date(2026, 10, 18);
    await spend(1, at(2026, 11, 10), transport);
    await spend(1, at(2026, 11, 11), transport);
    await spend(1, at(2026, 11, 12), food);
    // Old uses (> 60 days) don't count.
    for (let i = 0; i < 5; i++) await spend(1, at(2026, 6, 1 + i), food);
    assert.deepEqual((await listCategoriesByUse(db, 'EXPENSE', now)).map((c) => c.id), [transport, food]);
    // Archived categories leave the picker.
    await archiveCategory(db, transport);
    assert.deepEqual((await listCategoriesByUse(db, 'EXPENSE', now)).map((c) => c.id), [food]);
  });
});

describe('summarize (the one totals function)', () => {
  test('spent, income, left, count, by category, top category', async () => {
    const { db, food, transport, salary, spend } = await setup();
    await spend(50_000, at(2026, 10, 2), food);
    await spend(30_000, at(2026, 10, 3), transport);
    await spend(20_000, at(2026, 10, 4), food);
    await createTransaction(db, { kind: 'INCOME', amount: 1_000_000, currency: 'IDR', categoryId: salary, note: '', occurredAt: at(2026, 10, 1) });
    const rows = await listTransactions(db, periodRange('2026-10', 1));
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
    const rows = await listTransactions(db, periodRange('2026-10', 1));
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
    const rows = await listTransactions(db, periodRange('2026-10', 25));
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
  await createTransaction(db, { kind: 'INCOME', amount: 7, currency: 'IDR', categoryId: salary, note: '', occurredAt: at(2026, 10, 5) });
  const groups = groupByDay(await listTransactions(db, periodRange('2026-10', 1)), 'IDR');
  assert.deepEqual(groups.map((g) => [g.key, g.items.length, g.spent, g.income]), [
    ['2026-10-06', 3, 15_000, 0],
    ['2026-10-05', 1, 0, 7],
  ]);
});
