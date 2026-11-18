import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, type Theme } from '@/theme/themes';

export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';
export type TextTone = 'default' | 'muted' | 'accent' | 'accentAlt' | 'success' | 'danger' | 'onPrimary';

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
}

const VARIANTS: Record<TextVariant, { fontFamily: string; fontSize: number; lineHeight: number }> = {
  display: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 32 },
  title: { fontFamily: fonts.extrabold, fontSize: 19, lineHeight: 24 },
  heading: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19 },
  label: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17 },
  caption: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
};

const toneColor = (theme: Theme, tone: TextTone): string =>
  ({
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    accent: theme.colors.accent,
    accentAlt: theme.colors.accentAlt,
    success: theme.colors.success,
    danger: theme.colors.danger,
    onPrimary: theme.colors.onPrimary,
  })[tone];

/**
 * Text follows the phone's font-size setting, but only up to this factor: beyond it pills, chips
 * and rows would have to grow so much the layout breaks. Override per use if a spot has room.
 */
export const MAX_FONT_SCALE = 1.3;

export function AppText({ variant = 'body', tone = 'default', style, maxFontSizeMultiplier = MAX_FONT_SCALE, ...rest }: AppTextProps) {
  const { theme } = useTheme();
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[VARIANTS[variant], { color: toneColor(theme, tone) }, style]}
    />
  );
}
