/**
 * Category templates (§7.3) and the icon catalog (§7.2). Pure data: no React Native imports, so the
 * tests can check it. Names and labels live in the dictionaries (`template.*`, `icon.*`, `icons.group.*`).
 */
import type { CategoryKind } from '@/types/models';
import type { TintKey } from '@/theme/themes';

// ---------------------------------------------------------------------------
// Icons (§7.2). Stored as the base Ionicons name, drawn as `<name>-outline`.

export const ICON_GROUPS = [
  { key: 'food', icons: ['fast-food', 'restaurant', 'cafe', 'pizza', 'ice-cream', 'beer', 'wine', 'nutrition'] },
  { key: 'shopping', icons: ['cart', 'basket', 'bag-handle', 'shirt', 'pricetag', 'storefront', 'diamond', 'gift'] },
  { key: 'transport', icons: ['car', 'car-sport', 'bus', 'train', 'subway', 'bicycle', 'airplane', 'boat', 'speedometer'] },
  { key: 'home', icons: ['home', 'flash', 'water', 'wifi', 'phone-portrait', 'tv', 'receipt', 'key', 'bed', 'construct', 'hammer'] },
  { key: 'health', icons: ['medkit', 'medical', 'bandage', 'fitness', 'barbell', 'heart', 'cut', 'sparkles', 'glasses'] },
  {
    key: 'fun',
    icons: ['game-controller', 'film', 'musical-notes', 'ticket', 'camera', 'color-palette', 'brush', 'football', 'basketball', 'golf', 'balloon'],
  },
  { key: 'learning', icons: ['school', 'book', 'library', 'newspaper', 'laptop', 'desktop', 'briefcase', 'business'] },
  { key: 'people', icons: ['people', 'person', 'happy', 'paw', 'flower', 'rose', 'leaf'] },
  {
    key: 'money',
    icons: ['card', 'cash', 'wallet', 'trending-up', 'shield-checkmark', 'umbrella', 'repeat', 'cloud', 'globe', 'ribbon', 'trophy', 'rocket'],
  },
  { key: 'other', icons: ['ellipsis-horizontal-circle'] },
] as const;

export type IconGroupKey = (typeof ICON_GROUPS)[number]['key'];
export type CategoryIcon = (typeof ICON_GROUPS)[number]['icons'][number];

export const ALL_CATEGORY_ICONS: readonly CategoryIcon[] = ICON_GROUPS.flatMap((g) => g.icons);

/** Shown for a blank category, and for an icon this version doesn't know (e.g. from a newer backup). */
export const FALLBACK_ICON: CategoryIcon = 'ellipsis-horizontal-circle';

export const isCategoryIcon = (v: unknown): v is CategoryIcon =>
  typeof v === 'string' && (ALL_CATEGORY_ICONS as readonly string[]).includes(v);

// ---------------------------------------------------------------------------
// Templates (§7.3): offered when creating a category; nothing is created automatically.

export interface CategoryTemplate {
  key: string;
  kind: CategoryKind;
  icon: CategoryIcon;
  tint: TintKey;
}

export const CATEGORY_TEMPLATES = [
  { key: 'food', kind: 'EXPENSE', icon: 'fast-food', tint: 'peach' },
  { key: 'groceries', kind: 'EXPENSE', icon: 'basket', tint: 'mint' },
  { key: 'transport', kind: 'EXPENSE', icon: 'car', tint: 'sky' },
  { key: 'bills', kind: 'EXPENSE', icon: 'receipt', tint: 'slate' },
  { key: 'shopping', kind: 'EXPENSE', icon: 'bag-handle', tint: 'rose' },
  { key: 'health', kind: 'EXPENSE', icon: 'medkit', tint: 'teal' },
  { key: 'fun', kind: 'EXPENSE', icon: 'game-controller', tint: 'lavender' },
  { key: 'gifts', kind: 'EXPENSE', icon: 'gift', tint: 'amber' },
  { key: 'other_expense', kind: 'EXPENSE', icon: 'ellipsis-horizontal-circle', tint: 'slate' },
  { key: 'salary', kind: 'INCOME', icon: 'cash', tint: 'mint' },
  { key: 'side_income', kind: 'INCOME', icon: 'briefcase', tint: 'sky' },
  { key: 'gift_income', kind: 'INCOME', icon: 'gift', tint: 'rose' },
  { key: 'other_income', kind: 'INCOME', icon: 'ellipsis-horizontal-circle', tint: 'slate' },
] as const satisfies readonly CategoryTemplate[];

export type TemplateKey = (typeof CATEGORY_TEMPLATES)[number]['key'];

export const isTemplateKey = (v: unknown): v is TemplateKey =>
  typeof v === 'string' && CATEGORY_TEMPLATES.some((t) => t.key === v);

export const templateOf = (key: TemplateKey): CategoryTemplate => CATEGORY_TEMPLATES.find((t) => t.key === key)!;

export const templatesFor = (kind: CategoryKind): readonly CategoryTemplate[] =>
  CATEGORY_TEMPLATES.filter((t) => t.kind === kind);
