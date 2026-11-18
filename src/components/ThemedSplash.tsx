import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/AppText';
import { BRAND } from '@/constants/brand';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, spacing } from '@/theme/themes';

const HOLD_MS = 1100;
const FADE_OUT_MS = 320;

interface ThemedSplashProps {
  /** Called once the splash has faded out and can be unmounted. */
  onDone: () => void;
  /** Called on first layout — the moment to hide the native splash, so the handoff is seamless. */
  onShown: () => void;
}

/**
 * Launch greeting drawn in the *selected* theme. The native splash can't know the theme (it
 * shows before any JS runs), so this takes over as soon as the app is ready: the "TangTu" wordmark
 * springs in, "Tanggal Tua" and the tagline follow, it holds a beat, and the whole layer fades
 * away to reveal Home underneath. The three lines are brand copy (Indonesian in both languages).
 */
export function ThemedSplash({ onDone, onShown }: ThemedSplashProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const reduceMotion = useReducedMotion();

  const layer = useSharedValue(1);
  const hero = useSharedValue(0);
  const tagline = useSharedValue(0);

  useEffect(() => {
    const ease = { duration: 420, easing: Easing.out(Easing.cubic) };
    hero.set(reduceMotion ? withTiming(1, { duration: 200 }) : withSpring(1, { damping: 12, stiffness: 160 }));
    tagline.set(withDelay(reduceMotion ? 0 : 220, withTiming(1, ease)));
    layer.set(
      withSequence(
        withTiming(1, { duration: HOLD_MS }),
        withTiming(0, { duration: FADE_OUT_MS }, (finished) => {
          if (finished) scheduleOnRN(onDone);
        }),
      ),
    );
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layerStyle = useAnimatedStyle(() => ({ opacity: layer.get() }));
  const heroStyle = useAnimatedStyle(() => ({
    opacity: hero.get(),
    transform: [{ scale: reduceMotion ? 1 : 0.86 + 0.14 * hero.get() }, { translateY: (1 - hero.get()) * 8 }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: tagline.get(), transform: [{ translateY: (1 - tagline.get()) * 6 }] }));

  return (
    <Animated.View
      onLayout={onShown}
      accessibilityRole="header"
      accessibilityLabel={`${BRAND.name}, ${BRAND.fullName}. ${BRAND.tagline}`}
      style={[StyleSheet.absoluteFill, { backgroundColor: c.background, zIndex: 2000 }, layerStyle]}
    >
      {/* Soft theme-tinted blobs keep it playful without competing with the greeting. */}
      <View style={[styles.blob, { top: -80, right: -60, backgroundColor: c.primary, opacity: 0.14 }]} />
      <View style={[styles.blob, { bottom: -110, left: -70, width: 300, height: 300, backgroundColor: c.accentAlt, opacity: 0.1 }]} />

      <View style={styles.center}>
        <Animated.View style={heroStyle}>
          <AppText
            variant="display"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ fontFamily: fonts.extrabold, fontSize: 46, lineHeight: 54, color: c.primaryText, textAlign: 'center' }}
          >
            {BRAND.name}
          </AppText>
        </Animated.View>
        <Animated.View style={[taglineStyle, { marginTop: spacing.xs }]}>
          <AppText variant="caption" tone="muted" style={{ textAlign: 'center', letterSpacing: 2.5 }}>
            {BRAND.fullName}
          </AppText>
        </Animated.View>
        <Animated.View style={[taglineStyle, { marginTop: spacing.lg }]}>
          <AppText variant="body" style={{ textAlign: 'center' }}>
            {BRAND.tagline}
          </AppText>
        </Animated.View>
        <Animated.View style={[taglineStyle, styles.dotRow]}>
          <View style={[styles.dot, { backgroundColor: c.primary }]} />
          <View style={[styles.dot, { backgroundColor: c.accent }]} />
          <View style={[styles.dot, { backgroundColor: c.accentAlt }]} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  blob: { position: 'absolute', width: 260, height: 260, borderRadius: 999 },
  dotRow: { flexDirection: 'row', gap: 6, marginTop: spacing.xl },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
