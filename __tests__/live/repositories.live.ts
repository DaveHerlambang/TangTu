// The repositories against a REAL Supabase project, on two TEST accounts — never the owner's own (§14.14,
// §14.15). Not part of `npm test`: run `npm run test:live` with `.env.test.local` holding
//   TANGTU_LIVE_URL, TANGTU_LIVE_KEY (publishable), TANGTU_LIVE_A_EMAIL, TANGTU_LIVE_A_PASSWORD,
//   TANGTU_LIVE_B_EMAIL, TANGTU_LIVE_B_PASSWORD   (two accounts made in that project's dashboard)
// It EMPTIES both accounts first, so it refuses an email without "test" before the "@" (e.g. you+test-a@gmail.com). What it proves: the app's calls work through PostgREST (embedding, paging,
// upserts for Undo, the database functions), and row level security holds between two signed-in accounts.
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

import { addActivity, countUnreadActivity, hasActivity, listActivity } from '@/db/activityRepository';
import { createBackup, deleteAllData, hasAnyData, replaceAllData, validateBackup } from '@/db/backupRepository';
import {
  archiveCategory,
  categoryUsage,
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  listCategoriesByUse,
  putCategory,
  reorderCategories,
  restoreCategory,
  updateCategory,
} from '@/db/categoriesRepository';
import type { Database } from '@/db/database.types';
import type { Db } from '@/db/db';
import { DomainError } from '@/db/errors';
import {
  createTransaction,
  deleteTransaction,
  firstTransactionAt,
  getTransaction,
  hasAnyTransactions,
  listTransactions,
  listUsedCategories,
  putTransaction,
  searchTransactions,
  updateTransaction,
} from '@/db/transactionsRepository';
import { buildMockBackup } from '@/dev/mockData';

const env = (k: string) => process.env[k]?.trim() ?? '';
const configured = [
  'TANGTU_LIVE_URL',
  'TANGTU_LIVE_KEY',
  'TANGTU_LIVE_A_EMAIL',
  'TANGTU_LIVE_A_PASSWORD',
  'TANGTU_LIVE_B_EMAIL',
  'TANGTU_LIVE_B_PASSWORD',
].every(env);

/** Both accounts are emptied: only test accounts, by name, so a real account in the settings by mistake is never touched. */
const isTestEmail = (email: string) => /test/i.test(email.split('@')[0] ?? '');

