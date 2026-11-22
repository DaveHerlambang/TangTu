import { View } from 'react-native';

import { Touchable } from '@/components/Touchable';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { TINT_ORDER, spacing, type TintKey } from '@/theme/themes';
import { tintLabelKey } from '@/utils/categoryNames';
import { hapticTick } from '@/utils/haptics';

const SWATCH = 34;

/**
 * §7.4: the 8 preset tints as round swatches — the fill with a dot of its ink, so both colours of
 * the badge show — and a ring around the selected one. Wraps rather than shrinks on narrow phones.
 */
export function TintPicker({ value, onChange }: { value: TintKey; onChange: (tint: TintKey) => void }) {
  const { theme } = useTheme();
  const { t } = useT();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {TINT_ORDER.map((tint) => {
        const { fill, ink } = theme.tints[tint];
        const selected = tint === value;
        return (
          <Touchable
            key={tint}
            onPress={() => {
              hapticTick();
              onChange(tint);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={t('editor.colour.option', { colour: t(tintLabelKey(tint)) })}
            hitSlop={5}
            style={({ pressed }) => ({
              width: SWATCH + 8,
              height: SWATCH + 8,
              borderRadius: (SWATCH + 8) / 2,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: selected ? theme.colors.text : 'transparent',
              transform: [{ scale: pressed ? 0.92 : 1 }],
            })}
          >
            <View
              style={{
                width: SWATCH,
                height: SWATCH,
                borderRadius: SWATCH / 2,
                backgroundColor: fill,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ink }} />
            </View>
          </Touchable>
        );
      })}
    </View>
  );
}
