# TangTu (Tanggal Tua) — product spec

*TracKar's sister app: a personal money tracker. This started as the project brief; it is now the
living spec. Decisions made since are written into the sections they affect and logged in §16.*

> **For the AI starting this project.** Read this whole file before writing code. It is the spec.
> Where it is silent, **ask the owner instead of inventing** product rules (money, dates, categories).
> **Start with §0 (setup, step by step)**, then build in the phases of §13, verifying each one.
> Keep this file updated: when a decision is made, write it here and add a line to §16.
>
> **This is a sister app of TracKar** — an offline Expo app by the same owner that tracks shifts and
> income. It must look, feel and behave like TracKar (same themes, fonts, components, motion, interaction
> patterns); only the *job* differs: TracKar tracks work, TangTu tracks money. **Don't re-invent TracKar's
> pieces: copy them from its folder (§0 step 4) and adapt.** If this brief and TracKar's code disagree on
> a design detail, TracKar's code wins; ask if unsure.

---

## 0. Start here — project identity and setup

### 0.1 Identity (change only this table to rename the app)
| | Value |
|---|---|
| App name (shown on the phone) | **TangTu** |
| Full name (shown under the name: splash, About, store listing) | **Tanggal Tua** |
| Tagline (splash) | **"Selamat datang di tanggal tua"** |
| Project folder | `E:\Development\TangTu` |
| Expo `slug` / URL `scheme` | `tangtu` / `tangtu` |
| Android package | `com.tangtu.app` |
| Expo account (`owner` in app.json) | `daveherlambang` (same as TracKar) |
| First version | `0.1.0` while building; **`1.0.0`** for the first APK given to a user |

*TangTu* is short for **tanggal tua** — Indonesian for the last days before payday, when the wallet is
thin. Playful and self-aware, aimed at a young (Gen Z) audience. Name availability on Google Play and as a
trademark has **not** been checked — the owner does that before the first public release.

**Languages:** the app speaks **English and Bahasa Indonesia** from the first version (§6.5). The name,
full name and tagline are Indonesian **brand lines** and stay Indonesian in both languages.

### 0.2 Where things are
- **This brief:** `E:\Development\` (the owner's main development folder).
- **TracKar (the source to copy from):** `E:\Development\TracKar` — **read-only for you.** Never edit,
  install packages in, run git in, or build TracKar. Only read and copy from it.
- **The new project:** `E:\Development\TangTu` (created in step 1).
- Useful TracKar reading before you start: `E:\Development\TracKar\docs\SPEC.md` §9 (design system) and
  §10 (data, backup), and the comments in every file you copy — they explain hard-won fixes.

### 0.3 Setup, step by step (do them in order; verify before moving on)

**Step 1 — Create the project.** Check the current Expo docs first (`https://docs.expo.dev/llms.txt`,
"create a project"); templates and flags change between SDKs.
```powershell
cd E:\Development
npx create-expo-app@latest TangTu
cd TangTu
```
The default template is Expo Router + TypeScript. If it has a `reset-project` script, run it and delete
the example folder it creates. **Routes must live in `src/app/`** (like TracKar); if the template put them
in `app/`, move them and confirm Expo Router still finds them. Delete example components/assets you won't use.

**Step 2 — Identity and config (`app.json`).** From §0.1: `name`, `slug`, `scheme`, `owner`,
`android.package`, `ios.bundleIdentifier` (same as the package), `version` `0.1.0`, `orientation`
`portrait`, `userInterfaceStyle` `automatic`, `experiments.typedRoutes: true`. Copy TracKar's
`android.blockedPermissions` (`SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`).
Plugins: `expo-router`, `expo-sqlite`, `expo-font`, `expo-sharing`, `expo-splash-screen` (background
`#FCF6F9`). **No `expo-notifications`** (TangTu sends no OS notifications). **App icon: later** — keep the
template's placeholder icon and splash image until the owner provides artwork (§6.4); don't design one.

**Step 3 — Install packages** (always through `npx expo install` so versions match the SDK):
```powershell
npx expo install expo-localization expo-sqlite expo-font @expo-google-fonts/nunito expo-haptics expo-file-system expo-sharing expo-document-picker expo-splash-screen expo-constants expo-status-bar expo-dev-client react-native-reanimated react-native-worklets react-native-gesture-handler react-native-keyboard-controller react-native-svg react-native-safe-area-context react-native-screens @expo/vector-icons zustand nativewind
npm install -D tailwindcss@^3.4.17
```
(NativeWind 4 needs Tailwind 3 — check NativeWind's install guide for the current pairing.) Skip any
package the template already has.

**Step 4 — Copy TracKar's building blocks.** Copy these from `E:\Development\TracKar` into the same
relative paths in `E:\Development\TangTu` (create folders as needed), e.g.
```powershell
$T = 'E:\Development\TracKar'; $K = 'E:\Development\TangTu'
foreach ($f in @('babel.config.js','metro.config.js','tailwind.config.js','global.css','eslint.config.js','nativewind-env.d.ts','eas.json')) { Copy-Item "$T\$f" "$K\$f" -Force }
New-Item -ItemType Directory -Force "$K\src\theme","$K\src\components","$K\src\hooks","$K\src\utils","$K\src\store","$K\src\services","$K\src\db","$K\src\dev" | Out-Null
Copy-Item "$T\src\theme\*" "$K\src\theme\"
# …then the component / hook / util / store / service files listed below, one by one.
```
| Copy as-is | Files |
|---|---|
| Components | `Touchable`, `AppText`, `Icon`, `Card`, `Button`, `TextField`, `CurrencyField`, `FormField`, `SegmentedControl`, `BottomSheet`, `PopoverMenu`, `SwipeActions`, `SwipeToDelete`, `ToastHost`, `MonthSwitcher`, `MonthPickerSheet`, `DatePickerSheet`, `CalendarGrid`, `DayStrip`, `ProgressRing`, `ProgressBar`, `SortableList`, `ThemeSwatch`, `ThemedSplash`, `AmountText`, `AmountsToggle`, `NotificationBell`, `DevToolsGear` (all in `src/components/`, `.tsx`) |
| Hooks | `src/hooks/useDbQuery.ts`, `useHideOnScroll.ts`, `useNow.ts`, `useAmounts.ts` |
| Utils / store | `src/utils/format.ts`, `haptics.ts`, `sanitizePrefs.ts`; `src/store/useAppStore.ts`, `useToastStore.ts`; `src/db/errors.ts` |

| Copy, then adapt (keep the structure, replace the TracKar domain) | What to change |
|---|---|
| `src/theme/themes.ts` | Drop the `JobType` import and the `taskCard` / `chip` maps; add the category **tints** (§7.1) per theme. Keep every other token value exactly. |
| `src/theme/ThemeProvider.tsx` | Nothing, unless the store's field names change. |
| `src/utils/format.ts` | Keep money (`formatRupiah`, `maskRupiah`, `formatThousands`, `parseDigits`) and date helpers (`localeDate`, `localeDateTime`, `formatAgo`, `formatBackupAge`, three-letter months). Replace the fixed 26th period with a **start-day parameter** (§3). Replace `localeDate`'s Intl call with **month/weekday tables per language** (§6.5). Delete shift/task helpers (`isShiftInProgress`, `isJobOverdue`, …). |
| `src/store/useAppStore.ts` | Keep the pattern (persist to `expo-sqlite/kv-store`, `partialize`, versioned `migrate`, `dataVersion`, in-memory `amountsVisible`). Preferences: `defaultTheme`, `language` (`system` \| `en` \| `id`), `periodStartDay`, `devToolsHidden`. Device markers: `notificationsSeenAt`, `lastAnnouncedVersion`, `lastRecapPeriod`, `lastBackupAt`. |
| `src/db/database.ts` | Keep the migration runner (`PRAGMA user_version`, append-only list) and `resetDatabase`; new migrations for §3's tables. |
| `src/services/backup.ts` | Keep validation, safety copy, undo restore and the share flow; table list → `Categories`, `Transactions` (+ `Budgets` later). |
| `src/components/EarningsTrend.tsx` | → `SpendTrend.tsx`: same rules, fed by "spent per period" (§9.2). |
| `src/app/_layout.tsx` | Use as the pattern for the root layout: `global.css` import, Nunito `useFonts`, `GestureHandlerRootView` → `KeyboardProvider` → `SQLiteProvider` (`onInit` = migrations, `useSuspense`) → `ThemeProvider`, `ToastHost`, `ThemedSplash`, the `__DEV__`-guarded `require` of `DevToolsGear`, `useHideAmountsInBackground`. Drop TracKar's notes prewarm, shift hooks and activity hooks. |
| `src/dev/mockData.ts` | Rewrite for transactions (§12), keeping its rules: dev-only, deterministic, replaces everything. |
| `AGENTS.md`, `docs/SPEC.md`, `CHANGELOG.md` | Write TangTu's own (step 7); use TracKar's as the template for structure and rules. |

**Do not copy:** notes editor (`dom/`, TipTap, `NoteEditorPrewarm`), shift reminders, auto-finish,
task/checklist code, `PinIcon`, `DoneStamp`, `RateSheet`, `RepeatSheet`, `TaskCard`, TracKar's assets.

After copying, run `npx tsc --noEmit` and fix imports until it's clean; remove anything that still
references jobs, shifts, notes or TracKar.

**Step 5 — EAS.** The owner logs in (`npx eas-cli@latest login`); then `npx eas-cli@latest init` to create
the project id. Keep TracKar's `eas.json` profiles (`development`, `preview` APK with `autoIncrement`,
`production`). Generate the lockfile with npm 10 (§2) and check it.

