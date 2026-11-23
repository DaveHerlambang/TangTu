# Changelog

All notable changes to TangTu, newest first. Format: **NEW / CHANGED / FIXED / REMOVED / UNDER THE HOOD**.
Versioning rules live in [`docs/SPEC.md`](docs/SPEC.md) §10. Add an entry here with every release.

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
