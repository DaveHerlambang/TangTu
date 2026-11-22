/**
 * Money (§3, §14.1): amounts are integers in the currency's smallest unit — rupiah and yen have
 * none, so 25000 IDR = Rp 25.000; dollars, euros and SGD have cents, so 450 USD = $4.50. Each
 * transaction stores its own currency; the default currency is a setting. Formatting is done by
 * hand (not Intl) so it is the same on every phone, in each currency's usual style.
 * Pure: no React Native imports (the tests run it under Node).
 */

export const CURRENCIES = ['IDR', 'USD', 'JPY', 'EUR', 'SGD'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = 'IDR';

export const isCurrency = (v: unknown): v is Currency => typeof v === 'string' && (CURRENCIES as readonly string[]).includes(v);

interface CurrencySpec {
  symbol: string;
  /** Digits after the decimal separator (0 = whole units only). */
  decimals: 0 | 2;
  group: '.' | ',';
  decimal: ',' | '.';
  /** A space between symbol and number ("Rp 25.000" vs "$4.50"). */
  space: boolean;
  /** Most digits before the decimal separator the number pad accepts. */
  maxWhole: number;
  /** Quick amount chips on the number pad, in the smallest unit. */
  quick: readonly number[];
}

const SPECS: Record<Currency, CurrencySpec> = {
  IDR: { symbol: 'Rp', decimals: 0, group: '.', decimal: ',', space: true, maxWhole: 12, quick: [10_000, 20_000, 50_000, 100_000] },
  USD: { symbol: '$', decimals: 2, group: ',', decimal: '.', space: false, maxWhole: 9, quick: [500, 1_000, 2_000, 5_000] },
  JPY: { symbol: '¥', decimals: 0, group: ',', decimal: '.', space: false, maxWhole: 10, quick: [500, 1_000, 2_000, 5_000] },
  EUR: { symbol: '€', decimals: 2, group: '.', decimal: ',', space: false, maxWhole: 9, quick: [500, 1_000, 2_000, 5_000] },
  SGD: { symbol: 'S$', decimals: 2, group: ',', decimal: '.', space: false, maxWhole: 9, quick: [500, 1_000, 2_000, 5_000] },
};

export const currencySymbol = (c: Currency) => SPECS[c].symbol;
export const currencyDecimals = (c: Currency) => SPECS[c].decimals;
export const decimalSeparator = (c: Currency) => SPECS[c].decimal;
export const quickAmounts = (c: Currency) => SPECS[c].quick;

const groupDigits = (digits: string, sep: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);

/** "Rp 1.250.000", "$1,250.50", "€1.250,50", "S$1,250.50", "¥1,250"; negatives "-Rp 15.000". */
export function formatMoney(minor: number, currency: Currency): string {
  const s = SPECS[currency];
  const abs = Math.abs(Math.round(minor));
  const factor = 10 ** s.decimals;
  let number = groupDigits(String(Math.floor(abs / factor)), s.group);
  if (s.decimals) number += s.decimal + String(abs % factor).padStart(s.decimals, '0');
  return `${minor < 0 ? '-' : ''}${s.symbol}${s.space ? ' ' : ''}${number}`;
}

/** "+Rp 25.000" for income. */
export const formatSignedMoney = (minor: number, currency: Currency) =>
  minor > 0 ? `+${formatMoney(minor, currency)}` : formatMoney(minor, currency);

/** Same shape with every digit dotted out: "Rp •.•••.•••" (the eye, §8.6). */
export const maskMoney = (minor: number, currency: Currency) => formatMoney(minor, currency).replace(/\d/g, '•');

// ---------------------------------------------------------------------------
// Number pad (§4): what the user has typed, kept as text so "12." and "12.5" show as typed.

export interface AmountEntry {
  whole: string;
  /** null = no decimal separator typed yet. */
  frac: string | null;
}

export const EMPTY_ENTRY: AmountEntry = { whole: '', frac: null };

export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '000' | 'decimal' | 'back' | 'clear';

/** The pad's state after a key press. Invalid presses (too many digits, a 2nd separator) change nothing. */
export function pressKey(entry: AmountEntry, key: PadKey, currency: Currency): AmountEntry {
  const s = SPECS[currency];
  switch (key) {
    case 'clear':
      return EMPTY_ENTRY;
    case 'back':
      if (entry.frac !== null) return { whole: entry.whole, frac: entry.frac.length ? entry.frac.slice(0, -1) : null };
      return { whole: entry.whole.slice(0, -1), frac: null };
    case 'decimal':
      if (!s.decimals || entry.frac !== null) return entry;
      return { whole: entry.whole || '0', frac: '' };
    case '000': {
      if (entry.frac !== null || !entry.whole || entry.whole === '0') return entry;
      const whole = (entry.whole + '000').slice(0, s.maxWhole);
      return { whole, frac: null };
    }
    default: {
      if (entry.frac !== null) {
        return entry.frac.length < s.decimals ? { whole: entry.whole, frac: entry.frac + key } : entry;
      }
      if (entry.whole === '0') return { whole: key, frac: null };
      if (entry.whole.length >= s.maxWhole) return entry;
      return { whole: entry.whole + key, frac: null };
    }
  }
}

/** The typed amount in the smallest unit (0 when nothing is typed). */
export function entryToMinor(entry: AmountEntry, currency: Currency): number {
  const d = SPECS[currency].decimals;
  const whole = Number(entry.whole || '0');
  const frac = d ? Number((entry.frac ?? '').padEnd(d, '0')) : 0;
  return whole * 10 ** d + frac;
}

/** An amount back into pad state (editing a transaction): 450 USD → "4" "50"; 400 USD → "4". */
export function minorToEntry(minor: number, currency: Currency): AmountEntry {
  if (minor <= 0) return EMPTY_ENTRY;
  const d = SPECS[currency].decimals;
  const factor = 10 ** d;
  const frac = minor % factor;
  return { whole: String(Math.floor(minor / factor)), frac: d && frac ? String(frac).padStart(d, '0').replace(/0$/, '') : null };
}

/** The amount as it is being typed: "Rp 25.000", "$12.", "$12.5", "€0,99". Empty shows "0". */
export function formatEntry(entry: AmountEntry, currency: Currency): string {
  const s = SPECS[currency];
  let number = groupDigits(entry.whole || '0', s.group);
  if (entry.frac !== null) number += s.decimal + entry.frac;
  return `${s.symbol}${s.space ? ' ' : ''}${number}`;
}

/** Switching currency while typing keeps the digits, dropping decimals the new currency doesn't have. */
export function convertEntry(entry: AmountEntry, to: Currency): AmountEntry {
  return SPECS[to].decimals ? entry : { whole: entry.whole, frac: null };
}
