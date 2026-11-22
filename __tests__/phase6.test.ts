// Phase 6 (§8.7, §10, §5, §3): migrations from older schemas, the bell's history and how it reads in
// both languages, period recaps, release notes, and search — against real SQLite.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { RELEASE_NOTES } from '@/constants/releaseNotes';
import {
  ACTIVITY_MAX_ROWS,
  addActivity,
  buildRecap,
  clearActivity,
  countUnreadActivity,
  listActivity,
} from '@/db/activityRepository';
import { createBackup, replaceAllData, validateBackup } from '@/db/backupRepository';
import { createCategory } from '@/db/categoriesRepository';
import { MIGRATIONS, SCHEMA_VERSION, initializeDatabase } from '@/db/database';
import { createTransaction, listUsedCategories, searchTransactions } from '@/db/transactionsRepository';
import { en } from '@/i18n/en';
import { makeTranslator } from '@/i18n/core';
import { describeActivity } from '@/utils/activityText';
import { nameMatches } from '@/utils/categoryNames';
import { searchRange } from '@/utils/searchRange';

import { rawTestDb, testDb } from './support/db';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const EN = makeTranslator('en');
const ID = makeTranslator('id');

describe('migrations from every older schema', () => {
  for (let from = 0; from < SCHEMA_VERSION; from++) {
    test(`v${from} → v${SCHEMA_VERSION} keeps the data`, async () => {
      const { db, raw } = rawTestDb();
      raw.exec('PRAGMA foreign_keys = ON');
      for (let v = 0; v < from; v++) raw.exec(MIGRATIONS[v]);
      raw.exec(`PRAGMA user_version = ${from}`);
      if (from >= 1) raw.exec(`INSERT INTO Categories (id, name, kind, icon, tint, position, created_at) VALUES (1, 'Kopi', 'EXPENSE', 'cafe', 'amber', 0, '${at(2026, 1, 1)}')`);
      if (from >= 2) {
        raw.exec(
          `INSERT INTO Transactions (kind, amount, currency, category_id, note, occurred_at, created_at, updated_at) VALUES ('EXPENSE', 18000, 'IDR', 1, 'kopi', '${at(2026, 10, 1)}', '${at(2026, 10, 1)}', '${at(2026, 10, 1)}')`,
        );
      }
      await initializeDatabase(db);
      assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, SCHEMA_VERSION);
      const backup = await createBackup(db, {});
      assert.equal(backup.tables.Categories?.length, from >= 1 ? 1 : 0);
      assert.equal(backup.tables.Transactions?.length, from >= 2 ? 1 : 0);
      assert.equal(await countUnreadActivity(db, null), 0);
    });
  }
});

describe('the bell', () => {
  test('stores kind + params, newest first, dedupes, counts unread, trims', async () => {
    const db = await testDb();
    assert.equal(await addActivity(db, 'whats_new', { version: '0.1.0' }, { dedupeKey: 'whatsnew:0.1.0', now: new Date(2026, 10, 1) }), true);
    assert.equal(await addActivity(db, 'whats_new', { version: '0.1.0' }, { dedupeKey: 'whatsnew:0.1.0' }), false);
    await addActivity(db, 'restore_undone', {}, { now: new Date(2026, 10, 2) });
    const rows = await listActivity(db);
    assert.deepEqual(rows.map((r) => r.kind), ['restore_undone', 'whats_new']);
    assert.equal(await countUnreadActivity(db, null), 2);
    assert.equal(await countUnreadActivity(db, new Date(2026, 10, 1, 12).toISOString()), 1);
    for (let i = 0; i < ACTIVITY_MAX_ROWS + 5; i++) await addActivity(db, 'restore_undone', {}, { now: new Date(2026, 10, 3, 0, i) });
    assert.equal((await listActivity(db)).length, ACTIVITY_MAX_ROWS);
    await clearActivity(db);
    assert.equal((await listActivity(db)).length, 0);
  });

  test('unknown kinds and unreadable params are skipped, not crashed on', async () => {
    const db = await testDb();
    await db.runAsync(`INSERT INTO Activity (kind, params, created_at) VALUES ('from_the_future', '{}', ?), ('recap', 'not json', ?)`, at(2026, 1, 1), at(2026, 1, 1));
    assert.deepEqual(await listActivity(db), []);
  });

  test('a restore clears the history (it is never backed up)', async () => {
    const db = await testDb();
    await createCategory(db, { kind: 'EXPENSE', name: 'Kopi', templateKey: null, icon: 'cafe', tint: 'amber' });
    const backup = await createBackup(db, {});
    assert.equal('Activity' in backup.tables, false);
    await addActivity(db, 'whats_new', { version: '0.1.0' });
    await replaceAllData(db, validateBackup(JSON.parse(JSON.stringify(backup)), SCHEMA_VERSION));
    assert.equal((await listActivity(db)).length, 0);
  });
});

