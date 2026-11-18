import { View } from 'react-native';

import type { Theme } from '@/theme/themes';

/** A circle split in two: the theme's background on the left, its accent on the right. */
export function ThemeSwatch({ theme, size }: { theme: Theme; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        flexDirection: 'row',
        // Neutral hairline so near-white backgrounds still read as a circle on any surface.
        borderWidth: 1,
        borderColor: 'rgba(120, 120, 140, 0.25)',
        transform: [{ rotate: '-35deg' }],
      }}
    >
      <View style={{ flex: 1, backgroundColor: theme.colors.background }} />
      <View style={{ flex: 1, backgroundColor: theme.colors.primary }} />
    </View>
  );
}
