// Backup format, validation and restore (§11), and the mock-data dev tool (§12), against real SQLite.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  backupSummary,
  createBackup,
  readSchemaVersion,
  replaceAllData,
  validateBackup,
  type BackupFile,
} from '@/db/backupRepository';
import { archiveCategory, createCategory } from '@/db/categoriesRepository';
import { SCHEMA_VERSION } from '@/db/database';
import { DomainError } from '@/db/errors';
import { createTransaction, listTransactions } from '@/db/transactionsRepository';
import { seedMockData } from '@/dev/mockData';
import { periodRange, shiftPeriodKey, periodKey } from '@/utils/format';
import { sanitizePrefs } from '@/utils/sanitizePrefs';
import { summarize } from '@/utils/summary';

import { testDb } from './support/db';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const throwsCode = (fn: () => unknown, code: string) => assert.throws(fn, (e: unknown) => e instanceof DomainError && e.code === code);
const rejectsCode = (p: Promise<unknown>, code: string) => assert.rejects(p, (e: unknown) => e instanceof DomainError && e.code === code);

async function filledDb() {
  const db = await testDb();
  const food = await createCategory(db, { kind: 'EXPENSE', name: null, templateKey: 'food', icon: 'fast-food', tint: 'peach' });
  const kopi = await createCategory(db, { kind: 'EXPENSE', name: 'Kopi', templateKey: null, icon: 'cafe', tint: 'amber' });
  const salary = await createCategory(db, { kind: 'INCOME', name: null, templateKey: 'salary', icon: 'cash', tint: 'mint' });
  await createTransaction(db, { kind: 'EXPENSE', amount: 25_000, currency: 'IDR', categoryId: food, note: 'Nasi padang', occurredAt: at(2026, 10, 6) });
  await createTransaction(db, { kind: 'EXPENSE', amount: 450, currency: 'USD', categoryId: kopi, note: '', occurredAt: at(2026, 10, 7) });
  await createTransaction(db, { kind: 'INCOME', amount: 8_000_000, currency: 'IDR', categoryId: salary, note: '', occurredAt: at(2026, 10, 1) });
  await archiveCategory(db, kopi);
  return db;
}

const prefs = { defaultTheme: 'dark', language: 'id', periodStartDay: 25, devToolsHidden: false } as const;

/** Through JSON, as a file would be. */
const roundTrip = (b: BackupFile): unknown => JSON.parse(JSON.stringify(b));

describe('backup round trip', () => {
  test('every row comes back exactly — ids, currencies, archived categories — and totals match', async () => {
    const source = await filledDb();
    const backup = await createBackup(source, prefs, new Date(2026, 10, 19, 10));
    assert.equal(backup.app, 'TangTu');
    assert.equal(backup.schemaVersion, SCHEMA_VERSION);
    assert.deepEqual(backupSummary(backup), { exportedAt: new Date(2026, 10, 19, 10), categories: 3, transactions: 3 });

    const target = await testDb();
    const parsed = validateBackup(roundTrip(backup), await readSchemaVersion(target));
    await replaceAllData(target, parsed);

    const again = await createBackup(target, prefs, new Date(2026, 10, 19, 10));
    assert.deepEqual(again.tables, backup.tables);
    const range = periodRange('2026-10', 1);
    const [a, b] = [await listTransactions(source, range), await listTransactions(target, range)];
    assert.deepEqual(summarize(b, 'IDR', { key: '2026-10', startDay: 1 }), summarize(a, 'IDR', { key: '2026-10', startDay: 1 }));
    assert.equal(b.find((r) => r.currency === 'USD')?.amount, 450);
  });

  test('restore replaces what was there; new rows continue after the restored ids', async () => {
    const backup = await createBackup(await filledDb(), prefs);
    const target = await testDb();
    const other = await createCategory(target, { kind: 'EXPENSE', name: 'Old', templateKey: null, icon: 'car', tint: 'sky' });
    await createTransaction(target, { kind: 'EXPENSE', amount: 1, currency: 'IDR', categoryId: other, note: '', occurredAt: at(2026, 9, 1) });
    await replaceAllData(target, validateBackup(roundTrip(backup), SCHEMA_VERSION));
    const after = await createBackup(target, prefs);
    assert.deepEqual(after.tables, backup.tables);
    const id = await createCategory(target, { kind: 'EXPENSE', name: 'New', templateKey: null, icon: 'car', tint: 'sky' });
    assert.ok(id > 3);
  });

  test('preferences go through sanitizePrefs (unknown keys and bad values dropped)', () => {
    assert.deepEqual(sanitizePrefs({ ...prefs, periodStartDay: 40, defaultTheme: 'neon', lastBackupAt: 'x', extra: 1 }), {
      language: 'id',
      devToolsHidden: false,
    });
  });
});

