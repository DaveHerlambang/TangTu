// The bell's messages added in 0.3.0 (§8.7): "tanggal tua", the year recap, and the richer period recap
// (biggest purchase, against usual) — built from real SQLite and written out in both languages.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildRecap,
  buildTanggalTua,
  buildYearRecap,
  TANGGAL_TUA_DAYS,
  type Activity,
  type ActivityKind,
  type ActivityParams,
} from '@/db/activityRepository';

import { makeTranslator } from '@/i18n/core';
import { describeActivity } from '@/utils/activityText';
import { recapDedupeKey, recapHandledThrough, yearToRecap } from '@/utils/bellSchedule';
import { periodKey, shiftPeriodKey } from '@/utils/format';
import type { Id } from '@/types/models';

import { memoryData, testId } from './support/memory';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const EN = makeTranslator('en');
const ID = makeTranslator('id');

async function setup() {
  const db = memoryData();
  const food = await db.createCategory({ kind: 'EXPENSE', name: null, templateKey: 'food', icon: 'fast-food', tint: 'peach' });
  const transport = await db.createCategory({ kind: 'EXPENSE', name: null, templateKey: 'transport', icon: 'car', tint: 'sky' });
  const salary = await db.createCategory({ kind: 'INCOME', name: null, templateKey: 'salary', icon: 'cash', tint: 'mint' });
  const spend = (amount: number, categoryId: Id, when: string, note = '') =>
    db.createTransaction({ kind: 'EXPENSE', amount, currency: 'IDR', categoryId, note, occurredAt: when });
  const earn = (amount: number, when: string) =>
    db.createTransaction({ kind: 'INCOME', amount, currency: 'IDR', categoryId: salary, note: '', occurredAt: when });
  return { db, food, transport, spend, earn };
}

/** A bell message of `kind`, written out in both languages (the text depends only on kind + params). */
function shown<K extends ActivityKind>(kind: K, params: ActivityParams[K]) {
  const row = { id: testId(1), kind, params, created_at: '2026-11-01T00:00:00.000Z' } as Activity;
  return { en: describeActivity(row, EN), id: describeActivity(row, ID) };
}

describe('tanggal tua', () => {
  test(`only in the last ${TANGGAL_TUA_DAYS} days, with what is left per day`, async () => {
    const { db, food, spend, earn } = await setup();
    await earn(3_000_000, at(2026, 11, 1));
    await spend(1_600_000, food, at(2026, 11, 5));
    // November has 30 days: on the 23rd, 8 days are left (23…30) — too early; on the 24th, 7.
    assert.equal(await buildTanggalTua(db.rowsIn, '2026-11', 1, 'IDR', new Date(2026, 10, 23, 9)), null);
    const p = (await buildTanggalTua(db.rowsIn, '2026-11', 1, 'IDR', new Date(2026, 10, 24, 9)))!;
    assert.deepEqual({ daysLeft: p.daysLeft, left: p.left, perDay: p.perDay }, { daysLeft: 7, left: 1_400_000, perDay: 200_000 });
    // The last day counts as 1.
    assert.equal((await buildTanggalTua(db.rowsIn, '2026-11', 1, 'IDR', new Date(2026, 10, 30, 22)))!.daysLeft, 1);

    const text = shown('tanggal_tua', p);
    assert.equal(text.en.title, 'Tanggal tua is here');
    assert.match(text.en.body, /^7 days left until November 2026 ends\. You have Rp 1\.400\.000 left, about Rp 200\.000 a day\./);
    assert.equal(text.id.title, 'Tanggal tua dimulai');
    assert.match(text.id.body, /^7 hari lagi sampai November 2026 berakhir\. Sisa Rp 1\.400\.000, sekitar Rp 200\.000 per hari\./);
  });

  test('follows the start day (period 25 Oct – 24 Nov)', async () => {
    const { db, food, spend, earn } = await setup();
    await earn(2_000_000, at(2026, 10, 25));
    await spend(500_000, food, at(2026, 11, 2));
    assert.equal((await buildTanggalTua(db.rowsIn, '2026-11', 25, 'IDR', new Date(2026, 10, 20)))!.daysLeft, 5);
  });

  test('nothing without income, or with nothing left (the bell brings no bad news)', async () => {
    const { db, food, spend, earn } = await setup();
    await spend(100_000, food, at(2026, 11, 5));
    assert.equal(await buildTanggalTua(db.rowsIn, '2026-11', 1, 'IDR', new Date(2026, 10, 26)), null);
    await earn(100_000, at(2026, 11, 6));
    assert.equal(await buildTanggalTua(db.rowsIn, '2026-11', 1, 'IDR', new Date(2026, 10, 26)), null);
  });
});

