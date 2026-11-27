// The web build swaps a file for its `.web.ts(x)` twin (0.6.0, §13.9). Code imports the plain name, so both
// files must offer the same exports; otherwise one platform breaks at run time while the type check (which only
// reads the plain file) stays green. Also: the phone files the web must never load stay out of the web twins.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

/** Names a module exports (values and types), from its source. */
function exportsOf(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const names = new Set<string>();
  for (const node of source.statements) {
    const isExported = ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      node.exportClause.elements.forEach((e) => names.add(e.name.text));
    } else if (isExported && ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach((d) => ts.isIdentifier(d.name) && names.add(d.name.text));
    } else if (isExported && (ts.isFunctionDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isClassDeclaration(node))) {
      if (node.name) names.add(node.name.text);
    }
  }
  return [...names].sort();
}

const webFiles = walk(SRC).filter((f) => /\.web\.tsx?$/.test(f));

test('there are web twins to check', () => {
  assert.ok(webFiles.length >= 4, `expected the web twins, found ${webFiles.length}`);
});

for (const web of webFiles) {
  const name = relative(ROOT, web).replace(/\\/g, '/');
  test(`${name} matches its phone file`, () => {
    const plain = web.replace(/\.web(\.tsx?)$/, '$1');
    assert.ok(existsSync(plain), `${name} has no phone file next to it`);
    // Interfaces only the phone file needs to declare may be re-exported as types by the web one; compare values and types alike.
    assert.deepEqual(exportsOf(web), exportsOf(plain), `${name} and its phone file export different names`);
  });

  test(`${name} loads nothing that only works on the phone`, () => {
    const text = readFileSync(web, 'utf8');
    for (const mod of ['expo-sqlite', 'expo-file-system', 'expo-sharing', 'expo-document-picker']) {
      assert.ok(!text.includes(`from '${mod}`) && !text.includes(`import '${mod}`), `${name} imports ${mod}`);
    }
  });
}
