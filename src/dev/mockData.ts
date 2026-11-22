import type { SQLiteDatabase } from 'expo-sqlite';

import { templateOf, type TemplateKey } from '@/constants/categories';
import { createCategory } from '@/db/categoriesRepository';
import { resetDatabase } from '@/db/database';
import { createTransaction } from '@/db/transactionsRepository';
import type { CategoryKind } from '@/types/models';
import { periodKey, periodLastDay, periodStart, shiftPeriodKey } from '@/utils/format';
import { DEFAULT_CURRENCY } from '@/utils/money';

/**
 * DEV ONLY (§12) — fills the database with believable history so the charts, the trend and the
 * lists can be seen with real-looking data. Load it only through the `__DEV__`-guarded dev gear, so
 * it never ships.
 *
 * It REPLACES everything (reset first), so running it twice never duplicates anything, and it's
 * deterministic: the same call on the same day gives the same data. Realistic spending per category,
 * a couple of big months (holidays) and quiet ones, salary on the period's start day, a raise three
 * periods ago, and a few transactions in other currencies (so "not in totals" shows up).
 */

export interface MockSummary {
  periods: number;
  categories: number;
  transactions: number;
}

const EXPENSE_TEMPLATES: readonly TemplateKey[] = ['food', 'groceries', 'transport', 'bills', 'shopping', 'health', 'fun', 'gifts'];
const INCOME_TEMPLATES: readonly TemplateKey[] = ['salary', 'side_income'];

/** Small deterministic generator (mulberry32) so a run is repeatable. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Typed notes are the user's own words: kept as an Indonesian user would write them. */
const NOTES: Partial<Record<TemplateKey, readonly string[]>> = {
  food: ['Kopi susu', 'Makan siang', 'Nasi padang', 'Bakso', 'Martabak', ''],
  groceries: ['Indomaret', 'Pasar', 'Superindo', ''],
  transport: ['Ojek ke kantor', 'KRL', 'Bensin', ''],
  shopping: ['Sepatu', 'Kaos', 'Skincare', ''],
  fun: ['Nonton', 'Karaoke', 'Main game', ''],
  health: ['Apotek', 'Dokter gigi'],
  gifts: ['Kado ulang tahun', 'Kondangan'],
};

export async function seedMockData(db: SQLiteDatabase, months: 6 | 12, startDay: number, now: Date = new Date()): Promise<MockSummary> {
  await resetDatabase(db);
  const rand = rng(20261119 + months * 31 + startDay);
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  /** Rupiah amounts end in 500 or 000, like real prices. */
  const rp = (min: number, max: number, mult = 1) => Math.max(500, Math.round((int(min, max) * mult) / 500) * 500);
  const summary: MockSummary = { periods: months, categories: 0, transactions: 0 };

  await db.withTransactionAsync(async () => {
    const ids = {} as Record<TemplateKey, number>;
    for (const key of [...EXPENSE_TEMPLATES, ...INCOME_TEMPLATES]) {
      const tpl = templateOf(key);
      ids[key] = await createCategory(db, { kind: tpl.kind, name: null, templateKey: key, icon: tpl.icon, tint: tpl.tint });
      summary.categories++;
    }

    const add = async (kind: CategoryKind, key: TemplateKey, amount: number, at: Date, note = '') => {
      if (at.getTime() > now.getTime()) return; // nothing in the future
      await createTransaction(db, { kind, amount, currency: DEFAULT_CURRENCY, categoryId: ids[key], note, occurredAt: at.toISOString() });
      summary.transactions++;
    };
    const spend = (key: TemplateKey, amount: number, at: Date) => add('EXPENSE', key, amount, at, pick(NOTES[key] ?? ['']));

    const current = periodKey(now, startDay);
    for (let back = months - 1; back >= 0; back--) {
      const key = shiftPeriodKey(current, -back);
      const first = periodStart(key, startDay);
      const last = periodLastDay(key, startDay);
      const day = (d: Date, hour: number, minute = int(0, 59)) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute);
      // A big month now and then (holidays, a trip), a quiet one, the rest ordinary.
      const big = back % 4 === 1;
      const quiet = !big && back % 5 === 3;
      const mood = big ? 1.45 : quiet ? 0.7 : 0.9 + rand() * 0.25;

      // Income: salary on the start day (a raise three periods ago), side income sometimes.
      await add('INCOME', 'salary', back >= 3 ? 8_000_000 : 8_500_000, day(first, 9, 0));
      if (rand() < 0.35) await add('INCOME', 'side_income', rp(500_000, 1_500_000), day(first, 20));

      let index = 0;
      for (let d = first; d <= last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), index++) {
        const weekday = d.getDay(); // 0 = Sunday
        const weekend = weekday === 0 || weekday === 6;
        // Food, most days: coffee, lunch, sometimes dinner out.
        if (rand() < 0.6) await spend('food', rp(18_000, 35_000), day(d, 8));
        if (rand() < 0.85) await spend('food', rp(25_000, 55_000, mood), day(d, 12));
        if (rand() < (weekend ? 0.6 : 0.3)) await spend('food', rp(30_000, 90_000, mood), day(d, 19));
        // Transport on workdays.
        if (!weekend && rand() < 0.75) await spend('transport', rp(12_000, 35_000), day(d, 7));
        // Groceries on Saturdays.
        if (weekday === 6) await spend('groceries', rp(150_000, 450_000, mood), day(d, 10));
        // Bills a few days into the period.
        if (index === 4) {
          await add('EXPENSE', 'bills', rp(350_000, 550_000), day(d, 10), 'Listrik');
          await add('EXPENSE', 'bills', 330_000, day(d, 10), 'Internet');
        }
        // Fun at the weekend.
        if (weekend && rand() < 0.35 * mood) await spend('fun', rp(50_000, 250_000, mood), day(d, 16));
      }

      const randomDay = () => new Date(first.getFullYear(), first.getMonth(), first.getDate() + int(0, 27));
      for (let n = int(2, 4) + (big ? 2 : 0); n > 0; n--) await spend('shopping', rp(80_000, 600_000, mood), day(randomDay(), 15));
      if (rand() < 0.3) await spend('health', rp(60_000, 300_000), day(randomDay(), 11));
      if (big) for (let n = int(1, 2); n > 0; n--) await spend('gifts', rp(150_000, 500_000), day(randomDay(), 18));
      // An app subscription now and then. Rupiah only (§14.1).
      if (back % 3 === 0) await add('EXPENSE', 'bills', 54_990, day(randomDay(), 21), 'App subscription');
    }
  });
  return summary;
}
