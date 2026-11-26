// Backup format and validation (§11), and the mock-data dev tool (§12). Since 0.5.0 the restore itself is the
// database function `replace_all_data`, tested on PGlite (schema.test.ts): all or nothing, new ids, columns by
// name, another account untouched.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { BACKUP_SCHEMA_VERSION, backupSummary, makeBackup, validateBackup, type BackupFile, type BackupRow } from '@/db/backupRepository';
import { toCategory } from '@/db/categoriesRepository';
import { DomainError } from '@/db/errors';
import { toTransaction } from '@/db/transactionsRepository';
import { buildMockBackup } from '@/dev/mockData';
import type { TransactionWithCategory } from '@/types/models';
import { periodKey, periodRange, shiftPeriodKey } from '@/utils/format';
import { sanitizePrefs } from '@/utils/sanitizePrefs';
import { summarize } from '@/utils/summary';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const throwsCode = (fn: () => unknown, code: string) => assert.throws(fn, (e: unknown) => e instanceof DomainError && e.code === code);

const prefs = { defaultTheme: 'dark', language: 'id', periodStartDay: 25, devToolsHidden: false } as const;

/** Through JSON, as a file would be. */
const roundTrip = (b: BackupFile): unknown => JSON.parse(JSON.stringify(b));

/** A backup's rows as the app reads them (to total them like the screens do). */
function rowsOf(backup: BackupFile): TransactionWithCategory[] {
  const categories = new Map(
    (backup.tables.Categories ?? []).map((c) => [String(c.id), toCategory(c as unknown as Parameters<typeof toCategory>[0])]),
  );
  return (backup.tables.Transactions ?? []).map((t) => {
    const row = toTransaction(t as unknown as Parameters<typeof toTransaction>[0]);
    return { ...row, category: categories.get(String(row.category_id))! };
  });
}

