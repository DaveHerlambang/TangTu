// The online schema (docs/SPEC.md §3, §11), run for real: the migrations on PGlite (Postgres in WebAssembly),
// with the parts of Supabase they lean on stubbed — `auth.users`, `auth.uid()` (from the request's JWT `sub`,
// as Supabase does) and the `anon` / `authenticated` roles. No Docker, no network (§14.14).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { PGlite, type Transaction } from '@electric-sql/pglite';

const MIGRATIONS = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));

const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create role anon nologin;
  create role authenticated nologin;
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`;

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
let pg: PGlite;

/** Runs `fn` as the signed-in account `uid` (role `authenticated`), in a transaction. */
async function as<T>(uid: string | null, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return pg.transaction(async (tx) => {
    await tx.query(uid ? 'set local role authenticated' : 'set local role anon');
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
    return fn(tx);
  });
}

const rows = async <T>(tx: Transaction, sql: string, params: unknown[] = []) => (await tx.query<T>(sql, params)).rows;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function addCategory(uid: string, kind = 'EXPENSE', name = 'Kopi'): Promise<string> {
  return as(uid, async (tx) => {
    const [r] = await rows<{ id: string }>(
      tx,
      `insert into public.categories (name, kind, icon, tint) values ($1, $2, 'cafe', 'peach') returning id`,
      [name, kind],
    );
    return r.id;
  });
}

async function addTransaction(uid: string, categoryId: string, amount = 25000, kind = 'EXPENSE'): Promise<string> {
  return as(uid, async (tx) => {
    const [r] = await rows<{ id: string }>(
      tx,
      `insert into public.transactions (kind, amount, category_id, occurred_at) values ($1, $2, $3, '2026-11-20T03:00:00Z') returning id`,
      [kind, amount, categoryId],
    );
    return r.id;
  });
}

const fails = async (p: Promise<unknown>, pattern: RegExp) => assert.rejects(p, (e: Error) => pattern.test(e.message));

before(async () => {
  pg = new PGlite();
  await pg.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await pg.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  }
  await pg.query('insert into auth.users (id) values ($1), ($2)', [A, B]);
});

after(async () => {
  await pg.close();
});

test('an account sees and changes only its own rows', async () => {
  const cat = await addCategory(A, 'EXPENSE', 'Only A');
  const tx = await addTransaction(A, cat);
  await as(B, async (t) => {
    assert.equal((await rows(t, 'select * from public.categories where id = $1', [cat])).length, 0);
    assert.equal((await rows(t, 'select * from public.transactions where id = $1', [tx])).length, 0);
    assert.equal((await t.query('update public.transactions set amount = 1 where id = $1', [tx])).affectedRows, 0);
    assert.equal((await t.query('delete from public.categories where id = $1', [cat])).affectedRows, 0);
  });
  await as(A, async (t) => {
    const [r] = await rows<{ amount: number; user_id: string }>(t, 'select amount, user_id from public.transactions where id = $1', [tx]);
    assert.equal(Number(r.amount), 25000);
    assert.equal(r.user_id, A, 'user_id is filled by auth.uid()');
  });
});

test('nobody signed in reads nothing', async () => {
  await fails(
    as(null, (t) => rows(t, 'select * from public.categories')),
    /permission denied/,
  );
});

test('a row cannot be written under another account', async () => {
  await fails(
    as(A, (t) => t.query(`insert into public.categories (user_id, name, kind, icon, tint) values ($1, 'Sneaky', 'EXPENSE', 'cafe', 'peach')`, [B])),
    /row-level security/,
  );
});

test("a transaction can't use another account's category, or one of the other kind", async () => {
  const aCat = await addCategory(A, 'EXPENSE', 'A food');
  await fails(addTransaction(B, aCat), /foreign key/);
  const income = await addCategory(A, 'INCOME', 'A salary');
  await fails(addTransaction(A, income, 1000, 'EXPENSE'), /foreign key/);
});

test('the schema refuses what the app never writes', async () => {
  const cat = await addCategory(A, 'EXPENSE', 'Checks');
  await fails(addTransaction(A, cat, 0), /check constraint/);
  await fails(addTransaction(A, cat, -5), /check constraint/);
  await fails(
    as(A, (t) => t.query(`insert into public.categories (name, kind, icon, tint) values ('  ', 'EXPENSE', 'cafe', 'peach')`)),
    /check constraint/,
  );
  // Active typed names are unique per account and kind (case and spaces ignored); another account may use it.
  await fails(addCategory(A, 'EXPENSE', ' checks '), /duplicate key/);
  await addCategory(B, 'EXPENSE', 'Checks');
});

test('a used category cannot be deleted', async () => {
  const cat = await addCategory(A, 'EXPENSE', 'In use');
  await addTransaction(A, cat);
  await fails(
    as(A, (t) => t.query('delete from public.categories where id = $1', [cat])),
    /foreign key/,
  );
});

test("the bell's dedupe key is unique per account", async () => {
  await as(A, (t) => t.query(`insert into public.activity (kind, dedupe_key) values ('recap', 'recap:1:2026-10')`));
  await fails(
    as(A, (t) => t.query(`insert into public.activity (kind, dedupe_key) values ('recap', 'recap:1:2026-10')`)),
    /duplicate key/,
  );
  await as(B, (t) => t.query(`insert into public.activity (kind, dedupe_key) values ('recap', 'recap:1:2026-10')`));
});

const BACKUP_CATEGORIES = [
  {
    id: 1,
    name: null,
    template_key: 'food',
    kind: 'EXPENSE',
    icon: 'fast-food',
    tint: 'peach',
    position: 0,
    archived_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Gaji',
    template_key: null,
    kind: 'INCOME',
    icon: 'cash',
    tint: 'mint',
    position: 0,
    archived_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 7,
    name: 'Old',
    template_key: null,
    kind: 'EXPENSE',
    icon: 'cafe',
    tint: 'slate',
    position: 1,
    archived_at: '2026-03-01T00:00:00.000Z',
    created_at: '2026-01-02T00:00:00.000Z',
  },
];
const BACKUP_TRANSACTIONS = [
  {
    id: 1,
    kind: 'EXPENSE',
    amount: 25000,
    currency: 'IDR',
    category_id: 1,
    note: 'Kopi',
    occurred_at: '2026-11-01T02:00:00.000Z',
    created_at: '2026-11-01T02:00:00.000Z',
    updated_at: '2026-11-01T02:00:00.000Z',
  },
  {
    id: 2,
    kind: 'INCOME',
    amount: 8500000,
    currency: 'IDR',
    category_id: 2,
    note: '',
    occurred_at: '2026-11-25T02:00:00.000Z',
    created_at: '2026-11-25T02:00:00.000Z',
    updated_at: '2026-11-25T02:00:00.000Z',
  },
  {
    id: 3,
    kind: 'EXPENSE',
    amount: 1250,
    currency: 'USD',
    category_id: 7,
    note: 'From 0.1.x',
    occurred_at: '2026-02-01T02:00:00.000Z',
    created_at: '2026-02-01T02:00:00.000Z',
    updated_at: '2026-02-01T02:00:00.000Z',
  },
];

test("restore replaces only this account's data, with new ids and every reference kept", async () => {
  const bCat = await addCategory(B, 'EXPENSE', 'B keeps this');
  const bTx = await addTransaction(B, bCat, 777);
  await addCategory(A, 'EXPENSE', 'Replaced');
  await as(A, (t) =>
    t.query(`select public.replace_all_data($1::jsonb, $2::jsonb)`, [JSON.stringify(BACKUP_CATEGORIES), JSON.stringify(BACKUP_TRANSACTIONS)]),
  );

  await as(A, async (t) => {
    const cats = await rows<{ id: string; name: string | null; template_key: string | null; archived_at: Date | null }>(
      t,
      'select * from public.categories order by position, id',
    );
    assert.equal(cats.length, 3);
    assert.ok(!cats.some((c) => c.name === 'Replaced'), 'the old rows are gone');
    const txs = await rows<{ amount: number; currency: string; note: string; category_id: string; kind: string }>(
      t,
      `select t.amount, t.currency, t.note, t.category_id, t.kind, c.name, c.template_key
         from public.transactions t join public.categories c on c.id = t.category_id order by t.occurred_at`,
    );
    assert.deepEqual(
      txs.map((x) => [
        Number(x.amount),
        x.currency,
        x.note,
        x.kind,
        (x as unknown as { name: string | null }).name ?? (x as unknown as { template_key: string }).template_key,
      ]),
      [
        [1250, 'USD', 'From 0.1.x', 'EXPENSE', 'Old'],
        [25000, 'IDR', 'Kopi', 'EXPENSE', 'food'],
        [8500000, 'IDR', '', 'INCOME', 'Gaji'],
      ],
    );
    assert.equal((await rows(t, 'select * from public.activity')).length, 0, 'the bell is cleared');
  });
  await as(B, async (t) => {
    const [r] = await rows<{ amount: number }>(t, 'select amount from public.transactions where id = $1', [bTx]);
    assert.equal(Number(r.amount), 777, "another account's rows are untouched");
  });
});

test('ids are random UUIDs; Undo puts a row back with its own id; a 0.5.0 backup restores into another account with new ids', async () => {
  const U = '00000000-0000-4000-8000-000000000011';
  const V = '00000000-0000-4000-8000-000000000012';
  await pg.query('insert into auth.users (id) values ($1), ($2)', [U, V]);
  const cat = await addCategory(U, 'EXPENSE', 'Mine');
  const tx = await addTransaction(U, cat, 1111);
  assert.match(cat, UUID);
  assert.match(tx, UUID);
  assert.notEqual(cat, await addCategory(U, 'EXPENSE', 'Mine too'));

  // Undo after a delete: the same row, same id (putTransaction's upsert).
  await as(U, async (t) => {
    const [row] = await rows<Record<string, unknown>>(t, 'select * from public.transactions where id = $1', [tx]);
    await t.query('delete from public.transactions where id = $1', [tx]);
    await t.query(
      `insert into public.transactions (id, kind, amount, currency, category_id, note, occurred_at, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (id) do update set amount = excluded.amount`,
      [row.id, row.kind, row.amount, row.currency, row.category_id, row.note, row.occurred_at, row.created_at, row.updated_at],
    );
    assert.equal((await rows(t, 'select * from public.transactions where id = $1', [tx])).length, 1);
  });

  // U's backup as 0.5.0 writes it (UUID ids) into V while U still has those rows: new ids, references kept.
  const backup = await as(U, async (t) => ({
    categories: await rows<Record<string, unknown>>(t, 'select id, name, template_key, kind, icon, tint, position, archived_at, created_at from public.categories'),
    transactions: await rows<Record<string, unknown>>(t, 'select id, kind, amount, currency, category_id, note, occurred_at, created_at, updated_at from public.transactions'),
  }));
  await as(V, (t) => t.query(`select public.replace_all_data($1::jsonb, $2::jsonb)`, [JSON.stringify(backup.categories), JSON.stringify(backup.transactions)]));
  await as(V, async (t) => {
    const [r] = await rows<{ id: string; category_id: string; name: string }>(
      t,
      'select t.id, t.category_id, c.name from public.transactions t join public.categories c on c.id = t.category_id',
    );
    assert.equal(r.name, 'Mine');
    assert.notEqual(r.id, tx, 'a new id');
    assert.notEqual(r.category_id, cat);
  });
  await as(U, async (t) => assert.equal((await rows(t, 'select * from public.transactions')).length, 1, "the backup's owner keeps its rows"));
});

test('restore is all or nothing', async () => {
  const keep = await addCategory(A, 'EXPENSE', 'Survives');
  await addTransaction(A, keep, 4242);
  const broken = [...BACKUP_TRANSACTIONS, { ...BACKUP_TRANSACTIONS[0], id: 9, category_id: 99 }];
  await fails(
    as(A, (t) => t.query(`select public.replace_all_data($1::jsonb, $2::jsonb)`, [JSON.stringify(BACKUP_CATEGORIES), JSON.stringify(broken)])),
    /null value|violates/,
  );
  await as(A, async (t) => {
    const amounts = (await rows<{ amount: number }>(t, 'select amount from public.transactions')).map((r) => Number(r.amount));
    assert.ok(amounts.includes(4242), 'nothing changed');
  });
});

test('restore refuses a bad row and changes nothing: wrong kind, negative amount, a row with no known column', async () => {
  const U = '00000000-0000-4000-8000-0000000000dd';
  await pg.query('insert into auth.users (id) values ($1)', [U]);
  const keep = await addCategory(U, 'EXPENSE', 'Kept');
  await addTransaction(U, keep, 5151);
  const expenseInIncome = BACKUP_TRANSACTIONS.map((t) => (t.kind === 'EXPENSE' && t.id === 1 ? { ...t, category_id: 2 } : t));
  const negative = BACKUP_TRANSACTIONS.map((t) => (t.id === 1 ? { ...t, amount: -5 } : t));
  const noColumns = [...BACKUP_CATEGORIES, { colour: 'red' }];
  for (const [cats, txs] of [
    [BACKUP_CATEGORIES, expenseInIncome],
    [BACKUP_CATEGORIES, negative],
    [noColumns, BACKUP_TRANSACTIONS],
  ] as const) {
    await fails(
      as(U, (t) => t.query(`select public.replace_all_data($1::jsonb, $2::jsonb)`, [JSON.stringify(cats), JSON.stringify(txs)])),
      /violates|null value/,
    );
  }
  await as(U, async (t) => {
    const amounts = (await rows<{ amount: number }>(t, 'select amount from public.transactions')).map((r) => Number(r.amount));
    assert.deepEqual(amounts, [5151]);
  });
});

test('restore maps columns by name: unknown ones are ignored; a backup without transactions restores', async () => {
  const U = '00000000-0000-4000-8000-0000000000ee';
  await pg.query('insert into auth.users (id) values ($1)', [U]);
  const cats = [{ ...BACKUP_CATEGORIES[1], sparkle: 'yes' }];
  await as(U, (t) => t.query(`select public.replace_all_data($1::jsonb, null)`, [JSON.stringify(cats)]));
  await as(U, async (t) => {
    const back = await rows<{ name: string; kind: string }>(t, 'select name, kind from public.categories');
    assert.deepEqual(back, [{ name: 'Gaji', kind: 'INCOME' }]);
    assert.equal((await rows(t, 'select * from public.transactions')).length, 0);
  });
});

test('search keeps to its range, matches any case, takes "_" literally', async () => {
  const U = '00000000-0000-4000-8000-0000000000ff';
  await pg.query('insert into auth.users (id) values ($1)', [U]);
  const cat = await addCategory(U, 'EXPENSE', 'Food');
  await as(U, async (t) => {
    await t.query(
      `insert into public.transactions (kind, amount, category_id, note, occurred_at) values
         ('EXPENSE', 1, $1, 'Nasi Padang', '2026-10-31T16:59:00Z'),
         ('EXPENSE', 2, $1, 'nasi padang', '2026-10-31T17:00:00Z')`,
      [cat],
    );
    const find = async (text: string, start: string | null, end: string | null) =>
      (await rows<{ amount: number }>(t, `select amount from public.search_transactions($1, '{}', '{}', $2, $3, 200)`, [text, start, end])).map((r) =>
        Number(r.amount),
      );
    assert.deepEqual(await find('PADANG', null, null), [2, 1], 'newest first, any case');
    assert.deepEqual(await find('', '2026-10-31T17:00:00Z', '2026-11-30T17:00:00Z'), [2], 'start in, end out');
    assert.deepEqual(await find('', '2026-09-30T17:00:00Z', '2026-10-31T17:00:00Z'), [1]);
    assert.deepEqual(await find('_', null, null), [], '"_" is not a wildcard');
  });
});

test('restore needs a signed-in account', async () => {
  await fails(
    as(null, (t) => t.query(`select public.replace_all_data('[]'::jsonb, '[]'::jsonb)`)),
    /permission denied/,
  );
});

test('the grid orders categories by use, and search finds notes and category names', async () => {
  const U = '00000000-0000-4000-8000-0000000000cc';
  await pg.query('insert into auth.users (id) values ($1)', [U]);
  const rare = await addCategory(U, 'EXPENSE', 'Rare');
  const often = await addCategory(U, 'EXPENSE', 'Often');
  await addTransaction(U, often, 1000);
  await addTransaction(U, often, 2000);
  await addTransaction(U, rare, 3000);
  await as(U, async (t) => {
    await t.query(`update public.transactions set note = 'Kopi 50% diskon' where amount = 1000`);
    const grid = await rows<{ name: string }>(t, `select name from public.categories_by_use('EXPENSE', '2026-01-01', '2026-12-31')`);
    assert.deepEqual(
      grid.map((c) => c.name),
      ['Often', 'Rare'],
    );
    const byNote = await rows<{ amount: number }>(t, `select amount from public.search_transactions('50%', '{}', '{}', null, null, 200)`);
    assert.deepEqual(
      byNote.map((r) => Number(r.amount)),
      [1000],
      '"%" is taken literally',
    );
    const byName = await rows<{ amount: number }>(t, `select amount from public.search_transactions('rare', $1, '{}', null, null, 200)`, [[rare]]);
    assert.deepEqual(
      byName.map((r) => Number(r.amount)),
      [3000],
    );
    const filtered = await rows<{ amount: number }>(
      t,
      `select amount from public.search_transactions('', '{}', $1, null, null, 200) order by amount`,
      [[often]],
    );
    assert.deepEqual(
      filtered.map((r) => Number(r.amount)),
      [1000, 2000],
    );
    await t.query(`insert into public.categories (name, kind, icon, tint) values ('Unused', 'EXPENSE', 'cafe', 'peach')`);
    const used = await rows<{ name: string }>(t, 'select name from public.used_categories()');
    assert.deepEqual(used.map((c) => c.name).sort(), ['Often', 'Rare'], 'only categories with transactions');
  });
});