**Step 6 — Verify the skeleton.** `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor` all green; the app
starts and shows a themed empty Home with the splash greeting. Because `expo-dev-client` is installed,
`npx expo start` opens in dev-client mode; for Expo Go on the owner's iPhone use `npx expo start --go`.

**Step 7 — Project docs.** `docs/SPEC.md` (this brief, kept current), `AGENTS.md` (the rules: read the spec
first, non-goals, versioning, Touchable only, no push without asking, release checklist — modelled on
TracKar's), `CHANGELOG.md`.

**Step 8 — Git.** `create-expo-app` usually initialises git; make the first commit "Initialize TangTu".
The owner creates the remote repository (`https://github.com/DaveHerlambang/TangTu`). Branches, tags and
commit messages follow §10.3. **Never push without being asked.**

---

## 1. Product

**One sentence:** an offline, private, beautiful app to record where your money goes, in categories you
define yourself (each with its own icon and colour), with charts that make the month obvious at a glance.

**User:** anyone with a phone and a monthly budget — first the owner, possibly a public release later.
Not technical. Opens the app several times a day to log a purchase in seconds, and once in a while to
look at the month. (Unlike TracKar, nothing personal in the copy: no names, no pet names.)

**Principles**
1. **Logging takes under 5 seconds**: tap +, type amount, tap a category, done. Everything else optional.
2. **A category is recognisable without reading** — every category has an icon and a colour (§7).
3. **Charts answer one question each**, clearly: where did it go / is this month worse / which days.
4. **Calm, warm, playful-but-not-childish** (TracKar's tone). Nothing nags or shames.
5. **Offline and private.** No account, no server, no analytics, no ads. Data lives on the phone; the
   user backs it up to a file.
6. **Never lose data.** Append-only migrations, validated backups, undo for destructive actions.

**Non-goals (push back if asked):** accounts/login, cloud sync, bank or e-wallet integrations, multi-user
or sharing, social features, investments/stocks/crypto, ads, analytics/telemetry, remote push
notifications, web build, tablet layouts. A request that turns this into a bank app or a social app should
be challenged before it is built.

---

## 2. Platform & stack (identical to TracKar)

- **Target:** Android (real use). iOS only through Expo Go during development.
- **Expo** managed workflow with Continuous Native Generation (never hand-edit `android/`/`ios/`),
  **Expo Router** with typed routes, **TypeScript strict**, React 19, New Architecture.
  - TracKar is on **Expo SDK 57**. Use the newest stable SDK at project start and **read the versioned
    docs** (`https://docs.expo.dev/versions/v<major>.0.0/`); never code Expo APIs from memory.
  - Always add packages with `npx expo install <pkg>`; run `npx expo install --fix` before every release.
- **Data:** `expo-sqlite` (single source of truth). **Zustand** for UI preferences only, persisted to
  `expo-sqlite/kv-store`.
- **UI:** `react-native-reanimated` 4 (`.get()`/`.set()` on shared values) + `react-native-worklets`,
  `react-native-gesture-handler`, `react-native-keyboard-controller` (all keyboard handling),
  `react-native-svg`, `@expo/vector-icons` (**Ionicons only**), `@expo-google-fonts/nunito`, `expo-haptics`,
  NativeWind + themed `StyleSheet`.
- **Backup:** `expo-file-system`, `expo-sharing`, `expo-document-picker`.
- **Optional, only if a feature needs it:** `expo-local-authentication` (app lock).
- **Build:** EAS — `development` (dev client), `preview` (APK, `autoIncrement` versionCode; the one installed
  on phones), `production` (AAB); `appVersionSource: "remote"`.
  - EAS installs with **npm 10**: generate the lockfile with `npx --yes npm@10.9.8 install --package-lock-only`
    and check with `npx --yes npm@10.9.8 ci --dry-run --include=dev` (an npm 11 lockfile breaks EAS `npm ci`).
    `expo install --fix` writes with npm 11, so re-sync after it.
- **Own identity** (§0.1): its own package name and signing key; it must never replace TracKar on a phone.
  Download a copy of the keystore (`npx eas-cli credentials`).

---

## 3. Domain model

All money is **integer rupiah** (no floats, no cents). All timestamps are **ISO-8601 UTC strings** (lexical
order = chronological); "today", periods and display use **device local time**.

### Tables (SQLite, schema version = `PRAGMA user_version`, migrations append-only)
| Table | Columns (essentials) | Notes |
|---|---|---|
| `Categories` | `id`, `name` (NULL for an untouched template category), `template_key` (categories made from a §7.3 template, e.g. `food`; NULL otherwise), `kind` (`EXPENSE` \| `INCOME`), `icon` (Ionicons name from §7.2), `tint` (key from §7.1), `position`, `archived_at` (NULL = active), `created_at` | User-defined. Active names unique per kind. |
| `Transactions` | `id`, `kind` (`EXPENSE` \| `INCOME`), `amount` (INTEGER > 0), `category_id` → Categories, `note`, `occurred_at`, `created_at`, `updated_at` | Sign comes from `kind`, never a negative amount. |
| `Budgets` *(phase 7)* | `id`, `category_id`, `amount`, `from_period` | Applies from that period onward (like TracKar's salary history). |
| `Activity` | `id`, `kind`, `params` (JSON), `ref_type`, `ref_id`, `dedupe_key`, `created_at` — in-app message history (§8.7) | Stores *what happened*, not sentences: text is rendered in the current language. Not backed up; cleared on restore. |

**Rules**
- **A used category is never hard-deleted.** "Delete" on a category with transactions = **archive** (gone
  from pickers, still itself in history and charts, can be restored). An unused one may be deleted
  (confirm + Undo).
- **Changing a category's icon or tint changes it everywhere, including history** (it's identity, not a
  per-transaction snapshot).
- **Totals for a period:** spent = Σ EXPENSE; income = Σ INCOME; **left = income − spent**. One function
  computes these and every screen uses it (Home, charts and category screens must never disagree).
- Money format: `Rp 1.250.000` (dot thousands, TracKar's hand-rolled formatter), negatives `-Rp 15.000`.

### Periods
- A **period** is a month that starts on a **user-chosen start day** (default **1**; many people use
  payday, e.g. the 25th). Start day 25 → "October" = 25 Sep – 24 Oct. Key = the month it **ends** in
  (`"2026-10"`, TracKar's convention). Start days 29–31 clamp to the month's last day.
- Changing the start day re-buckets history (a view setting, nothing stored per period); the setting says so.
- UI says **"month" / "bulan"** when the start day is 1, **"period" / "periode"** otherwise.
- Test period maths for start days 1, 25 and 31, including Dec → Jan and February.

---

## 4. Screens & navigation (Expo Router; routes in `src/app/` only)

Two tabs, like TracKar (Dashboard + Notes): **Home** and **Charts**. Bell and Settings buttons top-right
on Home (TracKar's dashboard header).

| Route | Screen |
|---|---|
| `(tabs)/index` | **Home**: `‹ October ›` period switcher, summary card, budgets row (phase 7), transactions grouped by day, FAB `+` |
| `(tabs)/charts` | **Charts**: §9's three charts for the chosen period |
| `transaction/new`, `transaction/[id]` | Add / edit (below) |
| `categories` | Manage: Expense / Income segmented, drag to reorder, add, edit (name, icon, tint), archive/restore |
| `category/[id]` | One category: total for the period, its trend, its transactions |
| `day/[date]` | One day's transactions (opened from the daily chart) |
| `search` | Search (§5): note or category name, category chips; results from all time |
| `notifications` | The bell's history (§8.7) |
| `settings` | Theme, language (§6.5), period start day, categories, backup / restore / undo restore, last backup, What's new |
| `whats-new` | User-facing release notes (TracKar's page and version picker) |

### Home
- **Summary card** (TracKar's dashboard card): caption "Spent this month" + eye pill + "Details" pill →
  **display** number in the money colour → caption "Rp X income · Rp Y left" → a row of 3 tappable stats:
  **Top category** (icon badge + name), **Daily average**, **Transactions**. Amounts start hidden (§8.6).
- **List:** newest first, grouped by day ("Today", "Yesterday", "Mon, 6 Oct") with the day total on the
  header's right. Row = category badge (§7) · category name (or the note as the headline with the category
  below — TracKar's "subject first" rule) · time · amount (expense in `text`, income in `success` with `+`).
- Empty state: a soft card "No spending yet this month" + "Add the first one".

### Add transaction (the critical path)
Top to bottom, in the order you think it (layout since 0.2.0, owner-approved):
1. `Expense | Income` segmented control (default Expense) — first, because it sets the amount's colour and
   which categories show.
2. **Amount**, big and **centred** (like a payment screen), `Rp` and live dot grouping, an underline, and a
   muted hint "Tap to enter the amount" / "Tap to change". **The number pad is closed when the screen opens**
   (new and edit alike — owner, 0.2.0: see the whole screen first, open the pad yourself). Tapping the amount
   slides the in-app pad up above Save (blinking caret; steady with reduced motion); it has **000** and
   **⌫** keys, **quick amount** chips (10.000 · 20.000 · 50.000 · 100.000 — number only, one size) and **⌄** to hide it. The pad also
   steps aside when a category is picked, the day chip or the note is touched, or Back is pressed.
3. **Category grid**: 4 per row, icon badge + name, **most-used in the last 60 days first**, last tile
   "+ New" (opens the category editor inline — pick a §7.3 template or start blank — then selects the new
   category). The app starts with **no categories** (§7.3), so the very first purchase goes amount → "+ New" →
   tap a template → Save; after that the 5-second path applies.
4. Optional, on one line: a **day chip** ("Today ▾" → sheet with Today · Yesterday · Pick a date…) and the
   **note** field ("Add a note (optional)"). The note scrolls clear of the keyboard and the Save bar.
5. **Save** (primary pill, pinned at the bottom) → closes, success haptic, toast "Rp 25.000 · Food & Drinks"
   with **Undo**. **Save is always enabled and always says "Save"** (owner, 0.2.0: no disabled button). Pressed
   with something missing, it takes you there, calmly (primary-text colour, never red, §5): no amount → the
   pad opens, the amount shakes and "Enter the amount first" replaces its hint; no category → the pad closes,
   the grid scrolls into view and shakes, and "Pick one to save" shows under its label. Warning haptic; the
   line is announced to screen readers; no shake with reduced motion. The line goes once that part is filled.

---

## 5. Behaviour rules (TracKar's)

- **Acts immediately, offers Undo:** saving, editing, archiving.
- **Deleting asks first, then still offers Undo** ("Delete this transaction?" → toast with Undo).
- **Restoring a backup confirms** (replaces everything) and keeps a safety copy (§11).
- **No nagging:** no budget-exceeded notifications, no streaks, no red shaming. Over budget is shown
  calmly ("Rp 50.000 over", in `text`, not `danger`).
- **Swipe left** on a row → **Again** (log the same amount and category now) · **Edit** · **Delete**;
  **long-press** → a small sheet with the same actions (TracKar's notes pattern).
- **Search** (phase 6): by note or category name, with category filter chips.

---

## 6. Design system — TracKar's "Playful Productivity" (copy, don't redesign)

Soft-UI, card-based, generous radius, soft diffused **tinted** shadows, friendly rounded **Nunito**. Cute
but not childish; calm, not corporate. **UI in English and Bahasa Indonesia (§6.5). No emoji in the UI.**

### 6.1 Themes (three, chosen in Settings only)
| Token | Cherry Blossom `sakura` (default) | Light `light` | Dark `dark` |
|---|---|---|---|
| `background` | `#FCF6F9` | `#F6F7F9` | `#1A1B26` |
| `surface` | `#FFFFFF` | `#FFFFFF` | `#24283B` |
| `text` | `#4A3540` | `#1D2027` | `#C0CAF5` |
| `textMuted` | `#7A6570` | `#666B78` | `#9AA0C4` |
| `border` (decorative only) | `#F6E3EB` | `#E9EBF0` | `#2F3450` |
| `accent` (money colour) | `#9C5562` | `#167A4F` | `#7DCFFF` |
| `accentAlt` | `#E88FAE` | `#4C7DF0` | `#BB9AF7` |
| `primary` (fills: buttons, FAB, selected chips, rings) | `#E88FAE` | `#2F62D6` | `#BB9AF7` |
| `onPrimary` | `#3E1A2C` | `#FFFFFF` | `#1A1B26` |
| `primaryText` (brand-coloured text/icons) | `#A94273` | `#2F62D6` | `#BB9AF7` |
| `outline` (outlines of pressable controls) | `#B87894` | `#8E94A3` | `#6D7399` |
| `toastAction` | `#F6B8CD` | `#8FB0FF` | `#1A1B26` |
| `success` (income) | `#357A4B` | `#167A4F` | `#9ECE6A` |
| `danger` (destructive only) | `#C33F55` | `#C8343A` | `#F7768E` |
| `track` | `#F8E6EE` | `#F0F1F4` | `#2F3450` |
| `shadow` | `rgba(232,143,174,0.28)` | `rgba(17,24,39,0.08)` | `rgba(0,0,0,0.35)` |
| card `shadow` | `0px 6px 18px rgba(232,143,174,0.18)` | `0px 4px 14px rgba(17,24,39,0.06)` | `0px 6px 18px rgba(0,0,0,0.3)` |

- These are TracKar's values — copying `themes.ts` (§0 step 4) brings them in; this table is the check.
- **Contrast (WCAG AA), checked by a test:** meaningful text/icons ≥ 4.5:1 on `surface`, `background` and
  `track`; `onPrimary` on `primary`; outlines of pressable controls ≥ 3:1. `primary` is a fill; brand-coloured
  text uses `primaryText`. Dark is navy, never pure black.

### 6.2 Typography (`AppText` is the only text component)
| Variant | Family | Size / line |
|---|---|---|
| `display` | Nunito ExtraBold | 26 / 32 |
| `title` | Nunito ExtraBold | 19 / 24 |
| `heading` | Nunito Bold | 15 / 20 |
| `body` | Nunito SemiBold | 14 / 19 |
| `label` | Nunito Bold | 13 / 17 |
| `caption` | Nunito SemiBold | 12 / 16 |

Each weight is its own `fontFamily` (Android ignores `fontWeight` for custom fonts). Follows the phone's
font size up to **1.3×**; text boxes use `minHeight`, never `height`; big numbers use
`adjustsFontSizeToFit` + `numberOfLines={1}`. Three-letter months everywhere, from the month tables of §6.5 (never Android's "Sept").

### 6.3 Shape, spacing, components, motion
- `radius = { sm: 10, md: 14, lg: 20, pill: 999 }`; `spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }`.
- Card = `surface`, radius `lg`, padding 14, theme shadow. Touch targets ≥ 44 pt (`hitSlop`).
- Components behave exactly as in TracKar: Button pill 48/36; SegmentedControl (track + raised thumb);
  BottomSheet (260 ms ease-out, shared-value transform, inputs focus `onOpened`); ToastHost (top, inverse
  colours, 5 s, one at a time, optional action); SwipeActions (84 pt buttons); FAB 56 pt that **hides on
  scroll down** and returns on scroll up; MonthSwitcher `‹ October 2026 ›`; ThemedSplash (spring in, hold
  1.1 s, fade 320 ms).
- Haptics: **tick** for small changes (category pick, number-pad keys, eye), **success** on save.
- 200–260 ms, ease-out / in-out cubic; respect reduce-motion; **never animate a value swap by remounting**
  (`key` + `entering` flickers on Android) — keep both states mounted and cross-fade (TracKar's `AmountText`).

### 6.4 Brand
- **App icon: later.** The owner will provide artwork; until then keep the template placeholder. When it
  comes: TracKar's family (glossy 3D clay object with a small cat face on a soft pink background) but a
  different object, generated into adaptive foreground + monochrome like TracKar.
- **Splash (TracKar's `ThemedSplash`, re-worded):** the wordmark **TangTu** (display size, `primaryText`),
  under it **Tanggal Tua** (caption, `textMuted`, letter-spaced), then the tagline **"Selamat datang di
  tanggal tua"** (body). Same motion as TracKar: the wordmark springs in, the two lines follow, hold
  1.1 s, fade 320 ms. These three lines are fixed brand copy (see §0.1).

### 6.5 Languages — English | Bahasa Indonesia

**Behaviour**
- Settings → **Language**: **System default** (default) · English · Bahasa Indonesia. "System default" picks
  Indonesian when the phone's first language is Indonesian, English otherwise. Switching applies at once,
  no restart, and the choice travels in backups (`language` preference, validated by `sanitizePrefs`).
- **Brand lines never change:** TangTu, Tanggal Tua, "Selamat datang di tanggal tua".
- **Tone:** Indonesian is casual and warm — **"kamu"**, never "Anda" — with a light Gen Z touch that never
  hides the meaning ("Catat", "Sisa", "Hari ini kamu belum jajan"). English is friendly and plain. Same
  meaning in both; neither is a word-for-word copy of the other.
- **Everything the user reads is translated**, including screen-reader labels, toasts, dialogs, empty
  states and What's new. **Text the user typed** (notes, renamed categories) is never translated.

**Glossary (use these words consistently)**
| English | Bahasa Indonesia |
|---|---|
| Spent | Keluar |
| Income | Masuk |
| Left | Sisa |
| Transaction | Transaksi |
| Category | Kategori |
| Month / Period | Bulan / Periode |
| Today / Yesterday | Hari ini / Kemarin |
| Add / Save / Edit | Tambah / Simpan / Ubah |
| Delete / Archive / Restore | Hapus / Arsipkan / Pulihkan |
| Undo / Again | Batalkan / Lagi |
| Backup / Restore backup | Backup / Pulihkan backup |
| Settings / Theme / Language | Pengaturan / Tema / Bahasa |
| Recap / Details | Rekap / Detail |
| What's new | Yang baru |

**Dates and numbers** (own tables, not `Intl` — same output on every phone)
- Months EN `Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec`; ID `Jan Feb Mar Apr Mei Jun Jul Agu Sep Okt Nov Des`
  (plus full names for headers: "October 2026" / "Oktober 2026").
- Weekdays EN `Mon Tue Wed Thu Fri Sat Sun`; ID `Sen Sel Rab Kam Jum Sab Min`. Day headers "Mon, 6 Oct" /
  "Sen, 6 Okt". Time 24-hour in both.
- **Money is the same in both:** `Rp 1.250.000`.
- Plurals: English only ("1 transaction" / "3 transactions"); Indonesian has none ("3 transaksi").

**Words stored as data**
- **Template categories** (made from a §7.3 template and not renamed) keep `name = NULL` and a
  `template_key`; their name is shown from the dictionary, so they follow the language. Renaming one stores
  the user's text in `name`, which is then shown as typed (owner, 2026-11-18).
- **Bell messages** store `kind` + `params` and are rendered when shown (TracKar stored plain sentences;
  that would freeze them in one language).
- **What's new** entries carry both texts: `{ version, date, en: {...}, id: {...} }`.

**Implementation**
- `expo-localization` for the phone's language (check its API in the current docs).
- Own typed dictionaries, no i18n library needed for two offline languages: `src/i18n/en.ts` is the source
  of truth; `src/i18n/id.ts` is typed `satisfies Messages`, so **a missing Indonesian key is a type error**.
  `useT()` returns `t(key, params)` with `{name}` interpolation; `plural(n, one, other)` for English.
- **No user-visible string literals in components** — everything goes through `t()` (enforced by a test).
- **Indonesian is often 20–30% longer.** Every screen is checked in Indonesian at 1.3× font: nothing clipped,
  pills and buttons grow (`minHeight`), no fixed widths around text.

---

## 7. Categories: icons and tints

Every category = **icon badge** (Ionicons outline glyph in the tint's *ink*, on the tint's *fill*, 38 pt
rounded square radius 12 — TracKar's task-card badge) + name. Identity never relies on colour alone.

### 7.1 Tints (8, contrast-checked: ink ≥ 4.5:1 on its fill **and** on `surface`/`background`)
| Key | Light & Cherry Blossom — fill / ink | Dark — fill / ink |
|---|---|---|
| `rose` | `#FDE2EC` / `#B23A68` | `#4A2B3B` / `#F7A1C0` |
| `peach` | `#FFE5D4` / `#A94F17` | `#4A3326` / `#FFB38A` |
| `amber` | `#FFF0C2` / `#7D5800` | `#463C22` / `#F2CC6B` |
| `mint` | `#DCF2E3` / `#2B7448` | `#273F33` / `#8FD6A8` |
| `teal` | `#D3F0EF` / `#1D6E6E` | `#213E43` / `#7FD6D6` |
| `sky` | `#DDE9FF` / `#2F5FCF` | `#26365A` / `#9DB8FF` |
| `lavender` | `#EBE3FB` / `#6447BD` | `#352E55` / `#C3A6FA` |
| `slate` | `#E7E9EF` / `#545C6C` | `#313548` / `#B9BFD4` |

Measured: light inks 4.56–5.66:1 on their fill, 5.50–6.72:1 on white; dark inks 6.07–7.06:1 on their
fill, 7.04–9.45:1 on `#24283B`. **Tints are for badges, not chart colours:** as a chart palette they fail
colour-blind separation (amber↔peach, mint↔teal), so charts use one hue (§9).

### 7.2 Icon catalog (names verified in Ionicons; use the `-outline` variant)
| Group | Icons |
|---|---|
| Food & drink | `fast-food` `restaurant` `cafe` `pizza` `ice-cream` `beer` `wine` `nutrition` |
| Shopping | `cart` `basket` `bag-handle` `shirt` `pricetag` `storefront` `diamond` `gift` |
| Transport | `car` `car-sport` `bus` `train` `subway` `bicycle` `airplane` `boat` `speedometer` |
| Home & bills | `home` `flash` `water` `wifi` `phone-portrait` `tv` `receipt` `key` `bed` `construct` `hammer` |
| Health & care | `medkit` `medical` `bandage` `fitness` `barbell` `heart` `cut` `sparkles` `glasses` |
| Fun & hobbies | `game-controller` `film` `musical-notes` `ticket` `camera` `color-palette` `brush` `football` `basketball` `golf` `balloon` |
| Learning & work | `school` `book` `library` `newspaper` `laptop` `desktop` `briefcase` `business` |
| People & pets | `people` `person` `happy` `paw` `flower` `rose` `leaf` |
| Money & services | `card` `cash` `wallet` `trending-up` `shield-checkmark` `umbrella` `repeat` `cloud` `globe` `ribbon` `trophy` `rocket` |
| Other | `ellipsis-horizontal-circle` |

Not available in Ionicons (don't use): `piggy-bank`, `baby`; brand `logo-*` icons have no outline variant.
Re-check names against the installed `@expo/vector-icons` glyph map if the SDK changes.

### 7.3 Category templates (owner, 2026-11-18)
**Nothing is created automatically**: the app starts with no categories. These are **templates** offered
when the user creates a category — tapping one fills in its name, icon and tint, and the user can change any
of them before saving (icon from §7.2, tint from the 8 presets of §7.1). A category made from a template keeps
following the app language until it is renamed (§6.5). A template whose name an active category of the same
kind already shows is marked "Already added" and can't be picked again (active names are unique, §3).

| Kind | `template_key` | English | Bahasa Indonesia | Icon | Tint |
|---|---|---|---|---|---|
| Expense | `food` | Food & Drinks | Makan & Minum | `fast-food` | `peach` |
| Expense | `groceries` | Groceries | Belanja Dapur | `basket` | `mint` |
| Expense | `transport` | Transport | Transportasi | `car` | `sky` |
| Expense | `bills` | Bills | Tagihan | `receipt` | `slate` |
| Expense | `shopping` | Shopping | Belanja | `bag-handle` | `rose` |
| Expense | `health` | Health | Kesehatan | `medkit` | `teal` |
| Expense | `fun` | Fun | Hiburan | `game-controller` | `lavender` |
| Expense | `gifts` | Gifts | Hadiah | `gift` | `amber` |
| Expense | `other_expense` | Other | Lainnya | `ellipsis-horizontal-circle` | `slate` |
| Income | `salary` | Salary | Gaji | `cash` | `mint` |
| Income | `side_income` | Side income | Penghasilan sampingan | `briefcase` | `sky` |
| Income | `gift_income` | Gift | Hadiah | `gift` | `rose` |
| Income | `other_income` | Other | Lainnya | `ellipsis-horizontal-circle` | `slate` |

### 7.4 Category editor
Starts with the **template row** (§7.3, for the chosen kind) plus "Blank". Then: name field → **icon picker**
(sheet with the §7.2 groups as sections, 6 per row, search by name) → **tint row** (the 8 preset tints of
§7.1 as round swatches, selected ring; no free colour picker, so every badge stays readable in all three
themes) → live preview of the badge. A blank category gets the next tint in order so neighbours differ;
a template brings its own tint. Editing an existing category uses the same editor without the template row.

---

## 8. Interaction patterns (TracKar's, reuse them)

1. **Undo toast** after every immediate action.
2. **Confirm, then Undo** for deletes.
3. **Swipe left** → actions; **long-press** → same actions in a sheet.
4. **FAB hides on scroll.**
5. **Period switcher** wherever numbers appear; Home and Charts share the chosen period.
6. **Hidden amounts (the eye)** — TracKar's `AmountText`/`AmountsToggle`: Home summary shows
   `Rp •.•••.•••` (one dot per digit) until the eye pill is tapped; memory only, hidden again on app start,
   on leaving the screen and in the background; both layers mounted and cross-faded (240 ms, 4 pt drift);
   screen readers hear "hidden". Lists and charts are not hidden (they need a tap to reach).
7. **The bell (in-app history, no OS notifications):** "September recap" at the start of a period (spent,
   income, left, top 3 categories), "Backup restored", "What's new in x.y.z". Red dot until the bell is opened.
   Rows store `kind` + `params` and are written out in the current language when shown (§6.5).
8. **Pull to refresh** on lists.

---

## 9. Charts (the reason the app exists)

General (TracKar's trend-chart rules): zero baseline; thin bars with 4 pt rounded ends; recessive grid
(`border`); **no number on every mark** — one line above the chart states the answer; **tap a mark** to
select it and update that line; the selected mark is highlighted by colour **and** bold label; every mark
is a button with a full spoken label (the screen-reader table view); never a dual axis, never a rainbow.
**Single hue:** bars use `accent` (selected) and `outline` (others), so the charts need no categorical palette.

1. **Where did it go — ranked category bars (primary).** One row per expense category, largest first:
   **icon badge · name · bar (`accent`) · amount · % of spent**. Top 7 + **"Other"** (the rest folded, tap
   to expand). Tap a row → `category/[id]`. Above: "Food & Drinks is 34% of this month".
2. **Is this month worse — trend.** "Spent, last 6 periods" — TracKar's `EarningsTrend` reused as
   `SpendTrend`: chosen period `accent`, others `outline`; line above "Rp 240.000 more than Sep" / "less
   than" / current period "So far · Sep ended at Rp …". Starts at the first period with data; with fewer
   than 2 periods, show a one-line hint instead of hiding silently. Tap a bar → switch period.
3. **Which days — daily spend.** A bar per day of the period (today outlined), a thin dashed average line
   labelled "avg Rp 85.000". Tap a day → `day/[date]`.

Later (owner decides): income vs spent per period (two series → legend + direct labels + a validated palette).

---

## 10. Versioning, What's new & release process (TracKar's rules, made strict)

These rules are **binding**. Every change that reaches `master` is a release with a version that follows them.

### 10.1 Three numbers — do not confuse them

| Number | Where | Rule |
|---|---|---|
| **Version** `MAJOR.MINOR.PATCH` | `app.json` `expo.version`, `package.json` `version`, both `version` fields at the top of `package-lock.json` — **all must match** | Semantic, §10.2. Shown to the user (About, What's new). |
| **versionCode** (Android build number) | EAS remote counter (`appVersionSource: "remote"`, `autoIncrement`) | Automatic. **Never edit by hand.** |
| **Schema version** | `PRAGMA user_version` (SQLite), backup `schemaVersion` | Goes up only with a new migration. Separate from the app version. |

### 10.2 What each part means for TangTu ([Semantic Versioning 2.0.0](https://semver.org))

- **PATCH** (`x.y.Z`) — bug fixes, wording and translation fixes, visual polish, performance,
  dependency/SDK patch bumps. **No new capability, and no number on screen changes meaning.**
- **MINOR** (`x.Y.0`) — a new capability (screen, setting, chart, category template, bell
  message, icon/branding change), **or** a change to what an existing number or behaviour means (e.g. how a
  period or a total is counted), **or** a removed feature. Saved data and older backups stay readable.
- **MAJOR** (`X.0.0`) — older backups or stored data can no longer be restored/read as they were, or the
  app's purpose or platform changes. Data safety (§11) means this should almost never happen.
- Resetting: a MINOR bump sets PATCH to 0 (`0.3.4 → 0.4.0`); a MAJOR bump sets both to 0 (`1.7.2 → 2.0.0`).
- One release = one version. Several changes ship together under **the highest bump among them** (a fix
  plus a feature → MINOR). A version that has been merged to `master` is never reused or changed.

**`0.x` — before the first user.** `0.y.z` versions are for the owner's own phone. The same PATCH/MINOR
rules apply; MAJOR stays `0`, so a change that would be MAJOR becomes MINOR (and must still keep old
backups restorable, §11). **`1.0.0`** is the first APK given to anyone else, after the §15 checklist.
From then on MAJOR applies normally.

**Claude must push back.** If the owner proposes a number that doesn't fit the content — a feature under
a PATCH, a MAJOR for polish, `1.0.0` before the §15 checklist — say so, give the right number and a
one-line reason, then follow the owner's decision if they insist. Also point out when a release is split
wrongly (a feature hidden inside a patch).

### 10.3 Git: branches, tags, commit messages

*Origin: the owner asked for a branch per version merged into `master`, and English commit messages in the
style of the release notes; the details below (fast-forward, tags, message layout) were written by Claude
for 0.1.0, modelled on TracKar. The owner later ruled out attribution lines.*

- **Remote:** `origin` = `https://github.com/DaveHerlambang/TangTu`. **`master`** holds released versions
  only; every commit on it belongs to a finished version.
- **One branch per version:** `release/x.y.z` (e.g. `release/0.2.0`), created from `master` when work on
  that version starts. All work for the version happens there. Release branches are kept after merging.
- **Merge:** fast-forward `release/x.y.z` into `master` (`git merge --ff-only`), so `master` stays linear.
- **Tag:** each merged version gets an annotated tag **`vX.Y.Z`** on `master`
  (`git tag -a v0.2.0 -m "TangTu 0.2.0"`). The tag is how a version is found later.
- **Commit messages are in English.**
  - The **release commit** (the last commit on the branch, the one tagged): title `TangTu x.y.z`, a blank
    line, the release's one-sentence summary (the English `summary` from `releaseNotes.ts`), then the
    sections that apply — `NEW`, `CHANGED`, `FIXED`, `REMOVED`, `UNDER THE HOOD` — as `- ` bullets
    written for the owner (what changed for the user, not which files), same headings as `CHANGELOG.md`.
    Only this release's changes. **No `Co-Authored-By` or other attribution lines** (owner, 2026-11-22):
    the message ends with the last bullet.
  - Any **earlier commits on the branch**: one short imperative line (`Add budget per category`), body optional.
- **Never push without the owner asking.** Propose the commit message first.

### 10.4 What's new

Every release adds a user-facing entry to `src/constants/releaseNotes.ts` (New / Improved / Fixed, plain
words, no technical details) **in English and Indonesian**, shown on the What's new page in the app's
language and announced in the bell. `CHANGELOG.md` is the developer-facing record, with the heading
`## x.y.z — YYYY-MM-DD` (the release date, same as in `releaseNotes.ts`).

### 10.5 Release checklist (in this order)

1. `git switch -c release/x.y.z master`.
2. Build it; update **`docs/SPEC.md`** (whatever changed + a §16 log line), **`CHANGELOG.md`** and
   **`src/constants/releaseNotes.ts`**.
3. Pick the version by §10.2 and bump `app.json`, `package.json`, then re-sync the lockfile:
   `npx --yes npm@10.9.8 install --package-lock-only`.
4. All green: `npm run typecheck`, `npm test`, `npx expo lint`, `npx expo-doctor`,
   `npx --yes npm@10.9.8 ci --dry-run --include=dev`, `npx expo export --platform android`; the exported
   bundle contains no dev tools (no mock data, no dev gear).
5. Propose the release commit message (§10.3). The owner decides.
6. On the owner's go-ahead: commit, `git push -u origin release/x.y.z`, `git switch master`,
   `git merge --ff-only release/x.y.z`, `git tag -a vX.Y.Z -m "TangTu x.y.z"`,
   `git push origin master vX.Y.Z`.
7. APK only when asked: `npx eas-cli@latest build -p android --profile preview`; report the link.

---

## 11. Data safety & backup (TracKar's design, proven)

- **Append-only migrations** (`PRAGMA user_version`); every schema/preference change keeps old backups restorable.
- **Backup = JSON** (`format: 1`): all tables + preferences, through the share sheet (Drive, Files…).
  Android can't tell "saved" from "cancelled", so afterwards ask **"Did you save the backup?"**; only
  "Yes, saved" updates **"Last backup: 12 days ago"** in Settings (passive text, no reminders).
- **Restore** treats files as untrusted: reject non-app files, newer schemas, damaged tables and empty
  backups; apply only known, valid preferences; map columns by name.
- **Safety copy + Undo restore** for 7 days (`pre-restore-backup.json` in the document directory, verified
  before anything is replaced; refuse the restore if it can't be written).
- Device markers (last backup, bell seen, last recap) never travel in backups.

---

## 12. Engineering rules

- Routes only in `src/app/`; `@/` → `src/`; all SQL in `src/db/*Repository.ts`; screens read through
  `useDbQuery` (re-runs on focus and on a `dataVersion` bump after writes).
- Strict TypeScript; never import `Pressable` (use `Touchable`); keyboard via `react-native-keyboard-controller`.
- **Every user-visible string goes through `t()`** (§6.5); a test fails on string literals rendered in components.
- **Dev tools only behind `__DEV__`** (guarded `require`): gear with "Nuke database" and
  **"Mock data · 6 months / 1 year"** (deterministic, replaces everything; realistic spending per category,
  a few big months and quiet months, salary on the start day). Verify release bundles don't contain them.
- **Tests kept in the repo** (`scripts/` or `__tests__/`), run against real SQLite (`node:sqlite` + Node
  type stripping): totals, period bucketing (start days 1/25/31), archive rules, most-used ordering,
  backup validation, migrations from every older schema, contrast of every theme token and tint, month/weekday
  tables in both languages, template categories following the language until renamed.
- Done = `tsc --noEmit`, `expo lint`, `expo-doctor`, `expo export` green.
- Commit/push only when the owner asks; propose a patch-notes style commit message first.

---

## 13. Build order (each phase ends with something usable)

1. **Setup & design system:** §0 steps 1–8; three themes, splash, **i18n (EN | ID) from the first screen**
   (retrofitting later is expensive), Settings → Theme and Language, contrast test.
2. **Categories:** tables, templates (§7.3), badge component, manage screen with editor, icon picker and tints.
3. **Core loop:** add/edit/delete with number pad, quick amounts, most-used grid, Undo; Home with period
   switcher, summary card and day-grouped list; FAB hide-on-scroll; swipe actions incl. **Again**.
4. **Charts:** ranked bars, trend (hint when < 2 periods), daily; category and day screens.
5. **Safety:** backup/restore, safety copy + undo restore, last backup; mock-data dev tool.
6. **Polish:** eye, search + filters, period start day, bell + period recap, What's new, release APK.
7. *(Owner decides)* app icon, budgets per category (calm ring like TracKar's content goal), recurring
   transactions, wallets (Cash / Bank / E-wallet) with transfers, app lock.

---

## 14. Decisions for the owner (ask before building the affected part)

Answered 2026-11-18:
1. **Currency: rupiah only** (owner, 2026-11-22, replacing the 2026-11-18 decision of five selectable currencies):
   - Transactions in another currency weren't in the totals, and no offline app can convert them correctly
     (rates change daily), so the gap could only grow. **0.2.0 removed** the currency choice on the
     add/edit screen and the default currency in Settings; every new transaction is **IDR**, and every total,
     chart and recap counts IDR.
   - Data stays safe: the `currency` column stays; `money.ts` still formats the old five currencies, so a
     transaction logged in 0.1.x in another currency still shows in its own format, is listed as "not in
     totals", keeps its currency when edited, and 0.1.x backups restore (their `defaultCurrency` preference
     is ignored).
   - Later, if wanted: "paid in a foreign currency" with the rupiah amount actually charged typed in (rate
     fixed at that moment) — not scheduled.
2. **Default period start day: 1** (calendar months; the UI says "month" / "bulan").
3. **Wallets: later** (phase 7).
4. **Income tracked in v1** (Expense | Income; left = income − spent).
6. **In-app number pad** for the amount (§4); since 0.2.0 it opens only when the amount is tapped.

5. **Categories: the §7.3 list as written, but as templates, not created automatically.** Colour is one of
   the 8 preset tints (changeable), icon changeable; template names follow the language until renamed.
8. **Contrast: keep TracKar's exact values.** §6.1 checks meaningful text on `surface`, `background` **and**
   `track`; TracKar only checks `surface`, and four TracKar values miss the stricter rule. The owner chose to
   keep them; the contrast test lists them as accepted exceptions (pinned, so any further drop still fails).
   For reference, the one-step-darker values that would pass:

   | Theme · pair | Now | Would pass | Then |
   |---|---|---|---|
   | Cherry Blossom `textMuted` on `track` | `#7A6570` 4.47:1 | `#79646F` | 4.54:1 |
   | Cherry Blossom `success` on `track` | `#357A4B` 4.35:1 | `#347749` | 4.52:1 |
   | Cherry Blossom `danger` on `track` | `#C33F55` 4.21:1 | `#BB3C52` | 4.52:1 |
   | Light `outline` on `background` | `#8E94A3` 2.83:1 | `#898F9D` | 3.02:1 |

Still open:
7. *(Later)* app icon artwork; final name check before any public release.

---

## 15. Acceptance checklist for v1.0.0

- [ ] A purchase is logged in ≤ 5 seconds from Home.
- [ ] Every category is recognisable by its badge; all 8 tints pass contrast in all three themes.
- [ ] Spent / income / left agree on Home, Charts and category screens for any period and start day.
- [ ] Archived categories leave the pickers but stay correct in history and charts.
- [ ] Large font (1.3×) clips nothing — checked in **both languages**; the eye hides and re-hides as specified.
- [ ] Every screen, dialog, toast and screen-reader label exists in English and Indonesian; switching
  language applies at once; untouched template categories and bell messages follow it.
- [ ] Every destructive action confirms and/or offers Undo; backup → uninstall → restore brings everything back.
- [ ] Release APK has no dev tools and no TracKar leftovers; `tsc`, lint, `expo-doctor`, export are green.

---

## 16. Decisions & build log

**2026-11-18 — phase 1 (setup & design system)**
- Created with `create-expo-app` on **Expo SDK 58** (newest stable; TracKar is on 57): React Native 0.88,
  React 19.3, Reanimated 4.7, **gesture-handler 3.3** (TracKar: 2.32 — the swipe and drag components compile,
  but are only exercised from phase 3). Template example code, its `@expo/ui`, `expo-image`, `expo-symbols`,
  `expo-glass-effect`, `expo-device` and `expo-web-browser` packages, and the React Compiler flag removed
  (TracKar doesn't use it).
- RN 0.88 changed ref types: copied components use `HostInstance` / `TextInputInstance` as ref types.
- Owner answers to §14 recorded there.
- **Copied later, in their phase** (they need tables that don't exist yet): `services/backup.ts` and
  `dev/mockData.ts` (phase 5), `EarningsTrend` → `SpendTrend` (phase 4), `NotificationBell` + the
  Activity table (phase 6). The dev gear has only "Nuke database" until mock data exists.
  `MIGRATIONS` is empty; phase 2 adds the first migration (Categories).
- Themes: `label` removed from the theme objects (names come from the dictionaries); tints added as
  `theme.tints[key] = { fill, ink }`.
- i18n: flat typed dictionaries (`src/i18n/en.ts`, `id.ts satisfies Messages`), `useT()` → `{ t, tp, lang }`,
  `{Name}` in a string fills the capitalised value of `name` (for Indonesian sentences that start with
  "bulan"/"periode"). Plural keys are `<base>.one` / `<base>.other`. "Follow phone" also treats the legacy
  `in` code as Indonesian.
- The period Home and Charts show is shared in the store (`selectedPeriod`, in memory, `null` = current).
- Splash wordmark is 46 pt (TracKar's splash size) in `primaryText`, rather than the 26 pt `display` variant.
- Tests live in `__tests__/` and run under plain Node (`npm test`); a resolve hook maps `@/` and
  extensionless imports. `__tests__/tsconfig.json` adds Node types for the tests only.
- EAS: project `@daveherlambang/tangtu` created and linked (`extra.eas.projectId`
  `263a805b-dc47-406d-9fb1-ae94471d1511`), on the owner's go-ahead.
- Owner (2026-11-18): §7.3 kept as written but turned into **templates** — no categories are created on first
  launch; the user creates them, starting from a template or blank, and can change the icon and the tint
  (8 presets). Template names follow the language until renamed. `seed_key` renamed `template_key`.
- Owner (2026-11-18): contrast — keep TracKar's exact values; the four gaps are accepted exceptions (§14.8).

**2026-11-18 — phase 2 (categories)**
- Migration v1: `Categories` (§3). No seed rows. Icon and tint are validated in code, not by CHECKs, so new
  icons/tints never need a table rebuild; an unknown value reads as the fallback icon / `slate`.
- **Name uniqueness** (active, per kind) compares every name a category can show under: a typed name, or an
  untouched template's name in *both* languages — so "Makan & Minum" typed by hand clashes with an untouched
  Food & Drinks template category. Case- and space-insensitive. Archived categories free their name;
  restoring is refused while the name is taken.
- Typing a template's own name (either language) back into the field keeps `name = NULL`, so it keeps
  following the language.
- A category's kind is fixed after creation (changing it would flip its transactions between spent/income).
- Undo writes the exact previous row back (`putCategory`: same id, position, dates; never `INSERT OR REPLACE`).
- `categoryUsage` returns 0 until phase 3 adds Transactions; "Delete" on a used category will then offer
  Archive instead.
- Domain errors carry a code + params; screens show `error.<code>` in the current language.
- Icon names are in both dictionaries (`icon.*`): screen readers say them, and the icon search matches either
  language ("kopi" and "coffee" both find the cup).
- Editor is a modal route `category/edit` (`?id=` to edit, `?kind=` for new); `category/[id]` stays free for
  the category stats screen (phase 4). Manage screen: tap to edit, grip to drag; archive/delete in the editor.
- Not yet checked on a device or emulator (none on the dev machine).

**2026-11-18 — phase 3 (core loop)**
- Migration v2: `Transactions` with a `currency` column (§14.1); `category_id` is `ON DELETE RESTRICT`.
  The transaction's kind must match its category's.
- Money lives in `src/utils/money.ts` (formats, number pad logic); `formatRupiah` and `CurrencyField` are
  gone (the pad replaces the text field).
- **Number pad:** bottom row is `000 · 0 · ⌫` for IDR/JPY and `. · 0 · ⌫` (`,` for EUR) for cents
  currencies; at most 2 decimals; long-press ⌫ clears. Quick amounts **replace** the amount: IDR
  10.000 · 20.000 · 50.000 · 100.000; USD/EUR/SGD 5 · 10 · 20 · 50; JPY 500 · 1,000 · 2,000 · 5,000.
  Switching currency keeps the typed digits (decimals dropped for IDR/JPY). The currency chip sits left
  of the amount.
- **Date:** the chosen day at the current clock time (new) or the original time (edit). Any day can be
  picked, future included.
- **"+ New"** on the category grid opens the category editor; the new category is selected on return.
  Editing a transaction whose category was archived keeps that category on its grid.
- **Again** logs the same kind, amount, currency and category, now, without the note.
- **One totals function** (`src/utils/summary.ts` `summarize`): spent / income / left, top category and
  daily average count the default currency only; `count` counts every transaction in the period. Daily
  average = spent ÷ days so far in the current period (all days of a past one).
- **Day headers** show that day's spending in the default currency, or `+income` when nothing was spent.
- Home summary: the three stats are not tappable yet (phase 4 gives them destinations). The eye hides
  every amount in the summary card, including the daily average.
- Swipe buttons: Again (track), Edit (primary), Delete (danger with `surface` text — white fails on Dark).
- Not yet checked on a device or emulator.

**2026-11-19 — phase 4 (charts, category and day screens)**
- Chart figures come from pure functions in `src/utils/summary.ts`, all built on `summarize`:
  `rankCategories` (top 7 + Other), `trendKeys` + `trendPoints` (the trend), `spendByDay` (daily bars).
  Tests check that trend points and the sum of the daily bars equal `summarize` for that period, for start
  days 1, 25 and 31.
- **Ranked bars:** bar length is relative to the largest category (the % gives the share of spent). "Other"
  is only used when it would hold **two or more** categories (with 8, all 8 are shown — folding one would
  only hide its name). Other currencies with spending show as "Not counted: $12.50 (other currencies)".
  The line above says "Food & Drinks is 34% of your spending this month" (or "in September 2026" for a
  past period). Shares are whole percentages; "<1%" for slivers.
- **Trend:** window = up to 6 periods ending at the shown period (or the current one when a future period
  is shown), starting at the period of the first transaction (TracKar's rule). Bars with 0 draw nothing.
  Comparisons use the short month name ("Rp 240.000 more than Sep"). Fewer than 2 periods → the hint card.
- **Daily bars:** the bar of the biggest day is `accent` and the line above names it ("Most on Sat, 11 Oct ·
  Rp 450.000"); other days `outline`; today has a `text`-coloured outline (a 3 pt stub when nothing was
  spent). The dashed average line is Home's **Daily average** (spent ÷ days so far in the current period),
  so the two never disagree. Day numbers under every 7th bar from the period's first day. Every bar is a
  button with a spoken label; future days can be opened too (future dates can be logged).
- **Category screen** (`category/[id]`): shares the selected period (arrows + trend taps switch it for Home
  and Charts too); total ("Spent in October 2026" / "Income in …" for an income category, in `success`),
  share of all spending/income, count, other currencies, archived note; the category's own trend (from its
  first transaction); its transactions by day with swipe/long-press actions; header pencil → editor. A
  deleted category shows "This category no longer exists."
- **Day screen** (`day/[date]`, local `YYYY-MM-DD`): title Today / Yesterday / "Mon, 6 Oct"; spent (display,
  `accent`), income, other currencies; rows with the same actions. An invalid date shows a message.
- **Home stats:** top category → `category/[id]`; daily average → Charts; transactions → scrolls to the first
  day of the list. Disabled when there's nothing to open.
- Amounts on Charts, the category and the day screens are not hidden by the eye (§8.6: charts and lists need
  a tap to reach).
- Fixed: `src/app/settings.tsx` had been saved double-encoded (UTF-8 read as Windows-1252), so the footer
  and the currency list showed "Â·". Re-decoded; no other file was affected.
- Not yet checked on a device or emulator (none on the dev machine): chart layout, the dashed line (SVG),
  tick placement, scroll-to-list, Indonesian at 1.3×.

**2026-11-19 — phase 5 (safety)**
- TracKar's backup design, split in two: `src/db/backupRepository.ts` (format, validation, all SQL; runs
  under the Node tests) and `src/services/backup.ts` (file, share sheet, document picker, safety copy,
  preferences).
- File: `{ app: "TangTu", format: 1, schemaVersion, exportedAt, prefs, tables: { Categories, Transactions } }`,
  every column of every row (each transaction keeps its `currency`). `app` is a fixed string, not
  `BRAND.name`, so renaming the app never orphans old backups. Prefs carried: theme, language, start day,
  default currency, dev-gear hidden. Device markers (last backup, bell, recap) never travel.
- Restore refuses: not a TangTu file · `format` or `schemaVersion` newer than the app · damaged (a table
  that isn't a list of flat rows, a non-numeric version, an unreadable date) · empty. The replacement is
  one exclusive transaction; any refused row (CHECK, missing category, a transaction whose kind differs
  from its category's, a row with no known column) rolls everything back as "damaged". Columns map by name;
  unknown ones are ignored. Preferences pass through `sanitizePrefs`. The shown period resets to the
  current one.
- Safety copy `pre-restore-backup.json` in the document directory, written and read back before anything
  is replaced (restore refused if that fails); none when there is nothing to protect. Undo is offered for
  7 days, in one step. If the restore itself fails the copy is removed (nothing changed, nothing to undo).
- Settings → **Your data**: Export backup ("Last backup: 12 days ago", only after "Yes, saved"), Restore from
  backup, Undo last restore (only while available, "Possible until 26 Nov 2026"); rows show a spinner
  while working and the others are disabled.
- The bell's "Backup restored" message (§8.7) waits for phase 6 (no Activity table yet); a toast says it.
- **Mock data** (`src/dev/mockData.ts`, dev gear only): 6 or 12 periods for the current start day; resets
  first; deterministic (seeded, same call on the same day = same data); 8 expense + 2 income template
  categories; daily food, workday transport, Saturday groceries, bills on the 5th day, weekend fun, a few
  shopping trips; a big month every 4th period, a quiet one now and then; salary on the start day with a
  raise 3 periods ago; yen in big months and a dollar subscription every 3rd period; nothing in the future.
  Written through `createTransaction`, so it obeys the same rules as the app.
- SDK 58: `File.write()` returns a promise (sync in SDK 57).
- Not yet checked on a device: the share sheet, the document picker, file writes, Indonesian at 1.3×.

**2026-11-19 — phase 6 (polish)**
- **Migration v3: `Activity`** as §3 describes (`kind`, `params` JSON, `dedupe_key`, `created_at`; `ref_type` /
  `ref_id` kept for later use). Kinds: `recap`, `restore`, `restore_undone`, `whats_new`. Text is written out
  when shown (`src/utils/activityText.ts`), so a row reads in whichever language is current; template
  category names in a recap follow the language too (each top category is stored as a snapshot: id, name,
  template key). Unknown kinds or unreadable params are skipped. History keeps the newest 50 rows, at most
  60 days. Not backed up; cleared inside the restore transaction; the restore then writes "Backup restored"
  (with "undo until …" when a safety copy was kept), Undo restore writes "Restore undone".
- **Recap:** when a new period has started, the previous one's spent · income · left, count and top 3
  categories (from `summarize`, default currency at the time), once per period (`lastRecapPeriod` marker,
  set before writing); none for a period with nothing logged. Checked at launch and on return to the
  foreground. Detail sheet → "Open charts" (Charts opens on that period).
- **What's new:** `src/constants/releaseNotes.ts` with `{ version, date, en, id }` (§6.5); a test checks the
  first entry equals the app version (`app.json` = `package.json`), the order, the dates, and that both
  languages have the same sections. Page `whats-new` (TracKar's version stepper and series sheet), opened
  from Settings → About and from the bell. The first launch of a new version writes it to the bell, except
  on a fresh install with no data.
- **Bell** on Home (TracKar's: red dot until opened; "New" rows outlined while you're on the screen).
- **Search** (`search`, magnifier on Home's header next to the bell and settings): note `LIKE` (wildcards
  escaped) or category name, matched in JS against every name the category can show (both languages for an
  untouched template), plus multi-select category chips (every category with transactions, archived ones
  dimmed). All time, newest first, max 200, grouped by day; same row actions as Home. The line above: count ·
  spent in the default currency (`totalsByCurrency`, which `summarize` now builds on).
- **Start day:** Settings → Tracking → "Month starts on · Day 25" → a 1–31 grid whose hint says history is
  regrouped at once and nothing changes; 29–31 clamp. Picking a new day resets the shown period to the
  current one.
- `TextField` gained a `trailing` slot (search's clear button).
- **Release APK not built yet:** waiting for the owner (version number and go-ahead for an EAS build).
- Not yet checked on a device: all phase 6 screens, the keyboard on search, Indonesian at 1.3×.

**2026-11-22 — release 0.1.0**
- Owner: version rules written out as binding (§10): semantic versioning with `0.x` until the first user,
  one `release/x.y.z` branch per version, fast-forward into `master`, annotated tag `vX.Y.Z`, English
  patch-notes release commits. Remote `origin` = `https://github.com/DaveHerlambang/TangTu`.
- Phases 1–6 released as **0.1.0** (dated 2026-11-22 in `CHANGELOG.md` and `releaseNotes.ts`); first push.

**2026-11-22 — release 0.1.1 (PATCH)**
- Owner (on the phone): typing a note on the add/edit screen, the keyboard covered the note field. The form
  scrolled in a plain `ScrollView`; it is now a `KeyboardAwareScrollView` whose `bottomOffset` clears the Save
  bar that rides on the keyboard (`NOTE_CLEARANCE` = bar padding + `BUTTON_HEIGHT.md` + air).
- Owner: Language "Follow phone" / "Ikuti HP" renamed **"System default" / "Default sistem"** (the wording
  Android and most apps use). Same behaviour.

**2026-11-22 — release 0.2.0 (MINOR: a feature removed)**
- Owner: **rupiah only** (§14.1 rewritten). Removed: the currency chip and sheet on the add/edit screen, Settings →
  Currency with its warning, `defaultCurrency` (store, backups — ignored when an old backup has it), the yen
  and dollar rows in mock data, the currency names in the dictionaries. Every screen counts `DEFAULT_CURRENCY`.
- Owner: **add/edit screen redesigned** (§4): Expense | Income first, amount centred, the pad closed until the
  amount is tapped (owner chose this over opening it at once; one extra tap, more control). It opens by
  animating its holder's height 0 → pad height (pad always mounted, revealed bottom-up, hidden from touch and
  screen readers while closed), so the bar rises while Save stays put — a first try with layout animations
  made Save drop in from above the pad (owner, on the phone). ⌄ and Back hide it; day chip + note on one line.
  `ChoiceSheet`'s hint is optional now.
- Save: a first version disabled the button and changed its words ("Enter the amount" → "Pick a category");
  owner rejected it (people press it and nothing happens). Now always enabled, "Save"; a press with something
  missing nudges (`hapticNudge`, shake, scroll, a line via `FormField`'s new `message`).
- Quick-amount chips: number only ("10.000", "100.000" — `formatQuickAmount`), one font size for all, no
  per-chip shrinking (owner: "Rp 100.000" looked untidy next to "Rp 10.000"). Screen readers still hear the
  full amount.
