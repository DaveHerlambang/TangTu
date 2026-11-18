/**
 * Brand lines (docs/SPEC.md §0.1). Indonesian in both languages: they are the app's name and
 * voice, not UI copy, so they never go through `t()`. Change them only here.
 */
export const BRAND = {
  /** Shown on the phone and as the splash wordmark. */
  name: 'TangTu',
  /** Shown under the name: splash, About, store listing. */
  fullName: 'Tanggal Tua',
  /** Splash tagline. */
  tagline: 'Selamat datang di tanggal tua',
} as const;