describe('the file', () => {
  test('the same format 1 as the offline version, with the preferences and a summary', () => {
    const tables = {
      Categories: [{ id: 1, name: 'Kopi', template_key: null, kind: 'EXPENSE', icon: 'cafe', tint: 'amber', position: 0, archived_at: null, created_at: at(2026, 1, 1) }],
      Transactions: [] as BackupRow[],
    };
    const backup = makeBackup(tables, prefs, new Date(2026, 10, 19, 10));
    assert.equal(backup.app, 'TangTu');
    assert.equal(backup.format, 1);
    assert.equal(backup.schemaVersion, BACKUP_SCHEMA_VERSION);
    assert.equal(BACKUP_SCHEMA_VERSION, 4, 'UUID ids since 0.5.0: the offline version refuses such a file as newer');
    assert.deepEqual(backupSummary(backup), { exportedAt: new Date(2026, 10, 19, 10), categories: 1, transactions: 0 });
    assert.ok(!('Activity' in backup.tables), 'the bell is never backed up');
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

  test('a sound backup passes: one written by the offline version (whole-number ids) or by 0.5.0 (UUIDs)', () => {
    assert.equal(validateBackup(good()).tables.Categories?.length, 1);
    assert.equal(validateBackup({ ...good(), schemaVersion: 3 }).tables.Categories?.length, 1);
    const online = { ...good(), schemaVersion: 4 };
    online.tables = { Categories: [{ ...good().tables.Categories![0], id: '6f1c2a4e-8b0d-4c3e-9a51-2d7f0e9b4c11' }] };
    assert.equal(validateBackup(online).tables.Categories?.length, 1);
  });
  test('not a TangTu backup', () => {
    for (const bad of [null, 42, 'x', [], {}, { ...good(), app: 'TracKar' }, { ...good(), tables: [] }, { ...good(), tables: null }]) {
      throwsCode(() => validateBackup(bad), 'backup.notApp');
    }
  });
  test('from a newer version of the app', () => {
    throwsCode(() => validateBackup({ ...good(), schemaVersion: BACKUP_SCHEMA_VERSION + 1 }), 'backup.newer');
    throwsCode(() => validateBackup({ ...good(), format: 2 }), 'backup.newer');
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
    for (const bad of cases) throwsCode(() => validateBackup(bad), 'backup.damaged');
  });
  test('a transaction breaking the money or date rules makes the file damaged (0.4.1)', () => {
    const tx = { id: 1, kind: 'EXPENSE', amount: 18_000, currency: 'IDR', category_id: 1, note: '', occurred_at: at(2026, 10, 1), created_at: at(2026, 10, 1), updated_at: at(2026, 10, 1) };
    const withTx = (row: Record<string, unknown>) => ({ ...good(), tables: { ...good().tables, Transactions: [row] } });
    assert.equal(validateBackup(withTx(tx)).tables.Transactions?.length, 1);
    // A 0.1.x row in another currency is fine: only what is surely broken is refused.
    assert.equal(validateBackup(withTx({ ...tx, amount: 450, currency: 'USD' })).tables.Transactions?.length, 1);
    for (const bad of [{ amount: 12.5 }, { amount: 0 }, { amount: -500 }, { amount: '18000' }, { amount: null }, { occurred_at: 'garbage' }, { occurred_at: '2026-11-01' }, { occurred_at: '2026-13-45T10:00:00.000Z' }, { occurred_at: null }]) {
      throwsCode(() => validateBackup(withTx({ ...tx, ...bad })), 'backup.damaged');
    }
  });
  test('empty: restoring it would erase everything', () => {
    throwsCode(() => validateBackup({ ...good(), tables: {} }), 'backup.empty');
    throwsCode(() => validateBackup({ ...good(), tables: { Categories: [], Transactions: [] } }), 'backup.empty');
  });
  test('missing prefs read as none', () => {
    const { prefs: _p, ...rest } = good();
    assert.deepEqual(validateBackup(rest).prefs, {});
  });
});

describe('mock data (dev tool)', () => {
  const now = new Date(2026, 10, 19, 15, 30);

  test('deterministic, nothing in the future, kinds match, and the file passes validation', () => {
    const first = buildMockBackup(6, 1, now);
    const second = buildMockBackup(6, 1, now);
    assert.deepEqual(first, second);
    assert.equal(first.summary.categories, 10);
    assert.equal(first.backup.tables.Categories?.length, 10);
    assert.ok(first.summary.transactions > 300, `only ${first.summary.transactions} transactions`);
    const rows = rowsOf(first.backup);
    assert.ok(rows.every((t) => t.occurred_at <= now.toISOString()));
    assert.ok(rows.every((t) => t.kind === t.category.kind), 'every transaction is in a category of its kind');
    // A year of mock data is a backup the app would accept (every backup the app writes must pass).
    assert.ok(validateBackup(roundTrip(buildMockBackup(12, 25, now).backup)).tables.Transactions!.length > 0);
  });

  test('salary on the start day of each period; big and quiet months differ', () => {
    const rows = rowsOf(buildMockBackup(12, 25, now).backup);
    const current = periodKey(now, 25);
    const spent: number[] = [];
    for (let back = 11; back >= 0; back--) {
      const key = shiftPeriodKey(current, -back);
      const { start, end } = periodRange(key, 25);
      const inPeriod = rows.filter((r) => r.occurred_at >= start && r.occurred_at < end);
      const salary = inPeriod.filter((r) => r.kind === 'INCOME' && r.category.template_key === 'salary');
      assert.equal(salary.length, 1, key);
      assert.equal(new Date(salary[0].occurred_at).getDate(), 25, key);
      spent.push(summarize(inPeriod, 'IDR', { key, startDay: 25 }).spent);
      assert.ok(inPeriod.every((r) => r.currency === 'IDR'), `rupiah only: ${key}`);
    }
    const past = spent.slice(0, -1); // the current period is partial
    assert.ok(Math.max(...past) > Math.min(...past) * 1.5, `too flat: ${past.join(', ')}`);
  });
});
