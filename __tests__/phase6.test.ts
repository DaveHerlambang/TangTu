// Phase 6 (§8.7, §10, §5, §3): how the bell's messages read in both languages, period recaps, release notes,
// and search's name matching and date chips. Since 0.5.0 the data is online: storing the bell, the search
// itself and the restore are database functions, tested on PGlite (schema.test.ts).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { RELEASE_NOTES } from '@/constants/releaseNotes';
import { buildRecap, type Activity, type ActivityKind, type ActivityParams } from '@/db/activityRepository';
import { en } from '@/i18n/en';
import { makeTranslator } from '@/i18n/core';
import { describeActivity } from '@/utils/activityText';
import { nameMatches } from '@/utils/categoryNames';
import { searchRange } from '@/utils/searchRange';
import type { Id } from '@/types/models';

import { memoryData, testId } from './support/memory';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const EN = makeTranslator('en');
const ID = makeTranslator('id');
/** A bell row as the history holds it (its text depends only on kind + params). */
const row = <K extends ActivityKind>(kind: K, params: ActivityParams[K]) => ({ id: testId(1), kind, params, created_at: at(2026, 11, 1) }) as Activity;

describe('period recap', () => {
  test('totals from summarize, top 3 categories, nothing for an empty period', async () => {
    const db = memoryData();
    const cat = async (templateKey: 'food' | 'transport' | 'bills' | 'fun', icon: 'fast-food' | 'car' | 'receipt' | 'game-controller') =>
      db.createCategory({ kind: 'EXPENSE', name: null, templateKey, icon, tint: 'peach' });
    const food = await cat('food', 'fast-food');
    const transport = await cat('transport', 'car');
    const bills = await cat('bills', 'receipt');
    const fun = await cat('fun', 'game-controller');
    const salary = await db.createCategory({ kind: 'INCOME', name: null, templateKey: 'salary', icon: 'cash', tint: 'mint' });
    const add = (kind: 'EXPENSE' | 'INCOME', amount: number, categoryId: Id, d: number) =>
      db.createTransaction({ kind, amount, currency: 'IDR', categoryId, note: '', occurredAt: at(2026, 10, d) });
    await add('EXPENSE', 300_000, food, 2);
    await add('EXPENSE', 100_000, transport, 3);
    await add('EXPENSE', 400_000, bills, 5);
    await add('EXPENSE', 50_000, fun, 6);
    await add('INCOME', 1_000_000, salary, 1);

    assert.equal(await buildRecap(db.rowsIn, '2026-09', 1, 'IDR'), null);
    const recap = (await buildRecap(db.rowsIn, '2026-10', 1, 'IDR'))!;
    assert.equal(recap.spent, 850_000);
    assert.equal(recap.income, 1_000_000);
    assert.equal(recap.left, 150_000);
    assert.equal(recap.count, 5);
    assert.deepEqual(recap.top.map((c) => c.id), [bills, food, transport]);

    // Written out in the current language, template names following it.
    const inEnglish = describeActivity(row('recap', recap), EN);
    const inIndonesian = describeActivity(row('recap', recap), ID);
    assert.equal(inEnglish.title, 'October 2026 recap');
    assert.equal(inIndonesian.title, 'Rekap Oktober 2026');
    assert.match(inEnglish.body, /^Spent Rp 850\.000 · income Rp 1\.000\.000 · left Rp 150\.000/);
    assert.match(inEnglish.body, /Top: Bills Rp 400\.000 · Food & Drinks Rp 300\.000 · Transport Rp 100\.000/);
    assert.match(inIndonesian.body, /Teratas: Tagihan Rp 400\.000 · Makan & Minum Rp 300\.000/);
    assert.match(inIndonesian.body, /5 transaksi/);
  });
});

describe('every bell message reads in both languages', () => {
  test('restore, restore undone, what’s new', () => {
    const restore = row('restore', { exportedAt: at(2026, 11, 1), categories: 1, transactions: 3, undoUntil: at(2026, 11, 26) });
    for (const r of [restore, row('restore_undone', {}), row('whats_new', { version: RELEASE_NOTES[0].version })]) {
      for (const tr of [EN, ID]) {
        const { title, body } = describeActivity(r, tr);
        assert.ok(title.length > 0 && body.length > 0, `${r.kind} ${tr.lang}`);
        assert.ok(!/\{\w+\}/.test(title + body), `unfilled placeholder in ${r.kind} ${tr.lang}: ${title} ${body}`);
      }
    }
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

describe('search: category names', () => {
  test('a category matches by its shown name in either language', async () => {
    const db = memoryData();
    const food = await db.createCategory({ kind: 'EXPENSE', name: null, templateKey: 'food', icon: 'fast-food', tint: 'peach' });
    const kopi = await db.createCategory({ kind: 'EXPENSE', name: 'Kopi', templateKey: null, icon: 'cafe', tint: 'amber' });
    const byName = (text: string) => db.categories.filter((c) => nameMatches(c, text)).map((c) => c.id);
    assert.deepEqual(byName('makan'), [food]); // Indonesian name of the Food & Drinks template
    assert.deepEqual(byName('drinks'), [food]);
    assert.deepEqual(byName('kop'), [kopi]);
    assert.deepEqual(byName('nothing like it'), []);
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
});
