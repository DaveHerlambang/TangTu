export type ThemeName = 'sakura' | 'light' | 'matcha' | 'latte' | 'dark' | 'black';

/** Category badge tints (§7.1). Order matters: a new category takes the next one, so neighbours differ. */
export const TINT_ORDER = ['rose', 'peach', 'amber', 'mint', 'teal', 'sky', 'lavender', 'slate'] as const;
export type TintKey = (typeof TINT_ORDER)[number];

/** A badge: the icon is drawn in `ink` on a `fill` square. Ink is ≥ 4.5:1 on its fill and on surface/background. */
export interface Tint {
  fill: string;
  ink: string;
}

/** Shared by the light themes: Cherry Blossom, Light, Matcha, Iced Latte. */
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

/** Shared by the dark themes: Dark, Pitch Black. */
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
  // Clean, near-white UI: white cards on a cool off-white canvas, neutral ink, one calm blue — also for
  // spending since 0.4.0 (TracKar's green equalled `success`, so spent and income looked the same).
  light: {
    name: 'light',
    isDark: false,
    colors: {
      background: '#F6F7F9',
      surface: '#FFFFFF',
      text: '#1D2027',
      textMuted: '#666B78',
      border: '#E9EBF0',
      accent: '#2F62D6',
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
  // Matcha (0.4.0): matcha-latte canvas, matcha-powder buttons, deep "matcha ink" for spending and a
  // teal-green for income, so the two never look alike side by side (and Matcha never looks like Light).
  matcha: {
    name: 'matcha',
    isDark: false,
    colors: {
      background: '#E9F0DF',
      surface: '#FAFCF6',
      text: '#26321A',
      textMuted: '#53604A',
      border: '#D6E2C8',
      accent: '#3F5320',
      accentAlt: '#9DBE5E',
      primary: '#9DBE5E',
      onPrimary: '#22300D',
      primaryText: '#4A651C',
      outline: '#6A7C56',
      toastAction: '#C9E39A',
      success: '#1C6B58',
      danger: '#A8372C',
      track: '#DEE8D0',
      shadow: 'rgba(74, 101, 28, 0.16)',
    },
    shadow: '0px 4px 14px rgba(38, 50, 26, 0.08)',
    tints: LIGHT_TINTS,
  },
  // Iced Latte / Kopi Susu (0.4.0): warm cream and coffee brown, caramel buttons.
  latte: {
    name: 'latte',
    isDark: false,
    colors: {
      background: '#F8F3EC',
      surface: '#FFFDF9',
      text: '#3B2F27',
      textMuted: '#6A5D54',
      border: '#EEE4D8',
      accent: '#8A5A3B',
      accentAlt: '#C89B72',
      primary: '#C89B72',
      onPrimary: '#2E1E12',
      primaryText: '#8A5232',
      outline: '#94806F',
      toastAction: '#E8C9A6',
      success: '#336B3F',
      danger: '#A33F33',
      track: '#F0E7DC',
      shadow: 'rgba(138, 90, 59, 0.16)',
    },
    shadow: '0px 4px 14px rgba(59, 47, 39, 0.08)',
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
  // Pitch Black / Hitam Pekat (0.4.0): true black for OLED screens, soft grey text (not pure white, so it
  // doesn't glare), calm gold for amounts and buttons.
  black: {
    name: 'black',
    isDark: true,
    colors: {
      background: '#000000',
      surface: '#121212',
      text: '#E6E6E6',
      textMuted: '#A3A3A3',
      border: '#262626',
      accent: '#E8C27A',
      accentAlt: '#C9A35E',
      primary: '#E8C27A',
      onPrimary: '#1A1405',
      primaryText: '#E8C27A',
      outline: '#6B6B6B',
      toastAction: '#5C4300',
      success: '#8FD6A8',
      danger: '#F28B82',
      track: '#1F1F1F',
      shadow: 'rgba(0, 0, 0, 0.6)',
    },
    shadow: '0px 6px 18px rgba(0, 0, 0, 0.5)',
    tints: DARK_TINTS,
  },
};

/** The order in Settings (owner, 0.4.0): Light, Dark, Cherry Blossom, Pitch Black, then Matcha and Iced Latte. */
export const THEME_ORDER: readonly ThemeName[] = ['light', 'dark', 'sakura', 'black', 'matcha', 'latte'];

/** Nunito: rounded, friendly sans. Android ignores fontWeight for custom fonts, so each weight is its own family. */
export const fonts = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
} as const;

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