describe('period recap, richer', () => {
  test('biggest purchase (its note, else its category) and top categories against usual', async () => {
    const { db, food, transport, spend, earn } = await setup();
    // Usual: Food 300.000 and Transport 200.000 in each of Jul, Aug, Sep.
    for (const m of [7, 8, 9]) {
      await spend(300_000, food, at(2026, m, 10));
      await spend(200_000, transport, at(2026, m, 11));
    }
    await earn(5_000_000, at(2026, 10, 1));
    await spend(450_000, food, at(2026, 10, 3), 'Dinner out'); // food 450.000 → 1.5× usual: higher
    await spend(100_000, transport, at(2026, 10, 4)); // transport 100.000 → 0.5×: lower
    const recap = (await buildRecap(db.rowsIn, '2026-10', 1, 'IDR'))!;
    assert.equal(recap.biggest?.amount, 450_000);
    assert.deepEqual(
      recap.compare?.map((c) => [c.id, c.direction]),
      [
        [food, 'up'],
        [transport, 'down'],
      ],
    );
    const text = shown('recap', recap);
    assert.match(text.en.body, /Biggest: Rp 450\.000 \(Dinner out\)/);
    assert.match(text.en.body, /Higher than usual: Food & Drinks/);
    assert.match(text.en.body, /Lower than usual: Transport/);
    assert.match(text.id.body, /Lebih tinggi dari biasanya: Makan & Minum/);
  });

  test('no comparison without 3 earlier periods of data; spending alone when there is no income', async () => {
    const { db, food, spend } = await setup();
    await spend(300_000, food, at(2026, 9, 10));
    await spend(900_000, food, at(2026, 10, 3));
    const recap = (await buildRecap(db.rowsIn, '2026-10', 1, 'IDR'))!;
    assert.deepEqual(recap.compare, []);
    assert.equal(recap.biggest?.amount, 900_000);
    const text = shown('recap', recap);
    assert.match(text.en.body, /^Spent Rp 900\.000\n/);
    assert.doesNotMatch(text.en.body, /left|-Rp/);
    assert.match(text.en.body, /Biggest: Rp 900\.000 \(Food & Drinks\)/);
    assert.match(text.id.body, /^Keluar Rp 900\.000\n/);
  });

  test('a recap written by 0.2.x (no biggest, no comparison) still reads', async () => {
    assert.match(
      shown('recap', { period: '2026-10', startDay: 1, currency: 'IDR', spent: 100, income: 200, left: 100, count: 2, top: [] }).en.body,
      /^Spent Rp 100 · income Rp 200 · left Rp 100\n2 transactions/,
    );
  });
});

