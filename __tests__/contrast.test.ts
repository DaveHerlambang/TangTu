// WCAG AA contrast for every theme token and category tint (§6.1, §7.1).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { THEME_ORDER, TINT_ORDER, themes } from '@/theme/themes';

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Not a #RRGGBB colour: ${hex}`);
  const n = parseInt(m[1], 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const CONTROL = 3;

/**
 * Accepted exceptions (owner, 2026-11-18 — docs/SPEC.md §14.8): TracKar's exact values, which miss the
 * stricter rule here (TangTu also checks `background` and `track`; TracKar checks `surface`). Each entry
 * pins today's ratio, so any further drop still fails. Don't add to this list without asking the owner.
 */
const ACCEPTED_GAPS: Record<string, number> = {
  'sakura textMuted on track': 4.47, // #7A6570 on #F8E6EE; #79646F would give 4.54
  'sakura success on track': 4.35, // #357A4B on #F8E6EE; #347749 would give 4.52
  'sakura danger on track': 4.21, // #C33F55 on #F8E6EE; #BB3C52 would give 4.52
  'light outline on background': 2.83, // #8E94A3 on #F6F7F9; #898F9D would give 3.02
};

/** Checks every pair and reports all failures at once (not just the first). */
function expectPairs(theme: string, pairs: [fg: string, bg: string, min: number, what: string][]) {
  const failures: string[] = [];
  for (const [fg, bg, min, what] of pairs) {
    const name = `${theme} ${what}`;
    const ratio = contrast(fg, bg);
    const gap = ACCEPTED_GAPS[name];
    if (ratio >= min) continue;
    if (gap !== undefined && ratio.toFixed(2) === gap.toFixed(2)) continue;
    failures.push(`${name}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${min}:1`);
  }
  assert.deepEqual(failures, []);
}

test('the contrast formula matches known values', () => {
  assert.equal(contrast('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(contrast('#FFFFFF', '#FFFFFF').toFixed(1), '1.0');
  assert.equal(contrast('#767676', '#FFFFFF').toFixed(2), '4.54');
});

const MEANINGFUL = ['text', 'textMuted', 'accent', 'primaryText', 'success', 'danger'] as const;
const GROUNDS = ['surface', 'background', 'track'] as const;

for (const name of THEME_ORDER) {
  const { colors: c, tints } = themes[name];
  describe(`theme ${name}`, () => {
    test('meaningful text and icons ≥ 4.5:1 on surface, background and track', () =>
      expectPairs(
        name,
        MEANINGFUL.flatMap((token) => GROUNDS.map((bg) => [c[token], c[bg], TEXT, `${token} on ${bg}`] as [string, string, number, string])),
      ));
    test('onPrimary on primary ≥ 4.5:1', () => expectPairs(name, [[c.onPrimary, c.primary, TEXT, 'onPrimary on primary']]));
    test('outlines of pressable controls ≥ 3:1', () =>
      expectPairs(name, [
        [c.outline, c.surface, CONTROL, 'outline on surface'],
        [c.outline, c.background, CONTROL, 'outline on background'],
      ]));
    test('the toast (inverse colours) is readable', () =>
      expectPairs(name, [
        [c.background, c.text, TEXT, 'toast message (background on text)'],
        [c.toastAction, c.text, TEXT, 'toast action on text'],
      ]));
    test('category tints: ink ≥ 4.5:1 on its fill, on surface and on background', () =>
      expectPairs(
        name,
        TINT_ORDER.flatMap((key) => {
          const { fill, ink } = tints[key];
          return [
            [ink, fill, TEXT, `${key} ink on fill`],
            [ink, c.surface, TEXT, `${key} ink on surface`],
            [ink, c.background, TEXT, `${key} ink on background`],
          ] as [string, string, number, string][];
        }),
      ));
  });
}

// Spent (money colour) and Income (success) sit side by side on Home since 0.3.0: they must never look alike.
test('every theme shows spending and income in clearly different colours', () => {
  const same = THEME_ORDER.filter((name) => {
    const { accent, success } = themes[name].colors;
    const [a, b] = [accent, success].map((hex) => parseInt(hex.slice(1), 16));
    const diff = Math.abs((a >> 16) - (b >> 16)) + Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) + Math.abs((a & 255) - (b & 255));
    return diff < 60;
  });
  assert.deepEqual(same, []);
});
