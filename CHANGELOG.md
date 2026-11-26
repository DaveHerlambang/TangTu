# Changelog

All notable changes to TangTu, newest first. Format: **NEW / CHANGED / FIXED / REMOVED / UNDER THE HOOD**.
Versioning rules live in [`docs/SPEC.md`](docs/SPEC.md) §10. Add an entry here with every release.

---

## 0.5.0 — 2026-11-26

TangTu goes online: the data lives in each user's own Supabase project (docs/SPEC.md §0.4, §14.9–16). A change of
purpose — MAJOR by the rules, MINOR under `0.x` (§10.2). Old backups still restore.

**Self-hosters: before installing, create a Supabase project and run `npx supabase init`, `link` and `db push`
(README).**

**NEW**
- Sign in with an account made in your project's dashboard (no sign-up, no password reset in the app). You
  stay signed in until you sign out, and the sign-in screen remembers the last email (never the password).
- Settings → Account: "Signed in as …" and Sign out (asks first; this device's markers and the restore safety
  copy are cleared, so the next account never gets the previous one's Undo restore).
- The offline version's data on an Android phone is offered to the account once (Home card, and Settings → Your
  data until it's moved). The old database is only read, never changed.
- "Can't reach your data" with Try again on Home, Charts, a category and a day, instead of a red error; the last
  data stays on screen.
- A build without Supabase settings opens "TangTu isn't set up yet" instead of crashing.

**CHANGED**
- All data (categories, transactions, the bell) lives in Supabase Postgres with row level security; the phone
  keeps only preferences, device markers and the session.
- Ids are UUIDs made by the database instead of whole numbers counting up.
- Backup and restore work on the signed-in account. The file is the same `format: 1` with `schemaVersion` 4
  (UUID ids; the offline version refuses it as newer). A restore gives rows new ids, all or nothing, and only
  touches this account; every older backup still restores. The safety copy for Undo restore is still on the
  device.
- Android auto-backup is off (`allowBackup: false`): the session must not land in a Google Drive backup (S1).
- Dev tools: mock data is sent as one restore; "Nuke" empties the signed-in account (test accounts only).

**REMOVED**
- The on-phone SQLite tables and their migrations (`src/db/database.ts`). The old file is kept, read only.

**UNDER THE HOOD**
- `supabase/migrations/20261126000000_init.sql`: tables with UUID ids and `user_id`, a composite foreign key so a
  transaction's category is the same account's and kind, RLS policies, and the functions `categories_by_use`,
  `search_transactions`, `used_categories`, `replace_all_data`.
- `@supabase/supabase-js` + `react-native-url-polyfill`; the session in `expo-sqlite/localStorage`; tokens
  refresh only in the foreground. `src/db/db.ts` (errors to `connection` / `auth.signedOut`, paging past
  Supabase's 1000-row cap), `src/db/supabase.ts`, `src/auth/AuthProvider.tsx`, `Stack.Protected` in the root
  layout.
- Git ignores everything in `supabase/` but the migrations (the CLI's `config.toml` and linked project).
- Tests: 161. The migrations run on PGlite (Postgres in WebAssembly, dev dependency) with Supabase's auth stubbed:
  RLS between two accounts, constraints, restore. Logic tests use in-memory rows. `npm run test:live` checks the
  repositories against the project on two test accounts (needs `.env.test.local`; refuses an email without
  "test" in it, since it empties both accounts).

---

## 0.4.2 — 2026-11-23

The add / edit screen and navigation (docs/AUDIT-0.4.0.md, release 2).

**FIXED**
- Tapping twice quickly no longer opens the same screen twice (reported on the phone: "+ New" opened two
  category editors that both had to be closed). Applies to every screen.
- Opening the number pad closes the keyboard, so the amount stays in sight while you type it.
- "Enter the amount first" no longer comes back by itself after the amount is filled and then emptied.
- Two quick taps on the number pad both count.
- Deleting a transaction no longer shows an empty screen while it closes.
- Switching Expense | Income no longer shows the other kind's categories for a moment.

**UNDER THE HOOD**
- Root-stack screens use Expo Router's `dangerouslySingular`; `__tests__/navigation.test.ts` checks every
  route is declared in `src/app/_layout.tsx` and singular.
- Tests: 169.

---

## 0.4.1 — 2026-11-23

Fixes from the 0.4.0 audit that tests can prove (docs/AUDIT-0.4.0.md, release 1).

**FIXED**
- Changing the month's start day no longer skips a month recap: the next recap comes at the next boundary
  under the new start day. The same fix keeps "tanggal tua" from being held back after such a change.
- The year recap can no longer appear twice (with a start day from about 19 up, the bell's 60-day trim used
  to let it through again).
- The bell's month recap says "Rp X more than your income" when spending passes income, as Home does, instead
  of "left -Rp X".
- Restore refuses a backup file with a transaction whose amount isn't a whole positive number or whose date
  isn't valid (such a file was accepted and its rows showed up with no date).
- Error messages are always in the app's language; no technical text.

**UNDER THE HOOD**
- Temporary copies of the data are cleaned from the cache: the picked restore file once read, older export
  files at the next export.
- `src/utils/bellSchedule.ts` (`recapHandledThrough`, `recapDedupeKey`, `yearToRecap`); device marker
  `lastYearRecap`; dedupe keys of recaps and "tanggal tua" carry the start day.
- `.prettierrc` with the project's style.
- The owner's other working notes (`docs/HANDOFF.md`, `docs/AUDIT-*.md`) are git-ignored like
  `docs/IMPROVEMENT_PLAN.md`; `docs/SPEC.md` stays in the repo.
- Tests: 167 (backup row checks incl. a year of mock data, recap scheduling, recap wording, error messages).

---

## 0.4.0 — 2026-11-23

Three new themes.

**NEW**
- Themes **Matcha** (matcha-latte canvas, matcha-powder buttons; spending in deep matcha ink, income teal-green), **Iced Latte** / Kopi Susu (warm cream and coffee) and **Pitch Black** /
  Hitam Pekat (true black for OLED screens, soft grey text, calm gold). Settings → Theme now lists six: Light,
  Dark, Cherry Blossom, Pitch Black, Matcha, Iced Latte.

**CHANGED**
- Light: spending is shown in the theme's blue (it was the same green as income, so the two looked alike on
  Home). Income stays green, and the Light swatch in Settings now matches the screen.

**UNDER THE HOOD**
- `ThemeName` gains `matcha`, `latte`, `black`; the contrast test covers them with no accepted exceptions
  (15 more checks). The light tints serve Matcha and Iced Latte, the dark tints Pitch Black.
- docs/SPEC.md §6.1: both theme tables; "Dark is navy; Pitch Black is the one true-black theme".

---

## 0.3.0 — 2026-11-22

Home shows income next to spending, search lives on Home, and the bell has more to say.

**CHANGED**
- Home's summary card: Spent and Income side by side at the same size; "left" is a small line under them,
  shown only once the period has income, and calm text (not red) when spending passes income.
- Search moved onto Home: a field between the card and the list. Touching it swaps the card for a one-line
  count, shows date chips (This month · Last month · 3 months · All time · Pick dates…) and category chips,
  and the list filters live. Cancel or Back ends it.
- The period recap in the bell adds the biggest purchase and which top categories were higher or lower than
  usual; with no income it shows the spending alone.

**NEW**
- Bell: "Tanggal tua is here", once per period in its last 7 days, with what's left and about how much per
  day (only with income and something left).
- Bell: "Your 2026 in TangTu", the year recap, early in the new year.

**REMOVED**
- The separate search screen and the magnifier in Home's header (search is on Home now).

**UNDER THE HOOD**
- `searchTransactions` takes an optional date `range`; `searchRange` (pure) builds the chips' ranges;
  `useTransactionSearch` + `SearchPanel`.
- Activity kinds `tanggal_tua`, `year_recap`; `recap` params gain optional `biggest` and `compare`;
  `buildTanggalTua`, `buildYearRecap`, `hasActivity`. Not backed up, so no backup change.
- Tests: tanggal tua window, start day and no-bad-news rule; biggest purchase and "usual"; old recap rows;
  year recap with start days 1 and 25; search date chips and ranges (143 tests).

---

## 0.2.0 — 2026-11-22

The add screen, redesigned, and rupiah only.

**CHANGED**
- Add / edit transaction redesigned (docs/SPEC.md §4): Expense | Income first, then the amount big and
  centred with a "Tap to enter the amount" hint, then the categories, then the day chip and the note on one
  line, Save pinned at the bottom.
- The number pad is closed when the screen opens. Tapping the amount slides it up from the bottom (blinking
  caret) while Save stays in place; it slides away on ⌄, Back, picking a category, or touching the day or the note.
- Quick-amount chips show the number only ("10.000", "100.000"), all at the same size.
- The day is one chip ("Today ▾") that opens Today · Yesterday · Pick a date….
- Save is always enabled and always says "Save". Pressed with something missing it shows where: no amount →
  the pad opens, the amount shakes, "Enter the amount first"; no category → the grid scrolls into view and
  shakes, "Pick one to save". Calm colour, warning haptic, announced to screen readers.

**REMOVED**
- Other currencies (owner, §14.1): no currency choice on the add/edit screen, no default currency in Settings.
  Every new transaction is rupiah and every total counts rupiah. Transactions already logged in another
  currency keep their currency and stay "not in totals"; 0.1.x backups still restore (their default
  currency is ignored).

**UNDER THE HOOD**
- `defaultCurrency` removed from the store and from backups; screens use `DEFAULT_CURRENCY`.
- Mock data is rupiah only. `NumberPad` gained `onHide`; `ChoiceSheet`'s hint is optional; `formatQuickAmount`;
  `FormField` gained `message`; `hapticNudge`.
- The pad animates its holder's height (Reanimated `withTiming`), not a layout animation, so Save never moves.
- Tests: an old backup's `defaultCurrency` is ignored; mock data has no other currencies.

---

## 0.1.1 — 2026-11-22

Fixes from the first run on the owner's phone.

**FIXED**
- Add / edit transaction: the keyboard no longer covers the note field. The form now scrolls the field above
  the keyboard and the Save bar (`KeyboardAwareScrollView` with a `bottomOffset` that clears the bar).

**CHANGED**
- Settings → Language: "Follow phone" / "Ikuti HP" is now **"System default" / "Default sistem"**.

**UNDER THE HOOD**
- Release rules (AGENTS.md, docs/SPEC.md §10.3): commits and PRs carry no `Co-Authored-By` or other
  attribution lines; §10.3 notes which parts the owner asked for and which Claude wrote.
- `docs/IMPROVEMENT_PLAN.md` (the owner's working notes) is git-ignored, as in TracKar.

---

## 0.1.0 — 2026-11-22

Phases 1–6 of the build order (docs/SPEC.md §13): setup, design system, categories, core loop, charts, safety, polish.

**NEW**
- Project created on Expo SDK 58 (Expo Router, TypeScript strict, New Architecture), identity per §0.1.
- TracKar's design system: the three themes (Cherry Blossom, Light, Dark), Nunito type scale, components
  (Touchable, AppText, Card, Button, BottomSheet, ToastHost, SegmentedControl, MonthSwitcher, pickers, swipe
  actions, sortable list, the eye), copied from TracKar and adapted.
- Category tints (8, per theme) in the theme for the category badges.
- English | Bahasa Indonesia from the first screen: own typed dictionaries (`src/i18n`), `useT()` with
  interpolation and English plurals, "Follow phone" via `expo-localization`, own month/weekday tables.
- Periods with a user start day (default 1; 29–31 clamp to short months), keyed by the month they end in.
- Themed splash: TangTu · Tanggal Tua · "Selamat datang di tanggal tua".
- Home and Charts tabs with the shared period header (tap the period to pick another) and empty states.
- Settings: Theme and Language.
- Dev gear (dev builds only): Nuke database.
- Categories (phase 2): Settings → Categories, Expense | Income, drag to reorder, add / edit / archive /
  restore / delete with Undo. New categories start from a template (§7.3: name, icon and colour filled in)
  or blank; icon picker with the §7.2 groups and search in both languages; 8 preset colours; live badge
  preview. Nothing is created automatically.
- Transactions (phase 3): add / edit / delete with Undo on an in-app number pad with quick amounts;
  Expense | Income; category grid with the most used of the last 60 days first and "+ New"; Today ·
  Yesterday · Pick a date; optional note. Home: summary card (spent, income · left, top category, daily
  average, count; hidden until the eye), transactions grouped by day with day totals, swipe for Again ·
  Edit · Delete, long-press for the same, pull to refresh, + button that hides while scrolling.
- Currencies: IDR, USD, JPY, EUR, SGD, each in its usual format. Default currency in Settings (with a
  warning, nothing converted); each transaction can use another. Totals count the default currency;
  others are listed under the summary as "not in totals".
- Charts (phase 4), for the shared period: **where it went** (categories ranked by spending with bar,
  amount and share; top 7 + "Other" to unfold; tap to open the category), **the trend** (spent over the
  last 6 periods from the first one with data; tap a bar to switch period; a hint until there are two),
  **spent per day** (a bar per day, today outlined, dashed daily-average line; tap a day to open it).
  Other currencies are named as not counted.
- Category screen: its total and share for the period, its trend, its transactions by day; period
  arrows; edit button. Day screen: what was spent and earned that day, and its transactions.
- Home's three summary stats are buttons: top category → its screen, daily average → Charts,
  transactions → scrolls to the list.
- Backup and restore (phase 5): Settings → Your data → **Export backup** (JSON through the share sheet,
  then "Did you save the backup?"; only "Yes, saved" updates **Last backup**), **Restore from backup**
  (validated, confirmed, replaces everything, applies only valid preferences) and **Undo last restore**
  for 7 days from a safety copy taken just before the restore.
- Polish (phase 6): **search** by note or category name with category chips; **Month starts on** (start
  day 1–31) in Settings; **the bell** with month recaps (spent, income, left, top 3), "Backup restored" and
  "Restore undone", written in the current language; **What's new** page (Settings → About, and the bell
  on the first launch of a new version) with notes in English and Indonesian.
- Dev gear (dev builds only): **Mock data · 6 months / 1 year** — deterministic fake history with big and
  quiet months, salary on the start day, and a few yen / dollar transactions.

**FIXED**
- Settings showed garbled characters ("Â·") in the footer and the currency list: `settings.tsx` had been
  saved with a double UTF-8 encoding.

**UNDER THE HOOD**
- Tests in `__tests__/` (plain Node + type stripping, `npm test`): period maths for every start day incl.
  Dec → Jan and February, contrast of every theme token and tint, dictionaries complete and consistent in
  both languages, date tables, relative dates, preference validation, and no hard-coded UI text.
- Migration v1: `Categories`. Repository tests run against real SQLite (`node:sqlite`): names in both
  languages and uniqueness, archive/restore, delete + Undo restoring the same row, reorder, next tint, and
  every catalog icon existing in Ionicons.
- Migration v2: `Transactions` (amount in the currency's smallest unit, own `currency` column). Tests for
  transactions, Undo, archived categories in history, most-used order, `summarize` (one totals function,
  currencies kept apart, period start days), day grouping, money formats and the number pad.
- `DomainError` now carries a code + params (translated by the screen), not an English sentence.
- React Native 0.88 ref types: `HostInstance` / `TextInputInstance` replace `View` / `TextInput` as ref types
  in the copied components.
- Lockfile generated with npm 10.9.8.
- Chart data is pure and tested (`rankCategories`, `trendKeys` / `trendPoints`, `spendByDay` in
  `src/utils/summary.ts`): every figure goes through `summarize`, so the trend and the daily bars add up
  to Home's numbers for any start day. `listTransactions` takes an optional category; `firstTransactionAt`.
- Transaction rows and their swipe / long-press actions moved out of Home into `TransactionRow` and
  `useTransactionActions`, shared by Home, the category and the day screens.
- Backup format and SQL in `src/db/backupRepository.ts` (testable), files / share sheet / safety copy in
  `src/services/backup.ts`. Tests: round trip (ids, currencies, archived categories, totals), every
  rejection (not a TangTu file, newer version, damaged, empty), atomic restore (a bad row changes
  nothing), columns mapped by name, mock data deterministic and never in the future.
- Migration v3: `Activity` (kind + JSON params, never sentences). Cleared on restore, never backed up.
  Tests: migrations from every older schema, bell dedupe / unread / trimming, recaps from `summarize`, every
  bell message in both languages with no unfilled placeholders, release notes (version = app version, order,
  both languages alike), search (wildcards, names in both languages, chips).
- SDK 58: `File.write()` is now async (it was sync in TracKar's SDK 57) and is awaited.
