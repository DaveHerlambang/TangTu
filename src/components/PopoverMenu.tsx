import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Modal, View, useWindowDimensions, type HostInstance, type LayoutRectangle } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { Touchable } from '@/components/Touchable';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/themes';

const GAP = 8;
const EDGE = 12;

/** Measures a trigger view in window coordinates so a popover can be anchored to it. */
export function usePopoverAnchor() {
  const ref = useRef<HostInstance>(null);
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);
  const open = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
  }, []);
  const close = useCallback(() => setAnchor(null), []);
  return { ref, anchor, open, close };
}

interface PopoverMenuProps {
  anchor: LayoutRectangle | null;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}

/**
 * Floating menu anchored to a trigger. Opens below the trigger, or above it when the
 * trigger sits in the lower half of the screen; aligns to whichever side it is on.
 */
export function PopoverMenu({ anchor, onClose, width = 240, children }: PopoverMenuProps) {
  const { theme } = useTheme();
  const { t } = useT();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [menuHeight, setMenuHeight] = useState(0);

  let top = 0;
  let left = 0;
  if (anchor) {
    const openUp = anchor.y + anchor.height / 2 > screenH / 2;
    const alignRight = anchor.x + anchor.width / 2 > screenW / 2;
    top = openUp ? anchor.y - menuHeight - GAP : anchor.y + anchor.height + GAP;
    left = alignRight ? anchor.x + anchor.width - width : anchor.x;
    left = Math.max(EDGE, Math.min(left, screenW - width - EDGE));
  }

  return (
    <Modal
      visible={anchor !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      onDismiss={() => setMenuHeight(0)}
    >
      <Touchable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t('common.closeMenu')}>
        <View
          // Hidden until measured so an upward menu never flashes in the wrong spot.
          onLayout={(e) => setMenuHeight(e.nativeEvent.layout.height)}
          onStartShouldSetResponder={() => true}
          accessibilityRole="menu"
          style={{
            position: 'absolute',
            top,
            left,
            width,
            opacity: menuHeight > 0 ? 1 : 0,
            backgroundColor: theme.colors.surface,
            borderRadius: radius.lg,
            padding: spacing.sm,
            gap: spacing.xs,
            borderWidth: 1,
            borderColor: theme.colors.border,
            boxShadow: `0px 14px 32px ${theme.colors.shadow}`,
          }}
        >
          {children}
        </View>
      </Touchable>
    </Modal>
  );
}

interface MenuItemProps {
  label: string;
  icon?: IconName;
  hint?: string;
  destructive?: boolean;
  onPress: () => void;
}

export function MenuItem({ label, icon, hint, destructive, onPress }: MenuItemProps) {
  const { theme } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="menuitem"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        backgroundColor: pressed ? theme.colors.track : 'transparent',
      })}
    >
      {icon ? <Icon name={icon} size={20} color={destructive ? theme.colors.danger : theme.colors.text} /> : null}
      <View style={{ flex: 1 }}>
        <AppText variant="heading" tone={destructive ? 'danger' : 'default'}>
          {label}
        </AppText>
        {hint ? (
          <AppText variant="caption" tone="muted">
            {hint}
          </AppText>
        ) : null}
      </View>
    </Touchable>
  );
}