describe('period recap', () => {
  test('totals from summarize, top 3 categories, nothing for an empty period', async () => {
    const db = await testDb();
    const cat = async (templateKey: 'food' | 'transport' | 'bills' | 'fun', icon: 'fast-food' | 'car' | 'receipt' | 'game-controller') =>
      createCategory(db, { kind: 'EXPENSE', name: null, templateKey, icon, tint: 'peach' });
    const food = await cat('food', 'fast-food');
    const transport = await cat('transport', 'car');
    const bills = await cat('bills', 'receipt');
    const fun = await cat('fun', 'game-controller');
    const salary = await createCategory(db, { kind: 'INCOME', name: null, templateKey: 'salary', icon: 'cash', tint: 'mint' });
    const add = (kind: 'EXPENSE' | 'INCOME', amount: number, categoryId: number, d: number) =>
      createTransaction(db, { kind, amount, currency: 'IDR', categoryId, note: '', occurredAt: at(2026, 10, d) });
    await add('EXPENSE', 300_000, food, 2);
    await add('EXPENSE', 100_000, transport, 3);
    await add('EXPENSE', 400_000, bills, 5);
    await add('EXPENSE', 50_000, fun, 6);
    await add('INCOME', 1_000_000, salary, 1);

    assert.equal(await buildRecap(db, '2026-09', 1, 'IDR'), null);
    const recap = (await buildRecap(db, '2026-10', 1, 'IDR'))!;
    assert.equal(recap.spent, 850_000);
    assert.equal(recap.income, 1_000_000);
    assert.equal(recap.left, 150_000);
    assert.equal(recap.count, 5);
    assert.deepEqual(recap.top.map((c) => c.id), [bills, food, transport]);

    // Written out in the current language, template names following it.
    await addActivity(db, 'recap', recap);
    const [row] = await listActivity(db);
    const inEnglish = describeActivity(row, EN);
    const inIndonesian = describeActivity(row, ID);
    assert.equal(inEnglish.title, 'October 2026 recap');
    assert.equal(inIndonesian.title, 'Rekap Oktober 2026');
    assert.match(inEnglish.body, /^Spent Rp 850\.000 · income Rp 1\.000\.000 · left Rp 150\.000/);
    assert.match(inEnglish.body, /Top: Bills Rp 400\.000 · Food & Drinks Rp 300\.000 · Transport Rp 100\.000/);
    assert.match(inIndonesian.body, /Teratas: Tagihan Rp 400\.000 · Makan & Minum Rp 300\.000/);
    assert.match(inIndonesian.body, /5 transaksi/);
  });
});

describe('every bell message reads in both languages', () => {
  test('restore, restore undone, what’s new', async () => {
    const db = await testDb();
    await addActivity(db, 'restore', { exportedAt: at(2026, 11, 1), categories: 1, transactions: 3, undoUntil: at(2026, 11, 26) });
    await addActivity(db, 'restore_undone', {});
    await addActivity(db, 'whats_new', { version: RELEASE_NOTES[0].version });
    for (const row of await listActivity(db)) {
      for (const tr of [EN, ID]) {
        const { title, body } = describeActivity(row, tr);
        assert.ok(title.length > 0 && body.length > 0, `${row.kind} ${tr.lang}`);
        assert.ok(!/\{\w+\}/.test(title + body), `unfilled placeholder in ${row.kind} ${tr.lang}: ${title} ${body}`);
      }
    }
    const restore = (await listActivity(db)).find((r) => r.kind === 'restore')!;
    assert.match(describeActivity(restore, EN).body, /1 category, 3 transactions/);
    assert.match(describeActivity(restore, EN).body, /until 26 Nov 2026/);
  });
});

describe('release notes', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')) as { expo: { version: string } };
  const parse = (v: string) => v.split('.').map(Number);

  test('the newest entry is the app version (app.json = package.json)', () => {
    assert.equal(app.expo.version, pkg.version);
    assert.equal(RELEASE_NOTES[0].version, pkg.version);
  });
  test('newest first, real dates, both languages with the same shape', () => {
    for (let i = 0; i < RELEASE_NOTES.length; i++) {
      const r = RELEASE_NOTES[i];
      assert.match(r.version, /^\d+\.\d+\.\d+$/);
      assert.ok(!Number.isNaN(new Date(`${r.date}T12:00:00`).getTime()), r.date);
      if (i > 0) {
        const [a, b] = [parse(RELEASE_NOTES[i - 1].version), parse(r.version)];
        assert.ok(a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2]))), `${r.version} out of order`);
      }
      assert.ok(r.en.summary && r.id.summary);
      assert.deepEqual(
        r.id.sections.map((s) => [s.heading, s.items.length]),
        r.en.sections.map((s) => [s.heading, s.items.length]),
        `${r.version}: Indonesian sections differ`,
      );
      for (const text of [r.id.summary, ...r.id.sections.flatMap((s) => s.items)]) assert.ok(!/\bAnda\b/.test(text), text);
    }
  });
});

