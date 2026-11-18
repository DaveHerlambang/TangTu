import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/themes';

interface ProgressBarProps {
  value: number;
  total: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ value, total, color, height = 5 }: ProgressBarProps) {
  const { theme } = useTheme();
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: value }}
      style={{ height, borderRadius: radius.pill, backgroundColor: theme.colors.track, overflow: 'hidden' }}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          borderRadius: radius.pill,
          backgroundColor: color ?? theme.colors.accentAlt,
        }}
      />
    </View>
  );
}
