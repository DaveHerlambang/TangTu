// Categories (§3, §7) against real SQLite: templates, names in both languages, archive, delete + undo, order.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ALL_CATEGORY_ICONS, CATEGORY_TEMPLATES, ICON_GROUPS } from '@/constants/categories';
import {
  archiveCategory,
  createCategory,
  deleteCategory,
  getCategory,
  listArchivedCategories,
  listCategories,
  nextTint,
  putCategory,
  reorderCategories,
  restoreCategory,
  updateCategory,
  type CategoryInput,
} from '@/db/categoriesRepository';
import { SCHEMA_VERSION, resetDatabase } from '@/db/database';
import { DomainError } from '@/db/errors';
import { en } from '@/i18n/en';
import { TINT_ORDER } from '@/theme/themes';
import { categoryName, storedName } from '@/utils/categoryNames';

import { rawTestDb, testDb } from './support/db';

const food: CategoryInput = { kind: 'EXPENSE', name: null, templateKey: 'food', icon: 'fast-food', tint: 'peach' };
const blank = (name: string, kind: CategoryInput['kind'] = 'EXPENSE'): CategoryInput => ({
  kind,
  name,
  templateKey: null,
  icon: 'cafe',
  tint: 'amber',
});

const rejectsWith = async (p: Promise<unknown>, code: string) =>
  assert.rejects(p, (e: unknown) => e instanceof DomainError && e.code === code);

describe('catalog', () => {
  test('every icon exists as an Ionicons outline glyph', () => {
    const glyphs = JSON.parse(
      readFileSync(
        fileURLToPath(new URL('../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json', import.meta.url)),
        'utf8',
      ),
    ) as Record<string, number>;
    const missing = ALL_CATEGORY_ICONS.filter((i) => !(`${i}-outline` in glyphs));
    assert.deepEqual(missing, []);
  });
  test('no icon is listed twice', () => assert.equal(new Set(ALL_CATEGORY_ICONS).size, ALL_CATEGORY_ICONS.length));
  test('every icon, group, tint and template has a label', () => {
    for (const icon of ALL_CATEGORY_ICONS) assert.ok(`icon.${icon}` in en, icon);
    for (const g of ICON_GROUPS) assert.ok(`icons.group.${g.key}` in en, g.key);
    for (const tint of TINT_ORDER) assert.ok(`tint.${tint}` in en, tint);
    for (const t of CATEGORY_TEMPLATES) assert.ok(`template.${t.key}` in en, t.key);
  });
  test('templates use catalog icons and are §7.3', () => {
    for (const t of CATEGORY_TEMPLATES) assert.ok(ALL_CATEGORY_ICONS.includes(t.icon), t.key);
    assert.deepEqual(
      CATEGORY_TEMPLATES.map((t) => t.key),
      ['food', 'groceries', 'transport', 'bills', 'shopping', 'health', 'fun', 'gifts', 'other_expense', 'salary', 'side_income', 'gift_income', 'other_income'],
    );
  });
});

