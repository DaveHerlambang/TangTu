// Period maths (§3): start days 1, 25 and 31, across Dec → Jan and February.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  formatPeriodName,
  formatPeriodRange,
  periodEnd,
  periodKey,
  periodLastDay,
  periodStart,
  periodWord,
  shiftPeriodKey,
} from '@/utils/format';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const ymd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Every day of `year` belongs to exactly one period, and the periods tile without gaps. */
function assertTiles(startDay: number, year: number) {
  for (let day = d(year, 1, 1); day.getFullYear() === year; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    const key = periodKey(day, startDay);
    const start = periodStart(key, startDay);
    const end = periodEnd(key, startDay);
    assert.ok(start <= day && day < end, `start day ${startDay}: ${ymd(day)} → ${key} [${ymd(start)}, ${ymd(end)})`);
    // The next period starts where this one ends.
    assert.equal(ymd(periodStart(shiftPeriodKey(key, 1), startDay)), ymd(end));
    // The key is the month the period ends in.
    assert.equal(key, `${periodLastDay(key, startDay).getFullYear()}-${String(periodLastDay(key, startDay).getMonth() + 1).padStart(2, '0')}`);
  }
}

describe('start day 1 (calendar months)', () => {
  test('a date belongs to its own month', () => {
    assert.equal(periodKey(d(2026, 10, 1), 1), '2026-10');
    assert.equal(periodKey(d(2026, 10, 31), 1), '2026-10');
    assert.equal(periodKey(d(2026, 12, 31), 1), '2026-12');
    assert.equal(periodKey(d(2027, 1, 1), 1), '2027-01');
  });
  test('bounds', () => {
    assert.equal(ymd(periodStart('2026-10', 1)), '2026-10-01');
    assert.equal(ymd(periodLastDay('2026-10', 1)), '2026-10-31');
    assert.equal(ymd(periodEnd('2026-12', 1)), '2027-01-01');
    assert.equal(ymd(periodLastDay('2028-02', 1)), '2028-02-29');
  });
  test('tiles every day of a leap and a common year', () => {
    assertTiles(1, 2026);
    assertTiles(1, 2028);
  });
  test('says "month"', () => assert.equal(periodWord(1), 'month'));
});

describe('start day 25 (payday)', () => {
  test('"October" = 25 Sep – 24 Oct', () => {
    assert.equal(ymd(periodStart('2026-10', 25)), '2026-09-25');
    assert.equal(ymd(periodLastDay('2026-10', 25)), '2026-10-24');
    assert.equal(periodKey(d(2026, 9, 25), 25), '2026-10');
    assert.equal(periodKey(d(2026, 10, 24), 25), '2026-10');
    assert.equal(periodKey(d(2026, 10, 25), 25), '2026-11');
  });
  test('Dec → Jan', () => {
    assert.equal(periodKey(d(2026, 12, 25), 25), '2027-01');
    assert.equal(periodKey(d(2026, 12, 31), 25), '2027-01');
    assert.equal(ymd(periodStart('2027-01', 25)), '2026-12-25');
    assert.equal(periodKey(d(2027, 1, 24), 25), '2027-01');
  });
  test('February', () => {
    assert.equal(ymd(periodStart('2027-03', 25)), '2027-02-25');
    assert.equal(ymd(periodLastDay('2027-02', 25)), '2027-02-24');
  });
  test('tiles every day', () => {
    assertTiles(25, 2026);
    assertTiles(25, 2028);
  });
  test('says "period"', () => assert.equal(periodWord(25), 'period'));
});

describe('start day 31 (clamps to short months)', () => {
  test('February starts on its last day', () => {
    // "March" = 28 Feb – 30 Mar in 2027 (common year): Feb has no 31st.
    assert.equal(ymd(periodStart('2027-03', 31)), '2027-02-28');
    assert.equal(ymd(periodLastDay('2027-03', 31)), '2027-03-30');
    // Leap year: 29 Feb.
    assert.equal(ymd(periodStart('2028-03', 31)), '2028-02-29');
    assert.equal(periodKey(d(2027, 2, 27), 31), '2027-02');
    assert.equal(periodKey(d(2027, 2, 28), 31), '2027-03');
  });
  test('30-day months clamp to the 30th', () => {
    assert.equal(ymd(periodStart('2026-05', 31)), '2026-04-30');
    assert.equal(periodKey(d(2026, 4, 29), 31), '2026-04');
    assert.equal(periodKey(d(2026, 4, 30), 31), '2026-05');
  });
  test('Dec → Jan', () => {
    assert.equal(periodKey(d(2026, 12, 31), 31), '2027-01');
    assert.equal(periodKey(d(2026, 12, 30), 31), '2026-12');
    assert.equal(ymd(periodLastDay('2027-01', 31)), '2027-01-30');
  });
  test('tiles every day', () => {
    assertTiles(31, 2026);
    assertTiles(31, 2028);
  });
});

test('every start day 1–31 tiles a year', () => {
  for (let s = 1; s <= 31; s++) assertTiles(s, 2027);
});

test('shiftPeriodKey crosses years', () => {
  assert.equal(shiftPeriodKey('2026-12', 1), '2027-01');
  assert.equal(shiftPeriodKey('2027-01', -1), '2026-12');
  assert.equal(shiftPeriodKey('2026-10', -12), '2025-10');
});

test('names and ranges in both languages', () => {
  assert.equal(formatPeriodName('2026-10', 'en'), 'October 2026');
  assert.equal(formatPeriodName('2026-10', 'id'), 'Oktober 2026');
  assert.equal(formatPeriodRange('2026-10', 25, 'en'), '25 Sep – 24 Oct');
  assert.equal(formatPeriodRange('2026-10', 25, 'id'), '25 Sep – 24 Okt');
  assert.equal(formatPeriodRange('2026-08', 1, 'id'), '1 Agu – 31 Agu');
});