describe('search', () => {
  async function setup() {
    const db = await testDb();
    const food = await createCategory(db, { kind: 'EXPENSE', name: null, templateKey: 'food', icon: 'fast-food', tint: 'peach' });
    const kopi = await createCategory(db, { kind: 'EXPENSE', name: 'Kopi', templateKey: null, icon: 'cafe', tint: 'amber' });
    const unused = await createCategory(db, { kind: 'EXPENSE', name: 'Unused', templateKey: null, icon: 'car', tint: 'sky' });
    const add = (amount: number, categoryId: number, note: string, d: number) =>
      createTransaction(db, { kind: 'EXPENSE', amount, currency: 'IDR', categoryId, note, occurredAt: at(2026, 10, d) });
    const padang = await add(30_000, food, 'Nasi padang', 1);
    const latte = await add(35_000, kopi, 'Latte 50% off', 2);
    const bakso = await add(20_000, food, 'Bakso', 3);
    return { db, food, kopi, unused, padang, latte, bakso };
  }

  test('by note (case-insensitive), wildcards taken literally', async () => {
    const { db, padang, latte } = await setup();
    const find = async (text: string) => (await searchTransactions(db, { text, nameMatchIds: [], categoryIds: [] })).map((r) => r.id);
    assert.deepEqual(await find('PADANG'), [padang]);
    assert.deepEqual(await find('50%'), [latte]);
    assert.deepEqual(await find('%'), [latte]);
    assert.deepEqual(await find('_'), []);
  });

  test('by category name in either language, and by chips; newest first', async () => {
    const { db, food, kopi, unused, padang, latte, bakso } = await setup();
    const used = await listUsedCategories(db);
    assert.deepEqual(used.map((c) => c.id), [food, kopi]);
    assert.ok(!used.some((c) => c.id === unused));
    const byName = (text: string) => used.filter((c) => nameMatches(c, text)).map((c) => c.id);
    assert.deepEqual(byName('makan'), [food]); // Indonesian name of the Food & Drinks template
    assert.deepEqual(byName('drinks'), [food]);
    assert.deepEqual(byName('kop'), [kopi]);
    const rows = await searchTransactions(db, { text: 'makan', nameMatchIds: byName('makan'), categoryIds: [] });
    assert.deepEqual(rows.map((r) => r.id), [bakso, padang]);
    const chips = await searchTransactions(db, { text: '', nameMatchIds: [], categoryIds: [kopi] });
    assert.deepEqual(chips.map((r) => r.id), [latte]);
    const both = await searchTransactions(db, { text: 'a', nameMatchIds: [], categoryIds: [food] });
    assert.deepEqual(both.map((r) => r.id), [bakso, padang]);
  });
});

test('every new screen string exists (sanity: the dictionaries stay in step)', () => {
  for (const key of ['search.range.pick', 'screen.notifications', 'screen.whatsNew', 'settings.startDay.sheetHint'] as const) assert.ok(en[key]);
});

describe('search on Home (0.3.0): date chips', () => {
  test('this / last / three periods follow the shown period and the start day; custom days in either order', () => {
    const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString();
    assert.deepEqual(searchRange('this', '2026-11', 25, null), { start: iso(2026, 10, 25), end: iso(2026, 11, 25) });
    assert.deepEqual(searchRange('last', '2026-11', 1, null), { start: iso(2026, 10, 1), end: iso(2026, 11, 1) });
    assert.deepEqual(searchRange('three', '2026-01', 1, null), { start: iso(2025, 11, 1), end: iso(2026, 2, 1) });
    assert.equal(searchRange('all', '2026-11', 1, null), undefined);
    assert.equal(searchRange('custom', '2026-11', 1, null), undefined);
    const picked = { from: new Date(2026, 10, 3, 18), to: new Date(2026, 9, 12, 7) };
    assert.deepEqual(searchRange('custom', '2026-11', 1, picked), { start: iso(2026, 10, 12), end: iso(2026, 11, 4) });
  });

  test('searchTransactions keeps to the range', async () => {
    const db = await testDb();
    const food = await createCategory(db, { kind: 'EXPENSE', name: null, templateKey: 'food', icon: 'fast-food', tint: 'peach' });
    const add = (d: Date) => createTransaction(db, { kind: 'EXPENSE', amount: 10_000, currency: 'IDR', categoryId: food, note: 'x', occurredAt: d.toISOString() });
    const oct31 = await add(new Date(2026, 9, 31, 23, 59));
    const nov1 = await add(new Date(2026, 10, 1, 0, 0));
    const find = async (range?: { start: string; end: string }) =>
      (await searchTransactions(db, { text: '', nameMatchIds: [], categoryIds: [], range })).map((r) => r.id);
    assert.deepEqual(await find(searchRange('this', '2026-11', 1, null)), [nov1]);
    assert.deepEqual(await find(searchRange('last', '2026-11', 1, null)), [oct31]);
    assert.deepEqual(await find(), [nov1, oct31]);
  });
});
