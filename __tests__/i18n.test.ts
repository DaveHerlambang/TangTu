// Languages (§6.5): both dictionaries complete and consistent, date tables right, "Follow phone".
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { interpolate, makeTranslator, resolveLanguage } from '@/i18n/core';
import {
  MONTHS_LONG,
  MONTHS_SHORT,
  WEEKDAYS_NARROW,
  WEEKDAYS_SHORT,
  formatTime,
  formatWeekdayDayMonth,
} from '@/i18n/dates';
import { en } from '@/i18n/en';
import { id } from '@/i18n/id';
import { formatAgo, formatBackupAge } from '@/utils/format';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1].toLowerCase()).sort();

describe('dictionaries', () => {
  test('Indonesian has exactly the English keys', () => {
    assert.deepEqual(Object.keys(id).sort(), Object.keys(en).sort());
  });
  test('no empty strings', () => {
    for (const [lang, dict] of Object.entries({ en, id })) {
      for (const [key, value] of Object.entries(dict)) assert.ok(value.trim(), `${lang} ${key} is empty`);
    }
  });
  test('both languages use the same placeholders', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      assert.deepEqual(placeholders(id[key]), placeholders(en[key]), `placeholders differ for ${key}`);
    }
  });
  test('every plural (a .one key) has its .other form', () => {
    // Plurals are defined by their `.one` key; a lone `.other` (e.g. the "Other" icon group) is a plain key.
    for (const key of Object.keys(en)) {
      if (key.endsWith('.one')) assert.ok(`${key.slice(0, -4)}.other` in en, `${key} has no .other`);
    }
  });
  test('Indonesian says "kamu", never "Anda"', () => {
    for (const [key, value] of Object.entries(id)) assert.ok(!/\bAnda\b/.test(value), `${key} uses "Anda"`);
  });
});

describe('translator', () => {
  test('interpolates, including the capitalised form', () => {
    assert.equal(interpolate('{n} min ago', { n: 5 }), '5 min ago');
    assert.equal(interpolate('{Period} sebelumnya', { period: 'bulan' }), 'Bulan sebelumnya');
    assert.equal(interpolate('Keep {unknown}', {}), 'Keep {unknown}');
  });
  test('English plurals; Indonesian has none', () => {
    assert.equal(makeTranslator('en').tp('count.transactions', 1), '1 transaction');
    assert.equal(makeTranslator('en').tp('count.transactions', 3), '3 transactions');
    assert.equal(makeTranslator('en').tp('count.transactions', 0), '0 transactions');
    assert.equal(makeTranslator('id').tp('count.transactions', 1), '1 transaksi');
    assert.equal(makeTranslator('id').tp('count.transactions', 3), '3 transaksi');
  });
  test('"Follow phone" picks Indonesian only for an Indonesian phone', () => {
    assert.equal(resolveLanguage('system', 'id'), 'id');
    assert.equal(resolveLanguage('system', 'in'), 'id');
    assert.equal(resolveLanguage('system', 'en'), 'en');
    assert.equal(resolveLanguage('system', 'ms'), 'en');
    assert.equal(resolveLanguage('system', null), 'en');
    assert.equal(resolveLanguage('en', 'id'), 'en');
    assert.equal(resolveLanguage('id', 'en'), 'id');
  });
});

describe('date tables', () => {
  test('12 months and 7 weekdays per language; short months are three letters', () => {
    for (const lang of ['en', 'id'] as const) {
      assert.equal(MONTHS_SHORT[lang].length, 12);
      assert.equal(MONTHS_LONG[lang].length, 12);
      assert.equal(WEEKDAYS_SHORT[lang].length, 7);
      assert.equal(WEEKDAYS_NARROW[lang].length, 7);
      for (const m of MONTHS_SHORT[lang]) assert.equal(m.length, 3, `${lang} "${m}"`);
      for (const w of WEEKDAYS_SHORT[lang]) assert.equal(w.length, 3, `${lang} "${w}"`);
    }
    assert.deepEqual(MONTHS_SHORT.id, ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']);
    assert.equal(MONTHS_SHORT.en[8], 'Sep');
  });
  test('day headers: "Mon, 6 Oct" / "Sen, 6 Okt"', () => {
    const monday = new Date(2025, 9, 6);
    assert.equal(formatWeekdayDayMonth(monday, 'en'), 'Mon, 6 Oct');
    assert.equal(formatWeekdayDayMonth(monday, 'id'), 'Sen, 6 Okt');
    assert.equal(formatWeekdayDayMonth(new Date(2025, 9, 12), 'id'), 'Min, 12 Okt');
  });
  test('24-hour time', () => {
    assert.equal(formatTime(new Date(2026, 0, 1, 9, 5)), '09:05');
    assert.equal(formatTime(new Date(2026, 0, 1, 21, 30)), '21:30');
  });
});

describe('relative dates', () => {
  const now = new Date(2026, 10, 18, 15, 0);
  const en_ = makeTranslator('en');
  const id_ = makeTranslator('id');
  test('formatAgo', () => {
    assert.equal(formatAgo(new Date(2026, 10, 18, 14, 59, 30).toISOString(), en_, now), 'Just now');
    assert.equal(formatAgo(new Date(2026, 10, 18, 14, 48).toISOString(), id_, now), '12 menit lalu');
    assert.equal(formatAgo(new Date(2026, 10, 17, 9, 0).toISOString(), en_, now), 'Yesterday');
    assert.equal(formatAgo(new Date(2026, 9, 5, 9, 0).toISOString(), id_, now), '5 Okt');
  });
  test('formatBackupAge', () => {
    assert.equal(formatBackupAge(null, en_, now), 'never');
    assert.equal(formatBackupAge(new Date(2026, 10, 18, 1, 0).toISOString(), id_, now), 'hari ini');
    assert.equal(formatBackupAge(new Date(2026, 10, 6, 1, 0).toISOString(), en_, now), '12 days ago');
    assert.equal(formatBackupAge(new Date(2026, 4, 6, 1, 0).toISOString(), en_, now), 'on 6 May 2026');
  });
});
