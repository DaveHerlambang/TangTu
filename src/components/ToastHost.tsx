import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeOutUp, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Touchable } from '@/components/Touchable';
import { useToastStore } from '@/store/useToastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/themes';

const DEFAULT_DURATION = 5000;

/**
 * App-wide toast (top of the screen, so it never fights the FAB or tab bar). Inverse colors
 * make it stand out from cards in every theme without shouting.
 */
export function ToastHost() {
  const toast = useToastStore((s) => s.toast);
  const dismiss = useToastStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = theme.colors;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => dismiss(toast.id), toast.duration ?? DEFAULT_DURATION);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  if (!toast) return null;
  const actionColor = c.toastAction;

  return (
    <Animated.View
      key={toast.id}
      entering={SlideInUp.duration(220)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="box-none"
      // Centred and at most 560 wide: on a wide web window (0.6.0) a full-width bar would stretch across the screen.
      style={{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.lg, right: spacing.lg, zIndex: 1000, alignItems: 'center' }}
    >
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{
          width: '100%',
          maxWidth: 560,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: 48,
          paddingLeft: spacing.lg,
          paddingRight: toast.actionLabel ? spacing.xs : spacing.lg,
          borderRadius: radius.lg,
          backgroundColor: c.text,
          boxShadow: `0px 10px 24px ${c.shadow}`,
        }}
      >
        <Touchable onPress={() => dismiss(toast.id)} style={{ flex: 1, paddingVertical: spacing.md }} accessibilityLabel={toast.message}>
          <AppText variant="label" style={{ color: c.background }} numberOfLines={2}>
            {toast.message}
          </AppText>
        </Touchable>
        {toast.actionLabel && (
          <Touchable
            onPress={() => {
              dismiss(toast.id, true);
              void toast.onAction?.();
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + 2,
              borderRadius: radius.md,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <AppText variant="heading" style={{ color: actionColor }}>
              {toast.actionLabel}
            </AppText>
          </Touchable>
        )}
      </View>
    </Animated.View>
  );
}
