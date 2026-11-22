import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Touchable } from '@/components/Touchable';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/themes';
import { hapticTick } from '@/utils/haptics';
import { currencyDecimals, decimalSeparator, formatMoney, quickAmounts, type Currency, type PadKey } from '@/utils/money';

const KEY_HEIGHT = 50;
const ROWS: readonly (readonly PadKey[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

interface NumberPadProps {
  currency: Currency;
  onKey: (key: PadKey) => void;
  /** A quick chip sets the whole amount (in the smallest unit). */
  onQuick: (minor: number) => void;
}

/**
 * The in-app number pad (§4): same size every time, no keyboard jump. Bottom row is
 * `000 · 0 · ⌫` for whole-unit currencies and `. · 0 · ⌫` (or `,`) for ones with cents.
 * Long-press ⌫ clears. Quick amount chips sit on top.
 */
export function NumberPad({ currency, onKey, onQuick }: NumberPadProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useT();
  const hasDecimals = currencyDecimals(currency) > 0;
  const press = (key: PadKey) => {
    hapticTick();
    onKey(key);
  };

  const key = (k: PadKey, label: string | null, a11y?: string, onLongPress?: () => void) => (
    <Touchable
      key={k}
      onPress={() => press(k)}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label ?? undefined}
      accessibilityHint={k === 'back' ? t('pad.backspace.hint') : undefined}
      style={({ pressed }) => ({
        flex: 1,
        height: KEY_HEIGHT,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.border : c.track,
      })}
    >
      {label !== null ? (
        <AppText variant="title" maxFontSizeMultiplier={1.15}>
          {label}
        </AppText>
      ) : (
        <Icon name="backspace-outline" size={22} color={c.text} />
      )}
    </Touchable>
  );

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {quickAmounts(currency).map((minor) => {
          const label = formatMoney(minor, currency);
          return (
            <Touchable
              key={minor}
              onPress={() => {
                hapticTick();
                onQuick(minor);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('pad.quick', { amount: label })}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 34,
                paddingHorizontal: 2,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: c.outline,
                backgroundColor: pressed ? c.track : 'transparent',
              })}
            >
              <AppText variant="caption" numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.15}>
                {label}
              </AppText>
            </Touchable>
          );
        })}
      </View>
      {ROWS.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
          {row.map((k) => key(k, k))}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {hasDecimals ? key('decimal', decimalSeparator(currency), t('pad.decimal')) : key('000', '000', t('pad.thousand'))}
        {key('0', '0')}
        {key('back', null, t('pad.backspace'), () => {
          hapticTick();
          onKey('clear');
        })}
      </View>
    </View>
  );
}
