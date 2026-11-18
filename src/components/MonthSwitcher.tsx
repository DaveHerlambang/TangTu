import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { Touchable } from '@/components/Touchable';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/themes';
import { usePeriodSettings } from '@/hooks/usePeriodSettings';
import { useT } from '@/i18n';
import { formatPeriodName, formatPeriodRange, shiftPeriodKey } from '@/utils/format';

interface MonthSwitcherProps {
  month: string;
  onChange: (month: string) => void;
}

/** ‹ October 2026 › — steps through periods; the dates it covers sit underneath. */
export function MonthSwitcher({ month, onChange }: MonthSwitcherProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, lang } = useT();
  const { startDay, word } = usePeriodSettings();

  const arrow = (icon: IconName, delta: number, label: string) => (
    <Touchable
      onPress={() => onChange(shiftPeriodKey(month, delta))}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.border : c.track,
      })}
    >
      <Icon name={icon} size={17} color={c.text} />
    </Touchable>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      {arrow('chevron-back', -1, t('period.previous', { period: word }))}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <AppText variant="heading" style={{ textAlign: 'center' }}>
          {formatPeriodName(month, lang)}
        </AppText>
        <AppText variant="caption" tone="muted">
          {formatPeriodRange(month, startDay, lang)}
        </AppText>
      </View>
      {arrow('chevron-forward', 1, t('period.next', { period: word }))}
    </View>
  );
}
