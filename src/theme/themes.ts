export type ThemeName = 'sakura' | 'light' | 'dark';

/** Category badge tints (§7.1). Order matters: a new category takes the next one, so neighbours differ. */
export const TINT_ORDER = ['rose', 'peach', 'amber', 'mint', 'teal', 'sky', 'lavender', 'slate'] as const;
export type TintKey = (typeof TINT_ORDER)[number];

/** A badge: the icon is drawn in `ink` on a `fill` square. Ink is ≥ 4.5:1 on its fill and on surface/background. */
export interface Tint {
  fill: string;
  ink: string;
}

/** Shared by Cherry Blossom and Light. */
const LIGHT_TINTS: Record<TintKey, Tint> = {
  rose: { fill: '#FDE2EC', ink: '#B23A68' },
  peach: { fill: '#FFE5D4', ink: '#A94F17' },
  amber: { fill: '#FFF0C2', ink: '#7D5800' },
  mint: { fill: '#DCF2E3', ink: '#2B7448' },
  teal: { fill: '#D3F0EF', ink: '#1D6E6E' },
  sky: { fill: '#DDE9FF', ink: '#2F5FCF' },
  lavender: { fill: '#EBE3FB', ink: '#6447BD' },
  slate: { fill: '#E7E9EF', ink: '#545C6C' },
};

const DARK_TINTS: Record<TintKey, Tint> = {
  rose: { fill: '#4A2B3B', ink: '#F7A1C0' },
  peach: { fill: '#4A3326', ink: '#FFB38A' },
  amber: { fill: '#463C22', ink: '#F2CC6B' },
  mint: { fill: '#273F33', ink: '#8FD6A8' },
  teal: { fill: '#213E43', ink: '#7FD6D6' },
  sky: { fill: '#26365A', ink: '#9DB8FF' },
  lavender: { fill: '#352E55', ink: '#C3A6FA' },
  slate: { fill: '#313548', ink: '#B9BFD4' },
};

export interface Theme {
  name: ThemeName;
  isDark: boolean;
  colors: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    /** The money colour (Rose Gold, green, neon cyan): the big "spent" number, selected chart bars. */
    accent: string;
    /** Secondary accent for highlights and chips. */
    accentAlt: string;
    /** Fill for buttons, the FAB, selected chips, rings. Pastel is fine here — text on it uses `onPrimary`. */
    primary: string;
    /** Text and icons drawn on a `primary` fill (≥ 4.5:1). */
    onPrimary: string;
    /** Primary-coloured text and icons on surfaces — links, "+ Add", small accents (≥ 4.5:1). */
    primaryText: string;
    /** Outlines of controls you can press, and the unselected bars of a chart (≥ 3:1). */
    outline: string;
    /** The action ("Undo") on the toast, which sits on a `text`-coloured pill (≥ 4.5:1). */
    toastAction: string;
    success: string;
    danger: string;
    track: string;
    /** Used for the soft, diffused, tinted drop shadow. */
    shadow: string;
  };
  /** Category badge colours (§7.1). Badges only — charts use a single hue. */
  tints: Record<TintKey, Tint>;
  /** CSS box-shadow (supported cross-platform by RN's New Architecture). */
  shadow: string;
}

export const themes: Record<ThemeName, Theme> = {
  sakura: {
    name: 'sakura',
    isDark: false,
    colors: {
      background: '#FCF6F9',
      surface: '#FFFFFF',
      text: '#4A3540',
      textMuted: '#7A6570',
      border: '#F6E3EB',
      accent: '#9C5562',
      accentAlt: '#E88FAE',
      primary: '#E88FAE',
      onPrimary: '#3E1A2C',
      primaryText: '#A94273',
      outline: '#B87894',
      toastAction: '#F6B8CD',
      success: '#357A4B',
      danger: '#C33F55',
      track: '#F8E6EE',
      shadow: 'rgba(232, 143, 174, 0.28)',
    },
    shadow: '0px 6px 18px rgba(232, 143, 174, 0.18)',
    tints: LIGHT_TINTS,
  },
  // Clean, near-white UI: white cards on a cool off-white canvas, neutral ink, one calm blue.
  light: {
    name: 'light',
    isDark: false,
    colors: {
      background: '#F6F7F9',
      surface: '#FFFFFF',
      text: '#1D2027',
      textMuted: '#666B78',
      border: '#E9EBF0',
      accent: '#167A4F',
      accentAlt: '#4C7DF0',
      primary: '#2F62D6',
      onPrimary: '#FFFFFF',
      primaryText: '#2F62D6',
      outline: '#8E94A3',
      toastAction: '#8FB0FF',
      success: '#167A4F',
      danger: '#C8343A',
      track: '#F0F1F4',
      shadow: 'rgba(17, 24, 39, 0.08)',
    },
    shadow: '0px 4px 14px rgba(17, 24, 39, 0.06)',
    tints: LIGHT_TINTS,
  },
  dark: {
    name: 'dark',
    isDark: true,
    colors: {
      background: '#1A1B26',
      surface: '#24283B',
      text: '#C0CAF5',
      textMuted: '#9AA0C4',
      border: '#2F3450',
      accent: '#7DCFFF',
      accentAlt: '#BB9AF7',
      primary: '#BB9AF7',
      onPrimary: '#1A1B26',
      primaryText: '#BB9AF7',
      outline: '#6D7399',
      toastAction: '#1A1B26',
      success: '#9ECE6A',
      danger: '#F7768E',
      track: '#2F3450',
      shadow: 'rgba(0, 0, 0, 0.35)',
    },
    shadow: '0px 6px 18px rgba(0, 0, 0, 0.3)',
    tints: DARK_TINTS,
  },
};

export const THEME_ORDER: readonly ThemeName[] = ['sakura', 'light', 'dark'];

/** Nunito: rounded, friendly sans. Android ignores fontWeight for custom fonts, so each weight is its own family. */
export const fonts = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
} as const;

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
