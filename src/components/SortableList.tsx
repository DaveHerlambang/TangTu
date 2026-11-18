import * as Haptics from 'expo-haptics';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/Icon';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/themes';

interface SortableListProps<T> {
  items: T[];
  keyOf: (item: T) => string;
  /** Every row has the same height, which keeps the drag math simple and jank-free. */
  rowHeight: number;
  disabled?: boolean;
  /** Render a row; place `handle` where the drag grip should go. */
  renderRow: (item: T, handle: ReactNode) => ReactNode;
  onReorder: (items: T[]) => void;
  /** Lets a parent ScrollView stop scrolling while a row is held. */
  onDragStateChange?: (dragging: boolean) => void;
}

const LONG_PRESS_MS = 150;
const SETTLE = { duration: 180 };

const impact = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const tick = () => void Haptics.selectionAsync();

/**
 * Small, dependency-free sortable list (gesture-handler + Reanimated). Long-press a row's
 * grip, drag, and the other rows slide out of the way; the new order is reported on drop.
 */
export function SortableList<T>({
  items,
  keyOf,
  rowHeight,
  disabled,
  renderRow,
  onReorder,
  onDragStateChange,
}: SortableListProps<T>) {
  const keys = items.map(keyOf);
  const order = useSharedValue<string[]>(keys);

  // Adopt the parent's list only when the *set* of rows changes (add/remove). A pure reorder
  // coming back from the database after a drop already matches what the user sees.
  const keySet = [...keys].sort().join('|');
  useEffect(() => {
    order.set(keys);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the set of rows, see above
  }, [keySet]);

  const drop = (finalOrder: string[]) => {
    const byKey = new Map(items.map((item) => [keyOf(item), item]));
    const next = finalOrder.map((k) => byKey.get(k)).filter((x): x is T => x !== undefined);
    if (next.some((item, i) => item !== items[i])) onReorder(next);
  };

  return (
    <View style={{ height: items.length * rowHeight }}>
      {items.map((item, index) => {
        const key = keyOf(item);
        return (
          <SortableRow
            key={key}
            id={key}
            initialIndex={index}
            count={items.length}
            order={order}
            rowHeight={rowHeight}
            disabled={disabled}
            onDrop={drop}
            onDragStateChange={onDragStateChange}
          >
            {(handle) => renderRow(item, handle)}
          </SortableRow>
        );
      })}
    </View>
  );
}

interface SortableRowProps {
  id: string;
  initialIndex: number;
  count: number;
  order: SharedValue<string[]>;
  rowHeight: number;
  disabled?: boolean;
  onDrop: (order: string[]) => void;
  onDragStateChange?: (dragging: boolean) => void;
  children: (handle: ReactNode) => ReactNode;
}

function SortableRow({
  id,
  initialIndex,
  count,
  order,
  rowHeight,
  disabled,
  onDrop,
  onDragStateChange,
  children,
}: SortableRowProps) {
  const notifyDrag = (dragging: boolean) => onDragStateChange?.(dragging);
  const { t } = useT();
  const { theme } = useTheme();
  const top = useSharedValue(initialIndex * rowHeight);
  const startTop = useSharedValue(0);
  const dragging = useSharedValue(false);

  // Shared values use .get()/.set() (not .value) so the React Compiler can reason about them.

  // When another row moves past this one, slide into the freed slot.
  useAnimatedReaction(
    () => order.get().indexOf(id),
    (index, previous) => {
      if (index >= 0 && index !== previous && !dragging.get()) top.set(withTiming(index * rowHeight, SETTLE));
    },
  );

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      dragging.set(true);
      startTop.set(top.get());
      scheduleOnRN(impact);
      scheduleOnRN(notifyDrag, true);
    })
    .onUpdate((e) => {
      const y = Math.min(Math.max(startTop.get() + e.translationY, 0), (count - 1) * rowHeight);
      top.set(y);
      const current = order.get();
      const to = Math.round(y / rowHeight);
      const from = current.indexOf(id);
      if (to !== from && from >= 0) {
        const next = current.slice();
        next.splice(from, 1);
        next.splice(to, 0, id);
        order.set(next);
        scheduleOnRN(tick);
      }
    })
    .onFinalize(() => {
      if (!dragging.get()) return;
      dragging.set(false);
      const finalOrder = order.get();
      top.set(withTiming(finalOrder.indexOf(id) * rowHeight, SETTLE));
      scheduleOnRN(onDrop, finalOrder);
      scheduleOnRN(notifyDrag, false);
    });

  const style = useAnimatedStyle(() => {
    const active = dragging.get();
    return {
      transform: [{ translateY: top.get() }, { scale: withTiming(active ? 1.02 : 1, SETTLE) }],
      zIndex: active ? 10 : 0,
      backgroundColor: active ? theme.colors.surface : 'transparent',
      borderRadius: radius.sm,
      opacity: withTiming(active ? 0.96 : 1, SETTLE),
    };
  });

  const handle = disabled ? null : (
    <GestureDetector gesture={pan}>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={t('list.reorder')}
        accessibilityHint={t('list.reorderHint')}
        hitSlop={8}
        style={{ width: 32, height: rowHeight, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="reorder-three-outline" size={20} />
      </View>
    </GestureDetector>
  );

  return (
    <Animated.View style={[{ position: 'absolute', left: 0, right: 0, height: rowHeight }, style]}>
      {children(handle)}
    </Animated.View>
  );
}
