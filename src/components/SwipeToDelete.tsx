import { useRef, type ReactNode } from 'react';

import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Touchable } from '@/components/Touchable';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/themes';

const ACTION_WIDTH = 96;

interface SwipeToDeleteProps {
  children: ReactNode;
  /** Called when the revealed Delete action is pressed. Resolve `false` to snap the row back. */
  onDelete: () => Promise<boolean>;
}

function DeleteAction({ progress, onPress }: { progress: SharedValue<number>; onPress: () => void }) {
  const { theme } = useTheme();
  const { t } = useT();
  // Fade in with the swipe so the action never shows through translucent (done) cards at rest.
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3, 1], [0, 0.6, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.8, 1]) }],
  }));

  return (
    <Animated.View style={[{ width: ACTION_WIDTH, paddingLeft: spacing.md }, style]}>
      <Touchable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('common.delete')}
        style={({ pressed }) => ({
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          borderRadius: radius.lg,
          backgroundColor: theme.colors.danger,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Icon name="trash-outline" size={22} color="#FFFFFF" />
        <AppText variant="label" style={{ color: '#FFFFFF' }}>
          {t('common.delete')}
        </AppText>
      </Touchable>
    </Animated.View>
  );
}

/** Swipe a row left to reveal a Delete action. */
export function SwipeToDelete({ children, onDelete }: SwipeToDeleteProps) {
  const swipeable = useRef<SwipeableMethods>(null);

  const handleDelete = async () => {
    const deleted = await onDelete();
    if (!deleted) swipeable.current?.close();
  };

  return (
    <Swipeable
      ref={swipeable}
      friction={2}
      rightThreshold={ACTION_WIDTH / 2}
      overshootRight={false}
      // Default container clips children, which would cut off the cards' soft shadow.
      containerStyle={{ overflow: 'visible' }}
      renderRightActions={(progress) => <DeleteAction progress={progress} onPress={handleDelete} />}
    >
      {children}
    </Swipeable>
  );
}
