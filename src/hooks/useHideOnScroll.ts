import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/** Scrolled less than this from the top, the button always shows. */
const TOP_ZONE = 24;
/** Ignore tiny jitters so the button doesn't flicker. */
const MIN_DELTA = 6;

/**
 * For a floating button over a list: slides it away while scrolling down (so it never covers a
 * row's controls) and brings it back as soon as the user scrolls up or reaches the top.
 * Spread `onScroll` + `scrollEventThrottle` on the list and put `style` on an Animated.View.
 */
export function useHideOnScroll(distance = 120) {
  const hidden = useSharedValue(0);
  const lastY = useRef(0);
  const target = useRef(0);

  const go = useCallback(
    (to: 0 | 1) => {
      if (target.current === to) return;
      target.current = to;
      hidden.set(withTiming(to, { duration: 180 }));
    },
    [hidden],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - lastY.current;
      lastY.current = y;
      if (y < TOP_ZONE) go(0);
      else if (dy > MIN_DELTA) go(1);
      else if (dy < -MIN_DELTA) go(0);
    },
    [go],
  );

  const style = useAnimatedStyle(() => ({
    opacity: 1 - hidden.get(),
    transform: [{ translateY: hidden.get() * distance }],
  }));

  return { onScroll, scrollEventThrottle: 16, style };
}
