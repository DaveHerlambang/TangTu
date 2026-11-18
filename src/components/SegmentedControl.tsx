import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Touchable } from '@/components/Touchable';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/themes';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** iOS-style segmented control: a soft track with a raised "thumb" on the selected segment. */
export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const { theme } = useTheme();
  const c = theme.colors;
  const hasHints = options.some((o) => o.hint);

  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: 'row', padding: 3, borderRadius: radius.md, backgroundColor: c.track }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Touchable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              minHeight: hasHints ? 50 : 36,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing.sm,
              borderRadius: radius.md - 3,
              backgroundColor: selected ? c.surface : 'transparent',
              boxShadow: selected ? `0px 2px 6px ${c.shadow}` : undefined,
            }}
          >
            <AppText variant="label" tone={selected ? 'default' : 'muted'}>
              {opt.label}
            </AppText>
            {opt.hint ? (
              <AppText variant="caption" tone={selected ? 'accent' : 'muted'}>
                {opt.hint}
              </AppText>
            ) : null}
          </Touchable>
        );
      })}
    </View>
  );
}
