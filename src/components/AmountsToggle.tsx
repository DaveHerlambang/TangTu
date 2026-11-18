import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useAmounts } from '@/hooks/useAmounts';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/themes';
import { hapticTick } from '@/utils/haptics';

import { useRevealProgress } from './AmountText';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

const layer = { position: 'absolute', top: 0, left: 0 } as const;

interface Props {
  /**
   * `pill`: the same height, fill and colour as the Home summary's "Details" pill, so the two read as
   * one pair of controls (a round 32 pt button looked bigger than the pill; a bare icon got lost).
   * `button`: the round, filled version for the end of a settings row.
   */
  variant?: 'pill' | 'button';
}

/** The eye: shows or hides the Home summary amounts. The icon shows the current state. */
export function AmountsToggle({ variant = 'button' }: Props) {
  const { theme } = useTheme();
  const { visible, toggle } = useAmounts();
  const { t } = useT();
  const progress = useRevealProgress();
  const pill = variant === 'pill';
  const size = pill ? 15 : 18;
  // Both icons stay mounted and cross-fade with a slight scale, in step with the amounts.
  const openStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: 0.7 + 0.3 * progress.get() }],
  }));
  const closedStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
    transform: [{ scale: 1 - 0.3 * progress.get() }],
  }));
  const color = pill ? theme.colors.primaryText : theme.colors.text;
  return (
    <Touchable
      onPress={() => {
        hapticTick();
        toggle();
      }}
      accessibilityRole="button"
      accessibilityLabel={visible ? t('amounts.hide') : t('amounts.show')}
      // Still a 44 pt target: 22 + 11 + 11 tall for the pill (less on the right, where "Details" sits).
      hitSlop={pill ? { top: 11, bottom: 11, left: 8, right: 4 } : 6}
      style={({ pressed }) => ({
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        backgroundColor: pressed ? theme.colors.border : theme.colors.track,
        ...(pill ? { minHeight: 22, paddingHorizontal: spacing.sm } : { width: 32, height: 32 }),
      })}
    >
      <View style={{ width: size, height: size }}>
        <Animated.View style={[layer, closedStyle]}>
          <Icon name="eye-off-outline" size={size} color={color} />
        </Animated.View>
        <Animated.View style={[layer, openStyle]}>
          <Icon name="eye-outline" size={size} color={color} />
        </Animated.View>
      </View>
    </Touchable>
  );
}
