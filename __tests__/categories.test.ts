// Categories (§3, §7): templates, names in both languages, the name rule, tints, unknown values in a row. Since
// 0.5.0 the data is online: these are the app's own rules (pure); what the database enforces — unique typed names,
// a used category kept, rows per account — is in schema.test.ts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ALL_CATEGORY_ICONS, CATEGORY_TEMPLATES, ICON_GROUPS } from '@/constants/categories';
import { findNameClash, normalizeName, tintAfter, toCategory, type CategoryInput } from '@/db/categoriesRepository';
import { DomainError } from '@/db/errors';
import { en } from '@/i18n/en';
import { TINT_ORDER } from '@/theme/themes';
import type { Category } from '@/types/models';
import { categoryName, storedName } from '@/utils/categoryNames';

import { memoryData, testId } from './support/memory';

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

describe('names', () => {
  test('an untouched template category follows the language', async () => {
    const db = memoryData();
    const id = await db.createCategory(food);
    const c = db.categories.find((x) => x.id === id)!;
    assert.equal(c.name, null);
    assert.equal(categoryName(c, 'en'), 'Food & Drinks');
    assert.equal(categoryName(c, 'id'), 'Makan & Minum');
  });
  test('a renamed one is shown as typed in both languages (spaces tidied)', () => {
    const named = normalizeName({ name: '  Jajan   kopi ', templateKey: 'food' });
    assert.deepEqual(named, { name: 'Jajan kopi', template_key: 'food' });
    assert.equal(categoryName(named, 'en'), 'Jajan kopi');
    assert.equal(categoryName(named, 'id'), 'Jajan kopi');
  });
  test("typing the template's own name (either language) keeps it following the language", () => {
    assert.equal(storedName('Food & Drinks', 'food'), null);
    assert.equal(storedName(' makan & minum ', 'food'), null);
    assert.equal(storedName('', 'food'), null);
    assert.equal(storedName('Makan siang', 'food'), 'Makan siang');
    assert.equal(storedName('  ', null), null);
  });
  test('a blank category needs a name', async () => {
    const db = memoryData();
    await rejectsWith(db.createCategory(blank('   ')), 'category.nameEmpty');
  });
  test('active names are unique per kind, case-insensitively and across languages', async () => {
    const db = memoryData();
    await db.createCategory(food);
    await rejectsWith(db.createCategory(food), 'category.nameTaken');
    await rejectsWith(db.createCategory(blank('makan & MINUM')), 'category.nameTaken');
    await rejectsWith(db.createCategory(blank('food & drinks')), 'category.nameTaken');
    const coffee = await db.createCategory(blank('Coffee'));
    await rejectsWith(db.createCategory(blank(' coffee ')), 'category.nameTaken');
    // Renaming: the category itself doesn't count, another one does.
    assert.equal(findNameClash({ name: 'COFFEE', template_key: null }, db.categories, coffee), null);
    assert.equal(findNameClash({ name: 'Makan & Minum', template_key: null }, db.categories, coffee)?.template_key, 'food');
    // Same name in the other kind is fine ("Gift" expense vs income templates, or typed).
    await db.createCategory(blank('Coffee', 'INCOME'));
  });
  test('an archived category frees its name; restoring is refused while it is taken', async () => {
    const db = memoryData();
    const old = await db.createCategory(blank('Snacks'));
    db.categories.find((c) => c.id === old)!.archived_at = '2026-02-01T00:00:00.000Z';
    const fresh = await db.createCategory(blank('snacks'));
    const active = () => db.categories.filter((c) => !c.archived_at);
    const oldOne = db.categories.find((c) => c.id === old)!;
    assert.equal(findNameClash(oldOne, active(), old)?.id, fresh, 'restoring would clash');
    db.categories.find((c) => c.id === fresh)!.archived_at = '2026-03-01T00:00:00.000Z';
    assert.equal(findNameClash(oldOne, active(), old), null, 'free again');
  });
});

describe('tints and unknown values', () => {
  test('a blank new category gets the tint after the last one', () => {
    assert.equal(tintAfter(null), 'rose');
    assert.equal(tintAfter('slate'), 'rose');
    assert.equal(tintAfter('amber'), 'mint');
    assert.equal(tintAfter('neon'), 'rose');
  });
  test('unknown icon, tint or kind in a row falls back instead of breaking; dates come back in ISO form', () => {
    const c: Category = toCategory({
      id: testId(1),
      name: 'X',
      template_key: 'nope',
      kind: 'SOMETHING',
      icon: 'unicorn',
      tint: 'neon',
      position: 0,
      archived_at: null,
      created_at: '2026-01-01T07:00:00+07:00',
    });
    assert.equal(c.icon, 'ellipsis-horizontal-circle');
    assert.equal(c.tint, 'slate');
    assert.equal(c.kind, 'EXPENSE');
    assert.equal(c.template_key, null);
    assert.equal(c.created_at, '2026-01-01T00:00:00.000Z');
  });
});
