This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json` (TangTu started on **SDK 58**).
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

```bash
npx expo install <package>  # ALWAYS use instead of npm add — resolves SDK-compatible versions
npx expo start              # dev server (dev-client mode; add --go for Expo Go)
npm run typecheck           # tsc for the app and for the tests
npm test                    # node:test suites in __tests__/ (plain Node, type stripping)
npx expo lint               # lint
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions (then re-sync the lockfile with npm 10)
```

Run typecheck, tests and lint before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.

## Building with EAS

Run EAS CLI as `npx eas-cli@latest <command>`. APKs for phones are built with the `preview` profile.

## Rules

- `ios/` and `android/` are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build.

## TangTu — read the spec first

TangTu (*Tanggal Tua*) is an **offline, private personal money tracker**, the sister app of TracKar
(`E:\Development\TracKar`, same owner). It must look, feel and behave like TracKar; only the job differs.
The full product spec is **[`docs/SPEC.md`](docs/SPEC.md)** and the release history is **[`CHANGELOG.md`](CHANGELOG.md)**.

**Before any feature, money, date, copy or data change, read `docs/SPEC.md`.** Do not invent business rules
(money, dates, categories); if something isn't in the spec or the code, ask. If the spec and the code
disagree, flag it instead of picking one. Update the spec and the changelog in the same change as any
behavior change. **TracKar is read-only**: copy from it, never edit, install in, build or run git in it.

Non-negotiables (details in the spec):

- **Purpose and scope.** Offline, no accounts/cloud sync/bank integrations/sharing/analytics/ads/remote push,
  no OS notifications at all. Push back on requests that turn this into a bank app or a social app.
- **Two languages, English and Bahasa Indonesia.** Every user-visible string (including screen-reader labels,
  toasts, dialogs) goes through `t()`; `src/i18n/en.ts` is the source, `id.ts` must match it (type-checked),
  and `__tests__/no-literals.test.ts` fails on text written straight into a component. Indonesian uses
  "kamu", never "Anda". The brand lines (TangTu, Tanggal Tua, the tagline — `src/constants/brand.ts`)
  never change. No emoji in the UI.
- **Money is integer, dates are ISO UTC.** Periods start on the user's start day (default 1) and are keyed by
  the month they end in. One function computes spent / income / left for every screen.
- **Versioning is semantic and you must enforce it.** PATCH = fixes/polish/dependency bumps; MINOR = new
  capability, changed meaning of numbers, or a removed feature; MAJOR = breaks stored data/backups or changes
  the app's purpose. `0.x` while building; `1.0.0` for the first APK given to a user. `app.json`,
  `package.json` and `package-lock.json` versions must match; `versionCode` is automatic. If the owner
  proposes a number that doesn't fit, say so and recommend the right one.
- **Data safety.** SQLite migrations are append-only; every schema or preference change keeps old backups
  restorable. A used category is archived, never deleted.
- **Code rules.** Never import `Pressable` (use `Touchable`); strict TypeScript; dev tools only behind
  `__DEV__` (guarded `require`); keyboard handling via `react-native-keyboard-controller`; Ionicons only;
  `AppText` is the only text component; all SQL in `src/db/*Repository.ts`.
- **Behaviour.** Immediate actions offer Undo; deletes confirm first, then still offer Undo; nothing nags
  or shames (over budget is calm text, not red).
- **What's new.** Every release adds a user-facing entry (English and Indonesian) to
  `src/constants/releaseNotes.ts`; `CHANGELOG.md` is the developer-facing record.
- **Release hygiene.** Lockfile via `npx --yes npm@10.9.8 install --package-lock-only` and check with
  `npx --yes npm@10.9.8 ci --dry-run --include=dev` (EAS uses npm 10); typecheck, tests, lint,
  `expo-doctor` and `expo export` must pass; check the release bundle has no dev tools; propose the
  patch-notes commit message and **never push without being asked**.
- **Be honest about verification.** Say what was verified (tests, export, emulator, device) and what wasn't.
