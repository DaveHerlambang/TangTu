import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

interface ProgressRingProps {
  /** 0..1 (clamped). */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
}

/** Small circular progress indicator (used for the content goal per period). */
export function ProgressRing({ progress, size = 18, stroke = 3, color }: ProgressRingProps) {
  const { theme } = useTheme();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <Svg width={size} height={size} accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.colors.border} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color ?? theme.colors.primary}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - p)}
        // Start at 12 o'clock.
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}
