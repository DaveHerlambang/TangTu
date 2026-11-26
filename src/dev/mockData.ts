import { templateOf, type TemplateKey } from '@/constants/categories';
import { makeBackup, replaceAllData, type BackupFile, type BackupRow } from '@/db/backupRepository';
import type { Db } from '@/db/db';
import type { CategoryKind } from '@/types/models';
import { periodKey, periodLastDay, periodStart, shiftPeriodKey } from '@/utils/format';
import { DEFAULT_CURRENCY } from '@/utils/money';

/**
 * DEV ONLY (§12) — fills the signed-in account with believable history so the charts, the trend and the
 * lists can be seen with real-looking data. Load it only through the `__DEV__`-guarded dev gear, so it never
 * ships, and only against the development project (§14.15).
 *
 * The rows are built in memory as a backup and sent in ONE restore call (since 0.5.0: a request per row would
 * be thousands). It REPLACES all of the account's data, so running it twice never duplicates anything, and
 * it's deterministic: the same call on the same day gives the same data. Realistic spending per category,
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

/** Replaces the account's data with the mock history. */
export async function seedMockData(db: Db, months: 6 | 12, startDay: number, now: Date = new Date()): Promise<MockSummary> {
  const { backup, summary } = buildMockBackup(months, startDay, now);
  await replaceAllData(db, backup);
  return summary;
}

/** The mock history as a backup file (pure: the same arguments give the same rows). */
export function buildMockBackup(months: 6 | 12, startDay: number, now: Date = new Date()): { backup: BackupFile; summary: MockSummary } {
  const rand = rng(20261119 + months * 31 + startDay);
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  /** Rupiah amounts end in 500 or 000, like real prices. */
  const rp = (min: number, max: number, mult = 1) => Math.max(500, Math.round((int(min, max) * mult) / 500) * 500);
  const summary: MockSummary = { periods: months, categories: 0, transactions: 0 };
  const created = now.toISOString();
  const categories: BackupRow[] = [];
  const transactions: BackupRow[] = [];

  {
    const ids = {} as Record<TemplateKey, number>;
    const positions: Record<CategoryKind, number> = { EXPENSE: 0, INCOME: 0 };
    for (const key of [...EXPENSE_TEMPLATES, ...INCOME_TEMPLATES]) {
      const tpl = templateOf(key);
      ids[key] = categories.length + 1;
      categories.push({
        id: ids[key],
        name: null,
        template_key: key,
        kind: tpl.kind,
        icon: tpl.icon,
        tint: tpl.tint,
        position: positions[tpl.kind]++,
        archived_at: null,
        created_at: created,
      });
      summary.categories++;
    }

    const add = (kind: CategoryKind, key: TemplateKey, amount: number, at: Date, note = '') => {
      if (at.getTime() > now.getTime()) return; // nothing in the future
      const when = at.toISOString();
      transactions.push({
        id: transactions.length + 1,
        kind,
        amount,
        currency: DEFAULT_CURRENCY,
        category_id: ids[key],
        note,
        occurred_at: when,
        created_at: when,
        updated_at: when,
      });
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
      add('INCOME', 'salary', back >= 3 ? 8_000_000 : 8_500_000, day(first, 9, 0));
      if (rand() < 0.35) add('INCOME', 'side_income', rp(500_000, 1_500_000), day(first, 20));

      let index = 0;
      for (let d = first; d <= last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), index++) {
        const weekday = d.getDay(); // 0 = Sunday
        const weekend = weekday === 0 || weekday === 6;
        // Food, most days: coffee, lunch, sometimes dinner out.
        if (rand() < 0.6) spend('food', rp(18_000, 35_000), day(d, 8));
        if (rand() < 0.85) spend('food', rp(25_000, 55_000, mood), day(d, 12));
        if (rand() < (weekend ? 0.6 : 0.3)) spend('food', rp(30_000, 90_000, mood), day(d, 19));
        // Transport on workdays.
        if (!weekend && rand() < 0.75) spend('transport', rp(12_000, 35_000), day(d, 7));
        // Groceries on Saturdays.
        if (weekday === 6) spend('groceries', rp(150_000, 450_000, mood), day(d, 10));
        // Bills a few days into the period.
        if (index === 4) {
          add('EXPENSE', 'bills', rp(350_000, 550_000), day(d, 10), 'Listrik');
          add('EXPENSE', 'bills', 330_000, day(d, 10), 'Internet');
        }
        // Fun at the weekend.
        if (weekend && rand() < 0.35 * mood) spend('fun', rp(50_000, 250_000, mood), day(d, 16));
      }

      const randomDay = () => new Date(first.getFullYear(), first.getMonth(), first.getDate() + int(0, 27));
      for (let n = int(2, 4) + (big ? 2 : 0); n > 0; n--) spend('shopping', rp(80_000, 600_000, mood), day(randomDay(), 15));
      if (rand() < 0.3) spend('health', rp(60_000, 300_000), day(randomDay(), 11));
      if (big) for (let n = int(1, 2); n > 0; n--) spend('gifts', rp(150_000, 500_000), day(randomDay(), 18));
      // An app subscription now and then. Rupiah only (§14.1).
      if (back % 3 === 0) add('EXPENSE', 'bills', 54_990, day(randomDay(), 21), 'App subscription');
    }
  }
  return { backup: makeBackup({ Categories: categories, Transactions: transactions }, {}, now), summary };
}
