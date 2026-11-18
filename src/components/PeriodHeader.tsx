import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { MonthPickerSheet } from '@/components/MonthPickerSheet';
import { Touchable } from '@/components/Touchable';
import { usePeriodSettings, useSelectedPeriod } from '@/hooks/usePeriodSettings';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/themes';
import { formatPeriodName, formatPeriodRange } from '@/utils/format';

interface PeriodHeaderProps {
  /** Small line above the period (the app name on Home, the screen name on Charts). */
  caption: string;
  /** Buttons on the right (bell, settings). */
  right?: ReactNode;
}

/**
 * TracKar's dashboard header: the period itself is the control — tap "October 2026 ⌄" to pick
 * another one. Home and Charts share the chosen period.
 */
export function PeriodHeader({ caption, right }: PeriodHeaderProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, lang } = useT();
  const { startDay, word } = usePeriodSettings();
  const { key, setKey } = useSelectedPeriod();
  const [picking, setPicking] = useState(false);
  const name = formatPeriodName(key, lang);

  return (
    <View style={styles.topBar}>
      <View style={{ flexShrink: 1 }}>
        <AppText variant="caption" tone="muted">
          {caption}
        </AppText>
        <Touchable
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel={`${name}. ${t('period.change', { period: word })}`}
          hitSlop={8}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.6 : 1 })}
        >
          <AppText variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
            {name}
          </AppText>
          <Icon name="chevron-down" size={16} color={c.text} />
        </Touchable>
        <AppText variant="caption" tone="muted">
          {formatPeriodRange(key, startDay, lang)}
        </AppText>
      </View>
      {right ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>{right}</View> : null}
      {picking && <MonthPickerSheet visible value={key} onSelect={setKey} onClose={() => setPicking(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
});
