// Every user-visible string goes through t() (§6.5, §12): this fails on text written straight
// into a component — JSX text, string props the user reads or hears, and Alert / toast strings.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

/** Dev tools never ship (they're stripped by the `__DEV__` guard), so they may stay English. */
const EXEMPT_FILES = new Set(['src/components/DevToolsGear.tsx']);

/** Props whose string value is shown or spoken. */
const TEXT_PROPS = new Set([
  'accessibilityLabel',
  'accessibilityHint',
  'aria-label',
  'label',
  'title',
  'placeholder',
  'hint',
  'detail',
  'caption',
  'message',
  'actionLabel',
]);

/** Calls whose string arguments are shown: Alert.alert(title, message, [{ text }]), showToast({ message }). */
const TEXT_CALLS = new Set(['alert', 'showToast']);

const hasLetters = (s: string) => /\p{L}/u.test(s);
const isPlainString = (n: ts.Node): n is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : [],
  );
}

/** Returns "file:line what" for every hard-coded user-visible string in `text`. */
function findLiterals(name: string, text: string): string[] {
  const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const at = (node: ts.Node) => `${name}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

  const visit = (node: ts.Node) => {
    // <AppText>Hello</AppText>
    if (ts.isJsxText(node) && hasLetters(node.text)) found.push(`${at(node)} JSX text "${node.text.trim()}"`);

    // label="Hello", label={'Hello'}, label={`Hello ${x}`}
    if (ts.isJsxAttribute(node) && TEXT_PROPS.has(node.name.getText(source)) && node.initializer) {
      const init = node.initializer;
      const expr = ts.isJsxExpression(init) ? init.expression : init;
      if (expr && isPlainString(expr) && hasLetters(expr.text)) {
        found.push(`${at(node)} ${node.name.getText(source)}="${expr.text}"`);
      } else if (expr && ts.isTemplateExpression(expr)) {
        const fixed = expr.head.text + expr.templateSpans.map((s) => s.literal.text).join('');
        if (hasLetters(fixed)) found.push(`${at(node)} ${node.name.getText(source)}={${expr.getText(source)}}`);
      }
    }

    // Alert.alert('Title', 'Message', [{ text: 'OK' }]) / showToast({ message: 'Saved' })
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const fn = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : '';
      if (TEXT_CALLS.has(fn)) {
        const scan = (n: ts.Node) => {
          if (isPlainString(n) && hasLetters(n.text)) {
            const parent = n.parent;
            // `style: 'cancel'` / `style: 'destructive'` are options, not text.
            const isOption = ts.isPropertyAssignment(parent) && parent.name.getText(source) === 'style';
            if (!isOption) found.push(`${at(n)} ${fn}("${n.text}")`);
          }
          // Don't descend into t('key') calls: their argument is a key, not text.
          if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 't') return;
          ts.forEachChild(n, scan);
        };
        node.arguments.forEach(scan);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

test('components render no hard-coded user-visible text', () => {
  const files = walk(SRC)
    .map((f) => relative(ROOT, f).replace(/\\/g, '/'))
    .filter((f) => !EXEMPT_FILES.has(f));
  assert.ok(files.length > 10, 'expected to scan the app’s components');
  const literals = files.flatMap((f) => findLiterals(f, readFileSync(join(ROOT, f), 'utf8')));
  assert.deepEqual(literals, [], `Move these into src/i18n/en.ts + id.ts and use t():\n${literals.join('\n')}`);
});

test('the checker catches what it should, and nothing else', () => {
  const sample = `
    const A = () => <AppText accessibilityLabel="Close">Hello {name}</AppText>;
    const B = () => <Button label={t('common.save')} style={{ color: 'red' }} hitSlop={8} />;
    const C = () => <Row title={\`Total \${n}\`} detail={\`\${a} · \${b}\`} />;
    Alert.alert('Oops', t('x'), [{ text: 'OK', style: 'cancel' }]);
  `;
  const found = findLiterals('sample.tsx', sample);
  assert.deepEqual(
    found.map((f) => f.replace(/^sample\.tsx:\d+ /, '')),
    ['accessibilityLabel="Close"', 'JSX text "Hello"', 'title={`Total ${n}`}', 'alert("Oops")', 'alert("OK")'],
  );
});
