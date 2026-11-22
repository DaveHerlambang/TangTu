import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Touchable } from '@/components/Touchable';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/themes';
import { hapticTick } from '@/utils/haptics';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const COLUMNS = 7;

/**
 * Pick the day a period starts on (§3): a 7-column grid of 1–31. The hint says what changing it does:
 * history is regrouped at once, nothing stored changes; 29–31 fall on the last day of shorter months.
 */
export function StartDaySheet({ value, onPick, onClose }: { value: number; onPick: (day: number) => void; onClose: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useT();

  return (
    <BottomSheet visible onClose={onClose}>
      <View style={{ gap: spacing.md }}>
        <View>
          <AppText variant="title">{t('settings.startDay')}</AppText>
          <AppText variant="caption" tone="muted">
            {t('settings.startDay.sheetHint')}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm }}>
          {DAYS.map((day) => {
            const selected = day === value;
            return (
              <View key={day} style={{ width: `${100 / COLUMNS}%`, alignItems: 'center' }}>
                <Touchable
                  onPress={() => {
                    hapticTick();
                    onPick(day);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t('settings.startDay.value', { day })}
                  style={({ pressed }) => ({
                    width: 40,
                    height: 40,
                    borderRadius: radius.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? c.primary : pressed ? c.track : 'transparent',
                  })}
                >
                  <AppText variant="label" tone={selected ? 'onPrimary' : 'default'}>
                    {day}
                  </AppText>
                </Touchable>
              </View>
            );
          })}
        </View>
      </View>
    </BottomSheet>
  );
}
