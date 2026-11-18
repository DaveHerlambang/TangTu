import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { useTheme } from '@/theme/ThemeProvider';

export type IconName = ComponentProps<typeof Ionicons>['name'];

interface IconProps {
  name: IconName;
  size?: number;
  /** Defaults to the theme's muted text color. */
  color?: string;
}

/** Single icon family (Ionicons) app-wide so glyph weight and style stay consistent. */
export function Icon({ name, size = 18, color }: IconProps) {
  const { theme } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? theme.colors.textMuted} />;
}