async function signedIn(email: string, password: string): Promise<Db> {
  if (!isTestEmail(email)) throw new Error(`refusing ${email}: this check empties the account; use one with "test" before the @`);
  const db = createClient<Database>(env('TANGTU_LIVE_URL'), env('TANGTU_LIVE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return db;
}

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const rejectsWith = (p: Promise<unknown>, code: string) => assert.rejects(p, (e: unknown) => e instanceof DomainError && e.code === code);

describe('repositories on the project, two test accounts', { skip: configured ? false : 'no TANGTU_LIVE_* settings (see the comment at the top)' }, () => {
  let a: Db;
  let b: Db;

  before(async () => {
    a = await signedIn(env('TANGTU_LIVE_A_EMAIL'), env('TANGTU_LIVE_A_PASSWORD'));
    b = await signedIn(env('TANGTU_LIVE_B_EMAIL'), env('TANGTU_LIVE_B_PASSWORD'));
    await deleteAllData(a);
    await deleteAllData(b);
  });

  test('categories: create, names, rename, reorder, archive and restore, delete + Undo', async () => {
    const food = await createCategory(a, { kind: 'EXPENSE', name: null, templateKey: 'food', icon: 'fast-food', tint: 'peach' });
    const coffee = await createCategory(a, { kind: 'EXPENSE', name: 'Coffee', templateKey: null, icon: 'cafe', tint: 'amber' });
    await rejectsWith(
      createCategory(a, { kind: 'EXPENSE', name: 'makan & minum', templateKey: null, icon: 'cafe', tint: 'amber' }),
      'category.nameTaken',
    );
    await updateCategory(a, coffee, { name: 'Kopi', icon: 'cafe', tint: 'rose' });
    assert.equal((await getCategory(a, coffee))?.name, 'Kopi');
    await reorderCategories(a, 'EXPENSE', [coffee, food]);
    assert.deepEqual(
      (await listCategories(a, 'EXPENSE')).map((c) => c.id),
      [coffee, food],
    );
    await archiveCategory(a, coffee);
    assert.deepEqual(
      (await listCategories(a, 'EXPENSE')).map((c) => c.id),
      [food],
    );
    await restoreCategory(a, coffee);
    assert.deepEqual(
      (await listCategories(a, 'EXPENSE')).map((c) => c.id),
      [food, coffee],
    );
    const before = (await getCategory(a, coffee))!;
    const removed = await deleteCategory(a, coffee);
    assert.equal(await getCategory(a, coffee), null);
    await putCategory(a, removed);
    assert.deepEqual(await getCategory(a, coffee), before, 'Undo puts the same row back (id, position, dates)');
  });

  test('transactions: create, embed the category, edit + Undo, delete + Undo, a used category is kept', async () => {
    const [food] = await listCategories(a, 'EXPENSE');
    const salary = await createCategory(a, { kind: 'INCOME', name: null, templateKey: 'salary', icon: 'cash', tint: 'mint' });
    const id = await createTransaction(a, {
      kind: 'EXPENSE',
      amount: 25_000,
      currency: 'IDR',
      categoryId: food.id,
      note: '  Nasi   padang ',
      occurredAt: at(2026, 10, 6),
    });
    await createTransaction(a, { kind: 'INCOME', amount: 8_000_000, currency: 'IDR', categoryId: salary, note: '', occurredAt: at(2026, 10, 1) });
    const t = (await getTransaction(a, id))!;
    assert.equal(t.note, 'Nasi padang');
    assert.equal(t.category.id, food.id);
    assert.equal(t.occurred_at, at(2026, 10, 6), 'dates come back in ISO form');
    await rejectsWith(
      createTransaction(a, { kind: 'EXPENSE', amount: 1, currency: 'IDR', categoryId: salary, note: '', occurredAt: at(2026, 10, 6) }),
      'transaction.category',
    );

    const { category: _c, ...row } = t;
    await updateTransaction(a, id, {
      kind: 'EXPENSE',
      amount: 30_000,
      currency: 'IDR',
      categoryId: food.id,
      note: 'taxi',
      occurredAt: at(2026, 10, 7),
    });
    await putTransaction(a, row);
    const { category: _c2, ...back } = (await getTransaction(a, id))!;
    assert.deepEqual(back, row);
    const deleted = await deleteTransaction(a, id);
    assert.equal(await getTransaction(a, id), null);
    await putTransaction(a, deleted);
    assert.ok(await getTransaction(a, id));

    assert.equal(await categoryUsage(a, food.id), 1);
    await rejectsWith(deleteCategory(a, food.id), 'category.inUse');
    assert.equal(await firstTransactionAt(a), at(2026, 10, 1));
    assert.ok(await hasAnyTransactions(a));
    assert.deepEqual(
      (await listTransactions(a, { start: at(2026, 10, 1, 0), end: at(2026, 11, 1, 0) })).map((r) => r.kind),
      ['EXPENSE', 'INCOME'],
    );
    assert.equal((await listCategoriesByUse(a, 'EXPENSE', new Date(2026, 10, 1)))[0].id, food.id);
    assert.deepEqual(
      (await searchTransactions(a, { text: 'PADANG', nameMatchIds: [], categoryIds: [] })).map((r) => r.id),
      [id],
    );
    assert.ok((await listUsedCategories(a)).some((c) => c.id === food.id));
  });

  test('the bell: dedupe per account, unread count', async () => {
    assert.equal(await addActivity(a, 'whats_new', { version: '0.5.0' }, { dedupeKey: 'whatsnew:0.5.0' }), true);
    assert.equal(await addActivity(a, 'whats_new', { version: '0.5.0' }, { dedupeKey: 'whatsnew:0.5.0' }), false);
    assert.equal(await addActivity(b, 'whats_new', { version: '0.5.0' }, { dedupeKey: 'whatsnew:0.5.0' }), true, 'another account has its own');
    assert.ok(await hasActivity(a, 'whatsnew:0.5.0'));
    assert.equal((await listActivity(a)).length, 1);
    assert.equal(await countUnreadActivity(a, null), 1);
  });

  test("row level security: B sees and changes nothing of A's", async () => {
    const [aFood] = await listCategories(a, 'EXPENSE');
    assert.deepEqual(await listCategories(b, 'EXPENSE'), []);
    assert.equal(await getCategory(b, aFood.id), null);
    assert.equal(await hasAnyData(b), false);
    await rejectsWith(
      createTransaction(b, { kind: 'EXPENSE', amount: 1, currency: 'IDR', categoryId: aFood.id, note: '', occurredAt: at(2026, 10, 6) }),
      'transaction.category',
    );
    await b.from('categories').update({ name: 'Hacked' }).eq('id', aFood.id);
    assert.notEqual((await getCategory(a, aFood.id))?.name, 'Hacked');
  });

  test("backup and restore: A's backup restores into B with new ids; a year of mock data in one call (paging past 1000 rows)", async () => {
    const backup = validateBackup(JSON.parse(JSON.stringify(await createBackup(a, {}))));
    await replaceAllData(b, backup);
    const bBack = await createBackup(b, {});
    assert.equal(bBack.tables.Categories?.length, backup.tables.Categories?.length);
    assert.equal(bBack.tables.Transactions?.length, backup.tables.Transactions?.length);
    assert.notDeepEqual(
      bBack.tables.Categories?.map((c) => c.id),
      backup.tables.Categories?.map((c) => c.id),
      'new ids',
    );
    assert.equal(await countUnreadActivity(b, null), 0, 'a restore clears the bell');

    const mock = buildMockBackup(12, 1, new Date(2026, 10, 19));
    await replaceAllData(b, mock.backup);
    const all = await listTransactions(b, { start: at(2020, 1, 1), end: at(2030, 1, 1) });
    assert.equal(all.length, mock.summary.transactions);
    assert.ok(all.length > 1000, `only ${all.length} rows: paging untested`);
  });
});
