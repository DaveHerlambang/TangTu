import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { sameDay, startOfDay } from '@/components/CalendarGrid';
import { Icon, type IconName } from '@/components/Icon';
import { Touchable } from '@/components/Touchable';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/themes';
import { useT } from '@/i18n';
import { formatWeekdayDayMonth, weekdayNarrow } from '@/i18n/dates';

interface DayStripProps {
  /** Selected day; the strip shows its Monday–Sunday week. */
  anchor: Date;
  /** Days of that week that have entries (a dot under the date), keyed by `Date.toDateString()`. */
  marked: ReadonlySet<string>;
  onPick: (day: Date) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Mon–Sun strip: tap a day to jump to it, arrows step a week. A dot shows the day has entries.
 */
export function DayStrip({ anchor, marked, onPick }: DayStripProps) {
  const { t, lang } = useT();
  const { theme } = useTheme();
  const c = theme.colors;
  const monday = startOfDay(new Date(anchor.getTime() - ((anchor.getDay() + 6) % 7) * DAY_MS));
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  const today = new Date();

  const arrow = (icon: IconName, delta: number, label: string) => (
    <Touchable
      onPress={() => onPick(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 7 * delta))}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({ width: 24, height: 56, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
    >
      <Icon name={icon} size={18} />
    </Touchable>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {arrow('chevron-back', -1, t('calendar.previousWeek'))}
      {days.map((day) => {
        const selected = sameDay(day, anchor);
        const isToday = sameDay(day, today);
        const dot = marked.has(day.toDateString());
        return (
          <Touchable
            key={day.toDateString()}
            onPress={() => onPick(day)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={formatWeekdayDayMonth(day, lang)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 56,
              marginHorizontal: 2,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              backgroundColor: selected ? c.primary : pressed ? c.track : 'transparent',
              borderWidth: isToday && !selected ? 1.5 : 0,
              borderColor: c.primary,
            })}
          >
            <AppText variant="caption" tone={selected ? 'onPrimary' : 'muted'}>
              {weekdayNarrow(day, lang)}
            </AppText>
            <AppText variant="heading" tone={selected ? 'onPrimary' : 'default'}>
              {day.getDate()}
            </AppText>
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: !dot ? 'transparent' : selected ? c.onPrimary : c.primary,
              }}
            />
          </Touchable>
        );
      })}
      {arrow('chevron-forward', 1, t('calendar.nextWeek'))}
    </View>
  );
}

