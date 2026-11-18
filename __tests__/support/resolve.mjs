import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = new URL('../../src/', import.meta.url);
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

const isFile = (path) => existsSync(path) && statSync(path).isFile();

/** Node resolve hook: `@/x` → src/x, and tries the TypeScript extensions for app-style imports. */
export async function resolve(specifier, context, next) {
  let target = null;
  if (specifier.startsWith('@/')) target = new URL(specifier.slice(2), SRC);
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    target = new URL(specifier, context.parentURL);
  }
  if (target) {
    const base = fileURLToPath(target);
    if (isFile(base)) return next(pathToFileURL(base).href, context);
    for (const ext of EXTENSIONS) {
      if (isFile(base + ext)) return next(pathToFileURL(base + ext).href, context);
    }
  }
  return next(specifier, context);
}
