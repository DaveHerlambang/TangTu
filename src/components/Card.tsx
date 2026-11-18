import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/themes';

interface CardProps extends ViewProps {
  /** Overrides the surface color (e.g. pastel task cards). */
  color?: string;
  padded?: boolean;
}

/** Soft-UI card: generous radius + diffused, theme-tinted drop shadow. */
export function Card({ color, padded = true, style, ...rest }: CardProps) {
  const { theme } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: color ?? theme.colors.surface,
          borderRadius: radius.lg,
          padding: padded ? spacing.md + 2 : 0,
          boxShadow: theme.shadow,
        },
        style,
      ]}
    />
  );
}
