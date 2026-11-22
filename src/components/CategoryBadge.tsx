import { View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import type { CategoryIcon } from '@/constants/categories';
import { useTheme } from '@/theme/ThemeProvider';
import type { TintKey } from '@/theme/themes';

interface CategoryBadgeProps {
  icon: CategoryIcon;
  tint: TintKey;
  /** Edge length in pt; 38 is the list size (§7). The corner radius and glyph scale with it. */
  size?: number;
  /** Archived categories in lists: same badge, quieter. */
  dimmed?: boolean;
}

/** The glyph a category icon is drawn with (§7.2: always the outline variant). */
export const categoryGlyph = (icon: CategoryIcon) => `${icon}-outline` as IconName;

/**
 * A category's identity (§7): its icon in the tint's ink on the tint's fill, in a rounded square.
 * Decorative for screen readers — the row it sits in says the category's name.
 */
export function CategoryBadge({ icon, tint, size = 38, dimmed }: CategoryBadgeProps) {
  const { theme } = useTheme();
  const { fill, ink } = theme.tints[tint];
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        borderRadius: Math.round((size * 12) / 38),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: fill,
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      <Icon name={categoryGlyph(icon)} size={Math.round(size * 0.5)} color={ink} />
    </View>
  );
}
