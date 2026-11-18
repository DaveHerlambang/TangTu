// Lets the tests import app code under plain Node (type stripping): resolves the `@/` alias to
// `src/` and the extensionless imports the app uses (`./en` → `./en.ts`, `@/i18n` → `src/i18n/index.ts`).
// Usage: node --import ./__tests__/support/register.mjs --test __tests__/*.test.ts
import { register } from 'node:module';

register('./resolve.mjs', import.meta.url);
