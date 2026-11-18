# Changelog

All notable changes to TangTu, newest first. Format: **NEW / CHANGED / FIXED / REMOVED / UNDER THE HOOD**.
Versioning rules live in [`docs/SPEC.md`](docs/SPEC.md) §10. Add an entry here with every release.

---

## 0.1.0 — in development

Phase 1 of the build order (docs/SPEC.md §13): setup and design system.

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

**UNDER THE HOOD**
- Tests in `__tests__/` (plain Node + type stripping, `npm test`): period maths for every start day incl.
  Dec → Jan and February, contrast of every theme token and tint, dictionaries complete and consistent in
  both languages, date tables, relative dates, preference validation, and no hard-coded UI text.
- React Native 0.88 ref types: `HostInstance` / `TextInputInstance` replace `View` / `TextInput` as ref types
  in the copied components.
- Lockfile generated with npm 10.9.8.
