import { useEffect, type ReactNode } from 'react';
import { Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { KeyboardAvoidingView, KeyboardProvider } from 'react-native-keyboard-controller';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Touchable } from '@/components/Touchable';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/themes';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Fires once the slide-in has finished — the safe moment to focus an input. */
  onOpened?: () => void;
  children: ReactNode;
}

const SLIDE = { duration: 260, easing: Easing.out(Easing.cubic) };

/**
 * Themed modal sheet that slides up from the bottom; tap the scrim or press back to close.
 *
 * The slide is a plain shared-value transform, not a Reanimated layout animation: a layout
 * animation gets interrupted when the keyboard opens mid-slide (KeyboardAvoidingView re-lays
 * out the sheet) and can freeze off-screen — the "keyboard but no sheet" bug. Inputs inside
 * should focus from `onOpened` rather than `autoFocus` for the same reason.
 */
export function BottomSheet({ visible, onClose, onOpened, children }: BottomSheetProps) {
  const { t } = useT();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const offset = useSharedValue(height);

  useEffect(() => {
    if (!visible) {
      offset.set(height);
      return;
    }
    offset.set(
      withTiming(0, SLIDE, (finished) => {
        if (finished && onOpened) scheduleOnRN(onOpened);
      }),
    );
    // Only (re)run when the sheet opens; `onOpened` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {/* A Modal is its own Android window, so it needs its own keyboard provider; edge-to-edge
          windows don't resize for the keyboard, so the sheet is lifted by hand. */}
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
        <KeyboardAvoidingView behavior="padding" automaticOffset style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Touchable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10, 12, 20, 0.35)' }]}
          />
          <Animated.View
            style={[
              {
                backgroundColor: theme.colors.surface,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.sm,
                paddingBottom: insets.bottom + spacing.lg,
                boxShadow: `0px -8px 30px ${theme.colors.shadow}`,
              },
              slide,
            ]}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.colors.border,
                marginBottom: spacing.md,
              }}
            />
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </KeyboardProvider>
    </Modal>
  );
}
