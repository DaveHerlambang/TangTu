import { useEffect, type ComponentProps } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { useAmounts } from '@/hooks/useAmounts';
import { formatRupiah, maskRupiah } from '@/utils/format';

import { AppText } from './AppText';

const LIFT = 4;
const EASE = { duration: 240, easing: Easing.inOut(Easing.cubic) };

/**
 * 0 = hidden, 1 = shown, animated between. Starts at the current state (nothing moves when a
 * screen opens) and eases when the eye flips. Reduce-motion jumps straight to the end.
 */
export function useRevealProgress(): SharedValue<number> {
  const { visible } = useAmounts();
  const progress = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    progress.set(withTiming(visible ? 1 : 0, EASE));
  }, [visible, progress]);
  return progress;
}

type Format = (amount: number) => string;
type Props = Omit<ComponentProps<typeof AppText>, 'children'> & {
  /** Builds the text from a formatter, once with real digits and once with stars. */
  children: (format: Format) => string;
  /** Which edge the text hugs (right for a value at the end of a row). */
  align?: 'left' | 'right';
};

/**
 * An amount that follows the eye. Both versions — digits and stars — stay mounted on top of each
 * other and cross-fade (with a 4 px drift), so nothing is re-created or re-measured mid-change:
 * no flicker, no jump in size.
 */
export function AmountText({ children, align = 'left', style, ...rest }: Props) {
  const progress = useRevealProgress();
  const shownStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * LIFT }],
  }));
  const hiddenStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
    transform: [{ translateY: -progress.get() * LIFT }],
  }));
  const textStyle = [style, align === 'right' ? { textAlign: 'right' as const } : null];
  return (
    <View>
      {/* The digits sit in the layout and size the box; the stars lie on top of them. */}
      <Animated.View style={shownStyle}>
        <AppText {...rest} style={textStyle}>
          {children(formatRupiah)}
        </AppText>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, hiddenStyle]}
      >
        <AppText {...rest} style={textStyle}>
          {children(maskRupiah)}
        </AppText>
      </Animated.View>
    </View>
  );
}
