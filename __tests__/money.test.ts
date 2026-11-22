// Money formats and the number pad (§3, §4, §14.1).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  EMPTY_ENTRY,
  convertEntry,
  entryToMinor,
  formatEntry,
  formatMoney,
  formatSignedMoney,
  maskMoney,
  minorToEntry,
  pressKey,
  type AmountEntry,
  type Currency,
  type PadKey,
} from '@/utils/money';

const type = (keys: PadKey[], currency: Currency, from: AmountEntry = EMPTY_ENTRY) =>
  keys.reduce((e, k) => pressKey(e, k, currency), from);

describe('formatMoney: each currency in its usual style', () => {
  test('rupiah (the spec format)', () => {
    assert.equal(formatMoney(1_250_000, 'IDR'), 'Rp 1.250.000');
    assert.equal(formatMoney(-15_000, 'IDR'), '-Rp 15.000');
    assert.equal(formatMoney(0, 'IDR'), 'Rp 0');
    assert.equal(formatMoney(999, 'IDR'), 'Rp 999');
  });
  test('cents currencies always show two decimals', () => {
    assert.equal(formatMoney(125_050, 'USD'), '$1,250.50');
    assert.equal(formatMoney(400, 'USD'), '$4.00');
    assert.equal(formatMoney(5, 'USD'), '$0.05');
    assert.equal(formatMoney(125_050, 'EUR'), '€1.250,50');
    assert.equal(formatMoney(125_050, 'SGD'), 'S$1,250.50');
    assert.equal(formatMoney(-1250, 'SGD'), '-S$12.50');
  });
  test('yen has no decimals', () => assert.equal(formatMoney(1250, 'JPY'), '¥1,250'));
  test('signed and masked', () => {
    assert.equal(formatSignedMoney(25_000, 'IDR'), '+Rp 25.000');
    assert.equal(maskMoney(4_500_000, 'IDR'), 'Rp •.•••.•••');
    assert.equal(maskMoney(450, 'USD'), '$•.••');
  });
});

describe('number pad', () => {
  test('rupiah: digits, 000, backspace', () => {
    const e = type(['2', '5', '000'], 'IDR');
    assert.equal(formatEntry(e, 'IDR'), 'Rp 25.000');
    assert.equal(entryToMinor(e, 'IDR'), 25_000);
    assert.equal(entryToMinor(type(['back'], 'IDR', e), 'IDR'), 2_500);
    // No decimal separator in rupiah.
    assert.deepEqual(type(['decimal'], 'IDR', e), e);
  });
  test('leading zeros and 000 on nothing do nothing', () => {
    assert.deepEqual(type(['000'], 'IDR'), EMPTY_ENTRY);
    assert.equal(formatEntry(type(['0', '0', '7'], 'IDR'), 'IDR'), 'Rp 7');
    assert.deepEqual(type(['0', '000'], 'IDR'), { whole: '0', frac: null });
  });
  test('dollars: decimals as typed, at most two', () => {
    const e = type(['1', '2', 'decimal', '5'], 'USD');
    assert.equal(formatEntry(e, 'USD'), '$12.5');
    assert.equal(entryToMinor(e, 'USD'), 1250);
    const full = type(['9', '9', '9'], 'USD', e);
    assert.equal(formatEntry(full, 'USD'), '$12.59');
    assert.equal(entryToMinor(full, 'USD'), 1259);
    assert.equal(formatEntry(type(['decimal', '9', '9'], 'EUR'), 'EUR'), '€0,99');
    assert.deepEqual(type(['decimal', 'decimal'], 'USD'), { whole: '0', frac: '' });
    // Backspace removes the separator after the decimals.
    assert.equal(formatEntry(type(['back', 'back', 'back'], 'USD', full), 'USD'), '$12');
  });
  test('caps the number of digits', () => {
    const e = type(Array<PadKey>(20).fill('9'), 'IDR');
    assert.equal(e.whole.length, 12);
    assert.equal(type(Array<PadKey>(20).fill('9'), 'USD').whole.length, 9);
  });
  test('editing: amounts back into pad state', () => {
    assert.deepEqual(minorToEntry(450, 'USD'), { whole: '4', frac: '5' });
    assert.deepEqual(minorToEntry(405, 'USD'), { whole: '4', frac: '05' });
    assert.deepEqual(minorToEntry(400, 'USD'), { whole: '4', frac: null });
    assert.deepEqual(minorToEntry(25_000, 'IDR'), { whole: '25000', frac: null });
    for (const [minor, c] of [[450, 'USD'], [405, 'EUR'], [25_000, 'IDR'], [1, 'SGD'], [3000, 'JPY']] as const) {
      assert.equal(entryToMinor(minorToEntry(minor, c), c), minor);
    }
  });
  test('switching currency keeps the digits and drops decimals the new one lacks', () => {
    const e = type(['1', '2', 'decimal', '5'], 'USD');
    assert.deepEqual(convertEntry(e, 'IDR'), { whole: '12', frac: null });
    assert.deepEqual(convertEntry(e, 'EUR'), e);
  });
});
