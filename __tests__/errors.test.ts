// What the user reads when something fails (§6.5): their language, never a technical message (0.4.1, K2).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DomainError } from '@/db/errors';
import { makeTranslator } from '@/i18n/core';
import { errorAlert } from '@/utils/errorMessage';

test('an unexpected error shows plain words in both languages, not its own message', () => {
  const crash = new Error('SQLITE_BUSY: database is locked');
  const en = errorAlert(crash, makeTranslator('en'));
  const id = errorAlert(crash, makeTranslator('id'));
  assert.equal(en.message, 'Please try again. If it keeps happening, close TangTu and open it again.');
  assert.equal(id.message, 'Coba lagi ya. Kalau masih terjadi, tutup TangTu lalu buka lagi.');
  assert.doesNotMatch(en.message + id.message, /SQLITE/);
});

test('a known problem still explains itself', () => {
  assert.equal(errorAlert(new DomainError('backup.notApp'), makeTranslator('en')).message, "That file isn't a TangTu backup.");
});