describe('schema', () => {
  test('migrates an empty database to the current version, and again is a no-op', async () => {
    const { db, raw } = rawTestDb();
    const { initializeDatabase } = await import('@/db/database');
    await initializeDatabase(db);
    await initializeDatabase(db);
    assert.equal((raw.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, SCHEMA_VERSION);
  });
  test('the app starts with no categories (templates are not seeded)', async () => {
    const db = await testDb();
    assert.deepEqual(await listCategories(db, 'EXPENSE'), []);
    assert.deepEqual(await listCategories(db, 'INCOME'), []);
  });
  test('resetDatabase leaves a fresh, empty schema', async () => {
    const db = await testDb();
    await createCategory(db, food);
    await resetDatabase(db);
    assert.deepEqual(await listCategories(db, 'EXPENSE'), []);
  });
});

describe('names', () => {
  test('an untouched template category follows the language', async () => {
    const db = await testDb();
    const id = await createCategory(db, food);
    const c = (await getCategory(db, id))!;
    assert.equal(c.name, null);
    assert.equal(categoryName(c, 'en'), 'Food & Drinks');
    assert.equal(categoryName(c, 'id'), 'Makan & Minum');
  });
  test('a renamed one is shown as typed in both languages', async () => {
    const db = await testDb();
    const id = await createCategory(db, food);
    await updateCategory(db, id, { name: '  Jajan   kopi ', icon: 'cafe', tint: 'amber' });
    const c = (await getCategory(db, id))!;
    assert.equal(categoryName(c, 'en'), 'Jajan kopi');
    assert.equal(categoryName(c, 'id'), 'Jajan kopi');
    assert.equal(c.icon, 'cafe');
    assert.equal(c.tint, 'amber');
  });
  test("typing the template's own name (either language) keeps it following the language", () => {
    assert.equal(storedName('Food & Drinks', 'food'), null);
    assert.equal(storedName(' makan & minum ', 'food'), null);
    assert.equal(storedName('', 'food'), null);
    assert.equal(storedName('Makan siang', 'food'), 'Makan siang');
    assert.equal(storedName('  ', null), null);
  });
  test('a blank category needs a name', async () => {
    const db = await testDb();
    await rejectsWith(createCategory(db, blank('   ')), 'category.nameEmpty');
  });
  test('active names are unique per kind, case-insensitively and across languages', async () => {
    const db = await testDb();
    await createCategory(db, food);
    await rejectsWith(createCategory(db, food), 'category.nameTaken');
    await rejectsWith(createCategory(db, blank('makan & MINUM')), 'category.nameTaken');
    await rejectsWith(createCategory(db, blank('food & drinks')), 'category.nameTaken');
    const coffee = await createCategory(db, blank('Coffee'));
    await rejectsWith(createCategory(db, blank(' coffee ')), 'category.nameTaken');
    await rejectsWith(updateCategory(db, coffee, { name: 'Makan & Minum', icon: 'cafe', tint: 'amber' }), 'category.nameTaken');
    // Same name in the other kind is fine ("Gift" expense vs income templates, or typed).
    await createCategory(db, blank('Coffee', 'INCOME'));
  });
  test('an archived category frees its name; restoring is refused while it is taken', async () => {
    const db = await testDb();
    const old = await createCategory(db, blank('Snacks'));
    await archiveCategory(db, old);
    const fresh = await createCategory(db, blank('snacks'));
    await rejectsWith(restoreCategory(db, old), 'category.nameTaken');
    await archiveCategory(db, fresh);
    await restoreCategory(db, old);
    assert.equal((await getCategory(db, old))!.archived_at, null);
  });
});

describe('archive, delete, undo, order', () => {
  test('archive hides from the active list and keeps the row; restore puts it at the end', async () => {
    const db = await testDb();
    const a = await createCategory(db, food);
    const b = await createCategory(db, blank('Coffee'));
    await archiveCategory(db, a);
    assert.deepEqual((await listCategories(db, 'EXPENSE')).map((c) => c.id), [b]);
    assert.deepEqual((await listArchivedCategories(db, 'EXPENSE')).map((c) => c.id), [a]);
    await restoreCategory(db, a);
    assert.deepEqual((await listCategories(db, 'EXPENSE')).map((c) => c.id), [b, a]);
  });
  test('delete + undo brings back the same row (id, position, dates)', async () => {
    const db = await testDb();
    const a = await createCategory(db, food);
    const b = await createCategory(db, blank('Coffee'));
    const before = (await getCategory(db, a))!;
    const removed = await deleteCategory(db, a);
    assert.equal(await getCategory(db, a), null);
    await putCategory(db, removed);
    assert.deepEqual(await getCategory(db, a), before);
    assert.deepEqual((await listCategories(db, 'EXPENSE')).map((c) => c.id), [a, b]);
  });
  test('undo after an edit restores the previous values', async () => {
    const db = await testDb();
    const a = await createCategory(db, food);
    const before = (await getCategory(db, a))!;
    await updateCategory(db, a, { name: 'Eating out', icon: 'restaurant', tint: 'rose' });
    await putCategory(db, before);
    assert.deepEqual(await getCategory(db, a), before);
  });
  test('reorder', async () => {
    const db = await testDb();
    const ids = [await createCategory(db, blank('A')), await createCategory(db, blank('B')), await createCategory(db, blank('C'))];
    await reorderCategories(db, 'EXPENSE', [ids[2], ids[0], ids[1]]);
    assert.deepEqual((await listCategories(db, 'EXPENSE')).map((c) => c.id), [ids[2], ids[0], ids[1]]);
  });
  test('a blank new category gets the tint after the last one', async () => {
    const db = await testDb();
    assert.equal(await nextTint(db, 'EXPENSE'), 'rose');
    await createCategory(db, { ...blank('A'), tint: 'slate' });
    assert.equal(await nextTint(db, 'EXPENSE'), 'rose');
    await createCategory(db, { ...blank('B'), tint: 'amber' });
    assert.equal(await nextTint(db, 'EXPENSE'), 'mint');
    assert.equal(await nextTint(db, 'INCOME'), 'rose');
  });
  test('unknown icon or tint in a row falls back instead of breaking', async () => {
    const { db, raw } = rawTestDb();
    const { initializeDatabase } = await import('@/db/database');
    await initializeDatabase(db);
    raw.exec(`INSERT INTO Categories (name, kind, icon, tint, created_at) VALUES ('X', 'EXPENSE', 'unicorn', 'neon', '2026-01-01T00:00:00Z')`);
    const [c] = await listCategories(db, 'EXPENSE');
    assert.equal(c.icon, 'ellipsis-horizontal-circle');
    assert.equal(c.tint, 'slate');
  });
});
