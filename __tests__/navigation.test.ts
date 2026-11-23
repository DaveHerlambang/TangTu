// A second tap while a screen is still opening must not stack a copy of it (§12; 0.4.2, B10). The guard is
// `dangerouslySingular` on the root stack's screens, so this checks the layout: every screen pushed onto the
// root stack is declared there, and every one is singular.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP = join(ROOT, 'src', 'app');
const LAYOUT = join(APP, '_layout.tsx');

/** The tabs group is the stack's root screen: nothing pushes it. */
const NOT_PUSHED = new Set(['(tabs)']);

/** `name` → whether it has `dangerouslySingular`, for each `<Stack.Screen>` in the root layout. */
function stackScreens(): Map<string, boolean> {
  const source = ts.createSourceFile(LAYOUT, readFileSync(LAYOUT, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const screens = new Map<string, boolean>();
  const visit = (node: ts.Node) => {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(source) === 'Stack.Screen') {
      let name: string | null = null;
      let singular = false;
      for (const attr of node.attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        const key = attr.name.getText(source);
        if (key === 'name' && attr.initializer && ts.isStringLiteral(attr.initializer)) name = attr.initializer.text;
        if (key === 'dangerouslySingular') singular = true;
      }
      if (name) screens.set(name, singular);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return screens;
}

/** Route names of the screens outside the tabs, as Expo Router names them (`category/[id]`). */
function stackRoutes(dir = APP): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('(') ? [] : stackRoutes(path);
    if (!entry.name.endsWith('.tsx') || entry.name.startsWith('_') || entry.name.startsWith('+')) return [];
    return [
      relative(APP, path)
        .replace(/\\/g, '/')
        .replace(/\.tsx$/, ''),
    ];
  });
}

test('every screen outside the tabs is declared on the root stack', () => {
  const screens = stackScreens();
  const routes = stackRoutes();
  assert.ok(routes.length >= 9, `found only ${routes.length} routes`);
  for (const route of routes) assert.ok(screens.has(route), `${route} is not declared in src/app/_layout.tsx`);
});

test('every pushed screen is singular, so a double tap opens it once', () => {
  for (const [name, singular] of stackScreens()) {
    if (NOT_PUSHED.has(name)) continue;
    assert.ok(singular, `<Stack.Screen name="${name}"> needs dangerouslySingular`);
  }
});
