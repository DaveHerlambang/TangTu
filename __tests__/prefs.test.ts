// Preferences from a backup file or the saved store are untrusted (§11).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sanitizePrefs } from '@/utils/sanitizePrefs';

test('keeps known keys with valid values', () => {
  assert.deepEqual(sanitizePrefs({ defaultTheme: 'dark', language: 'id', periodStartDay: 25, devToolsHidden: true }), {
    defaultTheme: 'dark',
    language: 'id',
    periodStartDay: 25,
    devToolsHidden: true,
  });
});

test('a 0.1.x backup still restores: its defaultCurrency is ignored (rupiah only since 0.2.0)', () => {
  assert.deepEqual(sanitizePrefs({ language: 'en', defaultCurrency: 'USD' }), { language: 'en' });
});

test('drops unknown keys and invalid values', () => {
  assert.deepEqual(
    sanitizePrefs({ defaultTheme: 'neon', language: 'fr', periodStartDay: 32, defaultCurrency: 'GBP', devToolsHidden: 'yes', lastBackupAt: 'x', evil: 1 }),
    {},
  );
  assert.deepEqual(sanitizePrefs({ periodStartDay: 0 }), {});
  assert.deepEqual(sanitizePrefs({ periodStartDay: 2.5 }), {});
  assert.deepEqual(sanitizePrefs({ language: 'system' }), { language: 'system' });
});

test('survives garbage', () => {
  assert.deepEqual(sanitizePrefs(null), {});
  assert.deepEqual(sanitizePrefs('dark'), {});
  assert.deepEqual(sanitizePrefs([1, 2]), {});
});