describe('year recap', () => {
  test('totals, top categories, biggest and quietest month, biggest purchase', async () => {
    const { db, food, transport, spend, earn } = await setup();
    await earn(6_000_000, at(2026, 1, 1));
    await spend(400_000, food, at(2026, 2, 3));
    await spend(1_500_000, transport, at(2026, 10, 9), 'Flight home');
    await spend(200_000, food, at(2026, 10, 12));
    await spend(50_000, food, at(2025, 12, 30)); // last year: not counted
    const p = (await buildYearRecap(db.rowsIn, 2026, 1, 'IDR'))!;
    assert.equal(p.spent, 2_100_000);
    assert.equal(p.income, 6_000_000);
    assert.equal(p.count, 4);
    assert.deepEqual(
      p.top.map((c) => c.id),
      [transport, food],
    );
    assert.deepEqual(p.highest, { period: '2026-10', spent: 1_700_000 });
    assert.deepEqual(p.lowest, { period: '2026-02', spent: 400_000 });
    assert.equal(p.biggest?.note, 'Flight home');

    const text = shown('year_recap', p);
    assert.equal(text.en.title, 'Your 2026 in TangTu');
    assert.match(text.en.body, /^Spent Rp 2\.100\.000 · income Rp 6\.000\.000\n4 transactions/);
    assert.match(text.en.body, /Biggest month: Oct Rp 1\.700\.000\nQuietest month: Feb Rp 400\.000\nBiggest: Rp 1\.500\.000 \(Flight home\)/);
    assert.equal(text.id.title, '2026 kamu di TangTu');
    assert.match(text.id.body, /Pengeluaran bulanan terbesar: Okt Rp 1\.700\.000/);
  });

  test('a year of periods follows the start day; one month with spending has no "quietest"; empty year → null', async () => {
    const { db, food, spend } = await setup();
    // Start day 25: 30 Dec 2025 is in period 2026-01, so it belongs to 2026.
    await spend(80_000, food, at(2025, 12, 30));
    const p = (await buildYearRecap(db.rowsIn, 2026, 25, 'IDR'))!;
    assert.equal(p.spent, 80_000);
    assert.deepEqual(p.highest, { period: '2026-01', spent: 80_000 });
    assert.equal(p.lowest, null);
    assert.equal(await buildYearRecap(db.rowsIn, 2024, 25, 'IDR'), null);
  });
});

describe('when recaps are due (0.4.1)', () => {
  test('B6: past the income the recap says it calmly, never with a minus', async () => {
    const text = shown('recap', {
      period: '2026-10',
      startDay: 1,
      currency: 'IDR',
      spent: 1_250_000,
      income: 1_000_000,
      left: -250_000,
      count: 3,
      top: [],
    });
    assert.match(text.en.body, /^Spent Rp 1\.250\.000 · income Rp 1\.000\.000 · Rp 250\.000 more than your income\n/);
    assert.match(text.id.body, /^Keluar Rp 1\.250\.000 · masuk Rp 1\.000\.000 · Rp 250\.000 lebih dari pemasukan\n/);
    assert.doesNotMatch(text.en.body + text.id.body, /-Rp/);
  });

  test('B5: a start-day change counts the period just before now (new rule) as handled', () => {
    // 26 Nov: with start day 1 the period before is October; with 25 it is 2026-11 (25 Oct – 24 Nov).
    assert.equal(recapHandledThrough(1, new Date(2026, 10, 26)), '2026-10');
    assert.equal(recapHandledThrough(25, new Date(2026, 10, 26)), '2026-11');
    // Switching 25 → 1 on 26 Nov: on 1 Dec the period before (2026-11 = 1–30 Nov) is newer than the marker,
    // so November gets its recap — it used to be skipped.
    assert.ok(shiftPeriodKey(periodKey(new Date(2026, 11, 1), 1), -1) > recapHandledThrough(1, new Date(2026, 10, 26)));
    // The same key under two start days is two periods: two dedupe keys.
    assert.notEqual(recapDedupeKey(25, '2026-11'), recapDedupeKey(1, '2026-11'));
  });

  test('B2: the year recap is due once, early in the year, whatever the bell history keeps', () => {
    assert.equal(yearToRecap('2027-01', null), 2026);
    assert.equal(yearToRecap('2027-02', null), 2026);
    assert.equal(yearToRecap('2027-03', null), null); // later it is old news
    // Written already: not again, even when the bell's 60-day trim has dropped the message (start day 25).
    assert.equal(yearToRecap('2027-02', 2026), null);
    assert.equal(yearToRecap('2028-01', 2026), 2027);
  });
});
