import { useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { Touchable } from '@/components/Touchable';
import { radius, spacing } from '@/theme/themes';

const ACTION_WIDTH = 84;

export interface SwipeAction {
  key: string;
  label: string;
  icon: IconName;
  /** Replaces `icon` when the button needs a drawn icon (e.g. the thumbtack). */
  iconNode?: ReactNode;
  /** Button fill. */
  color: string;
  /** Icon and label color. */
  contentColor: string;
  accessibilityLabel?: string;
  onPress: () => void;
}

function Actions({ progress, actions, onPress }: { progress: SharedValue<number>; actions: SwipeAction[]; onPress: (a: SwipeAction) => void }) {
  // Fade in with the swipe so the buttons never show through translucent cards at rest.
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3, 1], [0, 0.6, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.8, 1]) }],
  }));

  return (
    <Animated.View style={[{ flexDirection: 'row', paddingLeft: spacing.md, gap: spacing.sm }, style]}>
      {actions.map((a) => (
        <View key={a.key} style={{ width: ACTION_WIDTH }}>
          <Touchable
            onPress={() => onPress(a)}
            accessibilityRole="button"
            accessibilityLabel={a.accessibilityLabel ?? a.label}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              borderRadius: radius.lg,
              backgroundColor: a.color,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            {a.iconNode ?? <Icon name={a.icon} size={22} color={a.contentColor} />}
            <AppText variant="label" style={{ color: a.contentColor }}>
              {a.label}
            </AppText>
          </Touchable>
        </View>
      ))}
    </Animated.View>
  );
}

/** Swipe a row left to reveal several action buttons (e.g. Pin and Delete). */
export function SwipeActions({ children, actions }: { children: ReactNode; actions: SwipeAction[] }) {
  const swipeable = useRef<SwipeableMethods>(null);
  const width = actions.length * ACTION_WIDTH + (actions.length - 1) * spacing.sm;

  // Close the row first, then run the action (which may show a confirmation).
  const press = (action: SwipeAction) => {
    swipeable.current?.close();
    action.onPress();
  };

  return (
    <Swipeable
      ref={swipeable}
      friction={2}
      rightThreshold={width / 2}
      overshootRight={false}
      // Default container clips children, which would cut off the cards' soft shadow.
      containerStyle={{ overflow: 'visible' }}
      renderRightActions={(progress) => <Actions progress={progress} actions={actions} onPress={press} />}
    >
      {children}
    </Swipeable>
  );
}
