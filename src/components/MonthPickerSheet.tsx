import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { Touchable } from '@/components/Touchable';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/themes';
import { usePeriodSettings } from '@/hooks/usePeriodSettings';
import { useT } from '@/i18n';
import { MONTHS_SHORT } from '@/i18n/dates';

interface MonthPickerSheetProps {
  visible: boolean;
  /** Selected month, "YYYY-MM". */
  value: string;
  onSelect: (month: string) => void;
  onClose: () => void;
}

/** Year header + 4×3 month grid (a period is named after the month it ends in). One tap picks and closes. */
export function MonthPickerSheet({ visible, value, onSelect, onClose }: MonthPickerSheetProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, lang } = useT();
  const { word, currentKey } = usePeriodSettings();
  const current = currentKey();
  const [year, setYear] = useState(() => Number(value.slice(0, 4)));

  const arrow = (icon: IconName, delta: number, label: string) => (
    <Touchable
      onPress={() => setYear((y) => y + delta)}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.border : c.track,
      })}
    >
      <Icon name={icon} size={17} color={c.text} />
    </Touchable>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AppText variant="title" style={{ flex: 1 }}>
            {year}
          </AppText>
          {arrow('chevron-back', -1, t('calendar.previousYear'))}
          {arrow('chevron-forward', 1, t('calendar.nextYear'))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
          {MONTHS_SHORT[lang].map((label, m) => {
            const key = `${year}-${String(m + 1).padStart(2, '0')}`;
            const selected = key === value;
            const isCurrent = key === current;
            return (
              <View key={key} style={{ width: '25%', padding: 4 }}>
                <Touchable
                  onPress={() => {
                    onSelect(key);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${label} ${year}`}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? c.primary : pressed ? c.border : c.track,
                    borderWidth: isCurrent && !selected ? 1.5 : 0,
                    borderColor: c.primary,
                  })}
                >
                  <AppText variant="label" tone={selected ? 'onPrimary' : 'default'}>
                    {label}
                  </AppText>
                </Touchable>
              </View>
            );
          })}
        </View>

        {value !== current && (
          <Button
            label={t('period.backToCurrent', { period: word })}
            kind="soft"
            onPress={() => {
              onSelect(current);
              onClose();
            }}
          />
        )}
      </View>
    </BottomSheet>
  );
}