describe('validation: backup files are untrusted', () => {
  const good = (): BackupFile => ({
    app: 'TangTu',
    format: 1,
    schemaVersion: 2,
    exportedAt: new Date(2026, 10, 1).toISOString(),
    prefs: {},
    tables: { Categories: [{ id: 1, name: 'Kopi', template_key: null, kind: 'EXPENSE', icon: 'cafe', tint: 'amber', position: 0, archived_at: null, created_at: at(2026, 1, 1) }], Transactions: [] },
  });

  test('a sound backup passes', () => {
    assert.equal(validateBackup(good(), SCHEMA_VERSION).tables.Categories?.length, 1);
  });
  test('not a TangTu backup', () => {
    for (const bad of [null, 42, 'x', [], {}, { ...good(), app: 'TracKar' }, { ...good(), tables: [] }, { ...good(), tables: null }]) {
      throwsCode(() => validateBackup(bad, SCHEMA_VERSION), 'backup.notApp');
    }
  });
  test('from a newer version of the app', () => {
    throwsCode(() => validateBackup({ ...good(), schemaVersion: SCHEMA_VERSION + 1 }, SCHEMA_VERSION), 'backup.newer');
    throwsCode(() => validateBackup({ ...good(), format: 2 }, SCHEMA_VERSION), 'backup.newer');
  });
  test('damaged', () => {
    const cases: unknown[] = [
      { ...good(), tables: { Categories: 'rows' } },
      { ...good(), tables: { Categories: [null] } },
      { ...good(), tables: { Categories: [[1, 2]] } },
      { ...good(), tables: { Categories: [{ id: 1, name: { evil: true } }] } },
      { ...good(), schemaVersion: '2' },
      { ...good(), exportedAt: 'yesterday' },
    ];
    for (const bad of cases) throwsCode(() => validateBackup(bad, SCHEMA_VERSION), 'backup.damaged');
  });
  test('a transaction breaking the money or date rules makes the file damaged (0.4.1)', () => {
    const tx = { id: 1, kind: 'EXPENSE', amount: 18_000, currency: 'IDR', category_id: 1, note: '', occurred_at: at(2026, 10, 1), created_at: at(2026, 10, 1), updated_at: at(2026, 10, 1) };
    const withTx = (row: Record<string, unknown>) => ({ ...good(), tables: { ...good().tables, Transactions: [row] } });
    assert.equal(validateBackup(withTx(tx), SCHEMA_VERSION).tables.Transactions?.length, 1);
    // A 0.1.x row in another currency is fine: only what is surely broken is refused.
    assert.equal(validateBackup(withTx({ ...tx, amount: 450, currency: 'USD' }), SCHEMA_VERSION).tables.Transactions?.length, 1);
    for (const bad of [{ amount: 12.5 }, { amount: 0 }, { amount: -500 }, { amount: '18000' }, { amount: null }, { occurred_at: 'garbage' }, { occurred_at: '2026-11-01' }, { occurred_at: '2026-13-45T10:00:00.000Z' }, { occurred_at: null }]) {
      throwsCode(() => validateBackup(withTx({ ...tx, ...bad }), SCHEMA_VERSION), 'backup.damaged');
    }
  });
  test('every backup the app writes passes the new checks (a year of mock data too)', async () => {
    const mock = await testDb();
    await seedMockData(mock, 12, 25, new Date(2026, 10, 20));
    for (const db of [await filledDb(), mock]) {
      const written = JSON.parse(JSON.stringify(await createBackup(db, prefs)));
      assert.ok(validateBackup(written, SCHEMA_VERSION).tables.Transactions!.length > 0);
    }
  });
  test('empty: restoring it would erase everything', () => {
    throwsCode(() => validateBackup({ ...good(), tables: {} }, SCHEMA_VERSION), 'backup.empty');
    throwsCode(() => validateBackup({ ...good(), tables: { Categories: [], Transactions: [] } }, SCHEMA_VERSION), 'backup.empty');
  });
  test('missing prefs read as none', () => {
    const { prefs: _p, ...rest } = good();
    assert.deepEqual(validateBackup(rest, SCHEMA_VERSION).prefs, {});
  });
});

