import type { CategoryIcon, TemplateKey } from '@/constants/categories';
import type { TintKey } from '@/theme/themes';

import type { Currency } from '@/utils/money';

export type CategoryKind = 'EXPENSE' | 'INCOME';

/** A row of `Transactions` (§3). */
export interface Transaction {
  id: number;
  kind: CategoryKind;
  /** > 0, in the smallest unit of `currency`; the sign comes from `kind`. */
  amount: number;
  currency: Currency;
  category_id: number;
  /** '' when there is none. */
  note: string;
  /** ISO UTC; "today", periods and display use device local time. */
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

/** A transaction with its category, as lists and summaries use it. */
export interface TransactionWithCategory extends Transaction {
  category: Category;
}
export const CATEGORY_KINDS: readonly CategoryKind[] = ['EXPENSE', 'INCOME'];

/** A row of `Categories` (§3). */
export interface Category {
  id: number;
  /** What the user typed. NULL = an untouched template category, named from the dictionary (§6.5). */
  name: string | null;
  /** The §7.3 template it was made from; NULL for a category made from scratch. */
  template_key: TemplateKey | null;
  kind: CategoryKind;
  /** Base Ionicons name from §7.2 (drawn as `<icon>-outline`). */
  icon: CategoryIcon;
  tint: TintKey;
  position: number;
  /** NULL = active. Archived categories leave the pickers but stay themselves in history. */
  archived_at: string | null;
  created_at: string;
}
