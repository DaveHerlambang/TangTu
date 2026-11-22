import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Touchable } from '@/components/Touchable';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/themes';
import { hapticTick } from '@/utils/haptics';

export interface ChoiceOption<K extends string> {
  key: K;
  label: string;
  detail?: string;
  leading?: ReactNode;
}

/** A bottom sheet with a single-choice list (TracKar's theme sheet, generalised). */
export function ChoiceSheet<K extends string>({
  title,
  hint,
  options,
  value,
  onPick,
  onClose,
}: {
  title: string;
  hint: string;
  options: ChoiceOption<K>[];
  value: K;
  onPick: (key: K) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <BottomSheet visible onClose={onClose}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ marginBottom: spacing.xs }}>
          <AppText variant="title">{title}</AppText>
          <AppText variant="caption" tone="muted">
            {hint}
          </AppText>
        </View>
        {options.map((o) => {
          const selected = o.key === value;
          return (
            <Touchable
              key={o.key}
              onPress={() => {
                hapticTick();
                onPick(o.key);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={o.detail ? `${o.label}, ${o.detail}` : o.label}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                minHeight: 52,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: selected || pressed ? c.track : 'transparent',
              })}
            >
              {o.leading}
              <View style={{ flex: 1 }}>
                <AppText variant="body">{o.label}</AppText>
                {o.detail ? (
                  <AppText variant="caption" tone="muted">
                    {o.detail}
                  </AppText>
                ) : null}
              </View>
              {selected ? <Icon name="checkmark" size={18} color={c.primaryText} /> : null}
            </Touchable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