describe('restore is atomic: a bad row changes nothing', () => {
  const restoreAndCheckUntouched = async (mutate: (b: BackupFile) => void) => {
    const db = await filledDb();
    const before = await createBackup(db, prefs);
    const backup = roundTrip(before) as BackupFile;
    mutate(backup);
    await rejectsCode(replaceAllData(db, validateBackup(backup, SCHEMA_VERSION)), 'backup.damaged');
    assert.deepEqual((await createBackup(db, prefs)).tables, before.tables);
  };

  test('a transaction pointing at a missing category', () =>
    restoreAndCheckUntouched((b) => {
      b.tables.Transactions![0].category_id = 999;
    }));
  test('a negative amount: refused by validation (0.4.1), and the CHECK still guards the table', async () => {
    const db = await filledDb();
    const before = await createBackup(db, prefs);
    const backup = roundTrip(before) as BackupFile;
    backup.tables.Transactions![0].amount = -5;
    throwsCode(() => validateBackup(backup, SCHEMA_VERSION), 'backup.damaged');
    // Second line: even past validation, the database refuses it and nothing changes.
    await rejectsCode(replaceAllData(db, backup), 'backup.damaged');
    assert.deepEqual((await createBackup(db, prefs)).tables, before.tables);
  });
  test('an expense in an income category', () =>
    restoreAndCheckUntouched((b) => {
      const income = b.tables.Categories!.find((c) => c.kind === 'INCOME')!;
      b.tables.Transactions!.find((t) => t.kind === 'EXPENSE')!.category_id = income.id;
    }));
  test('a row with no column this schema knows', () =>
    restoreAndCheckUntouched((b) => {
      b.tables.Categories!.push({ colour: 'red' });
    }));
});

test('columns map by name: unknown columns are ignored; an older backup without Transactions restores', async () => {
  const db = await testDb();
  const old: unknown = {
    app: 'TangTu',
    format: 1,
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    prefs: {},
    tables: { Categories: [{ id: 7, name: 'Kopi', template_key: null, kind: 'EXPENSE', icon: 'cafe', tint: 'amber', position: 0, archived_at: null, created_at: at(2026, 1, 1), sparkle: 'yes' }] },
  };
  await replaceAllData(db, validateBackup(old, SCHEMA_VERSION));
  const back = await createBackup(db, {});
  assert.equal(back.tables.Categories?.[0].id, 7);
  assert.equal(back.tables.Categories?.[0].sparkle, undefined);
  assert.deepEqual(back.tables.Transactions, []);
});

describe('mock data (dev tool)', () => {
  const now = new Date(2026, 10, 19, 15, 30);

  test('deterministic, replaces everything, nothing in the future, kinds match', async () => {
    const db = await filledDb();
    const first = await seedMockData(db, 6, 1, now);
    const a = await createBackup(db, {});
    const second = await seedMockData(db, 6, 1, now);
    const b = await createBackup(db, {});
    assert.deepEqual(first, second);
    // created_at / updated_at are the real clock; everything else must be identical.
    const strip = (rows: BackupFile['tables']['Transactions']) => rows!.map(({ created_at: _c, updated_at: _u, ...r }) => r);
    assert.deepEqual(strip(a.tables.Transactions), strip(b.tables.Transactions));
    assert.equal(first.categories, 10);
    assert.equal(a.tables.Categories?.length, 10);
    assert.ok(first.transactions > 300, `only ${first.transactions} transactions`);
    assert.ok(a.tables.Transactions!.every((t) => String(t.occurred_at) <= now.toISOString()));
    // The backup made from mock data is itself valid (it would pass restore).
    validateBackup(roundTrip(a), SCHEMA_VERSION);
  });

  test('salary on the start day of each period; big and quiet months differ', async () => {
    const db = await testDb();
    await seedMockData(db, 12, 25, now);
    const current = periodKey(now, 25);
    const spent: number[] = [];
    for (let back = 11; back >= 0; back--) {
      const key = shiftPeriodKey(current, -back);
      const rows = await listTransactions(db, periodRange(key, 25));
      const salary = rows.filter((r) => r.kind === 'INCOME' && r.category.template_key === 'salary');
      assert.equal(salary.length, 1, key);
      assert.equal(new Date(salary[0].occurred_at).getDate(), 25, key);
      spent.push(summarize(rows, 'IDR', { key, startDay: 25 }).spent);
      assert.ok(rows.every((r) => r.currency === 'IDR'), `rupiah only: ${key}`);
    }
    const past = spent.slice(0, -1); // the current period is partial
    assert.ok(Math.max(...past) > Math.min(...past) * 1.5, `too flat: ${past.join(', ')}`);
  });
});
