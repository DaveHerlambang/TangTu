# TangTu — session handoff (2026-11-19, after phase 6)

Where the build stands, so work can continue in a later session. **The spec is the source of truth**:
[`SPEC.md`](SPEC.md) — §14 holds the owner's decisions, §16 the build log with every choice made while
building. Rules for agents: [`../AGENTS.md`](../AGENTS.md). This file is a snapshot. Delete it once it's
out of date.

## How to continue

- **Same session:** open a terminal in `E:\Development` (the folder the session was started in, not
  `TangTu`) and run `claude --resume`, then pick the TangTu session. In VS Code: open `E:\Development`
  and choose it from the Claude Code panel's past conversations.
- **New session:** start Claude Code in `E:\Development\TangTu` and say:
  > Read docs/HANDOFF.md, AGENTS.md and docs/SPEC.md (§10, §13, §14, §15, §16). Phase 6 is done except the APK.

## Status

| Phase (§13) | State |
|---|---|
| 1. Setup & design system | Done (0.1.0) |
| 2. Categories | Done (0.1.0) |
| 3. Core loop (transactions, Home, number pad, currencies) | Done (0.1.0) |
| 4. Charts + category and day screens | Done (0.1.0) |
| 5. Safety: backup / restore / undo restore, mock data | Done (0.1.0) |
| 6. Polish: eye ✔ (done in 3), search, start-day setting, bell + recap, What's new, release APK | Done (0.1.0) — except the APK (owner's go-ahead) |
| 7. Owner decides (icon, budgets, recurring, wallets, app lock) | — |

**Checks passing (last run):** `npm run typecheck`, `npm test` (131 tests), `npx expo lint`,
`npx expo-doctor` (20/20), `npx expo export --platform android`, `npm@10.9.8 ci --dry-run`; release bundle has no dev tools.

**Never run on a screen.** The dev machine has no Android SDK, emulator or device. Unverified at runtime:
everything visual, swipe actions and drag-to-reorder (gesture-handler **3.3** here vs 2.32 in TracKar),
the number pad, the keyboard handling in the add form (`KeyboardStickyView`), the charts (layout, SVG
average line, day-number ticks), Home's scroll-to-list, backup export (share sheet), the restore file
picker and file writes, Indonesian at 1.3× font.

## Git

- **0.1.0 released 2026-11-22:** phases 1–6 committed on `release/0.1.0`, fast-forwarded into `master`,
  tagged `v0.1.0`, pushed to `origin` (`https://github.com/DaveHerlambang/TangTu`).
- From now on: one `release/x.y.z` branch per version, rules in SPEC §10.3. Commit/push only when the
  owner asks; propose the patch-notes message first.

## Owner decisions made this session (all in SPEC §14)

- Start day **1**; **income + expenses**; **in-app number pad**; wallets later.
- **Categories:** §7.3 list kept but as **templates** — nothing is created on first launch. Icon and colour
  editable; colour = the **8 preset tints** only. Template names follow the language until renamed.
- **Colours:** keep TracKar's exact values; four contrast gaps are accepted exceptions (§14.8).
- **Currencies:** IDR, USD, JPY, EUR, SGD; decimals where the currency has them; each in its usual style;
  one default in Settings, each transaction can use another; totals count only the default, others
  listed "not in totals"; changing the default warns and converts nothing.
- Still open: app icon artwork and a final name check before any public release (§14.7).

## Phase 4 (done 2026-11-19) — what exists now

- Charts tab: `CategoryBreakdown`, `SpendTrend` (from TracKar's `EarningsTrend`), `DailySpend`; data from
  `rankCategories`, `trendKeys`/`trendPoints` (+ `useSpendTrend`), `spendByDay` in `src/utils/summary.ts`.
- Routes `category/[id]` and `day/[date]`; Home's stats are buttons. Row + actions shared via
  `TransactionRow` and `useTransactionActions`.
- Choices made while building are in SPEC §16 ("phase 4"); none needed an owner decision. Worth a look
  by the owner: "Other" only folds 2+ categories; daily average line = Home's daily average.
- Also fixed: `settings.tsx` was double-encoded ("Â·" on screen).

## Phase 5 (done 2026-11-19) — what exists now

- `src/db/backupRepository.ts` (format, validation, SQL) + `src/services/backup.ts` (files, share sheet,
  safety copy, prefs). Settings → Your data: Export, Restore, Undo last restore (7 days).
- `src/dev/mockData.ts` behind the dev gear: "Mock data · 6 months / 1 year".
- Choices are in SPEC §16 ("phase 5").

## Phase 6 (done 2026-11-19, APK pending) — what exists now

- Bell: `Activity` (migration v3), `src/db/activityRepository.ts`, `src/utils/activityText.ts`,
  `src/services/activityEvents.ts` + `useActivityEvents` (root layout), `NotificationBell`, `notifications`.
- What's new: `src/constants/releaseNotes.ts` (en + id), `whats-new`, Settings → About.
- Search: `search` route, `searchTransactions` / `listUsedCategories`, `nameMatches`.
- Start day: Settings → Tracking → Month starts on (`StartDaySheet`).

## Next

1. **APK** (owner): pick the version and say go. Recommendation in the last session: a `preview` APK as
   **0.1.0** for the owner's own phone (first run on a real device), and keep **1.0.0** for the first APK
   given to someone else after the §15 checklist. Command: `npx eas-cli@latest build -p android --profile preview`.
2. Check on the phone: everything in "Never run on a screen" above.
3. Phase 7 (owner decides): app icon, budgets, recurring, wallets, app lock.

## Where things are

| What | Where |
|---|---|
| Routes | `src/app/` — `(tabs)/index` Home, `(tabs)/charts`, `settings`, `categories`, `category/edit`, `category/[id]`, `day/[date]`, `transaction/new`, `transaction/[id]` |
| SQL | `src/db/database.ts` (migrations v1 Categories, v2 Transactions), `categoriesRepository.ts`, `transactionsRepository.ts` |
| Totals, chart data | `src/utils/summary.ts` (`summarize`, `groupByDay`, `rankCategories`, `trendPoints`, `spendByDay`) |
| Money / pad | `src/utils/money.ts` |
| Backup | `src/db/backupRepository.ts`, `src/services/backup.ts`; mock data `src/dev/mockData.ts` |
| Bell, What's new | `src/db/activityRepository.ts`, `src/utils/activityText.ts`, `src/services/activityEvents.ts`, `src/constants/releaseNotes.ts` |
| Periods, dates | `src/utils/format.ts`, `src/i18n/dates.ts` |
| Words | `src/i18n/en.ts` (source), `id.ts`, `core.ts`, `useT()` in `src/i18n/index.ts` |
| Templates, icons | `src/constants/categories.ts`; brand lines `src/constants/brand.ts` |
| Preferences | `src/store/useAppStore.ts` (+ `src/utils/sanitizePrefs.ts`) |
| Tests | `__tests__/` — real SQLite via `node:sqlite` (`support/db.ts`), run with `npm test` |
