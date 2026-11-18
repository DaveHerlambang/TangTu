import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { Touchable } from '@/components/Touchable';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/themes';
import { useT } from '@/i18n';
import { WEEKDAYS_NARROW, formatMonthYear, formatWeekdayDayMonth } from '@/i18n/dates';

const CELL_HEIGHT = 42;
const DOT = 38;

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

/** Monday-first grid for a month, padded with nulls to whole weeks. */
function monthGrid(year: number, month: number): (Date | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

interface CalendarGridProps {
  /** Selected day, or the start of the selected range. */
  from: Date;
  /** End of the selected range (inclusive). Omit for single-day selection. */
  to?: Date;
  onPick: (day: Date) => void;
  /** Days after this are shown but can't be picked. */
  maxDate?: Date;
  /** Shortcut chips shown left of the month arrows. */
  shortcuts?: ReactNode;
}

/** Month calendar with prev/next navigation; renders a single day or a from–until range. */
export function CalendarGrid({ from, to, onPick, maxDate, shortcuts }: CalendarGridProps) {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const c = theme.colors;
  const [view, setView] = useState({ year: (to ?? from).getFullYear(), month: (to ?? from).getMonth() });
  const today = new Date();
  const start = startOfDay(from).getTime();
  const end = startOfDay(to ?? from).getTime();
  const isRange = end > start;

  const shiftMonth = (delta: number) =>
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <View style={{ gap: spacing.md }}>
      {shortcuts ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{shortcuts}</View> : null}

      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <IconButton icon="chevron-back" label={t('calendar.previousMonth')} onPress={() => shiftMonth(-1)} />
          <AppText variant="heading" style={{ flex: 1, textAlign: 'center' }}>
            {formatMonthYear(view.year, view.month, lang)}
          </AppText>
          <IconButton icon="chevron-forward" label={t('calendar.nextMonth')} onPress={() => shiftMonth(1)} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS_NARROW[lang].map((d, i) => (
            <AppText key={i} variant="caption" tone="muted" style={{ flex: 1, textAlign: 'center' }}>
              {d}
            </AppText>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs }}>
          {monthGrid(view.year, view.month).map((day, i) => {
            const t = day ? day.getTime() : 0;
            const endpoint = day !== null && (t === start || t === end);
            const inRange = day !== null && isRange && t >= start && t <= end;
            const disabled = day !== null && maxDate !== undefined && t > startOfDay(maxDate).getTime();
            return (
              <View key={i} style={{ width: `${100 / 7}%`, height: CELL_HEIGHT, justifyContent: 'center' }}>
                {/* Range band: a soft strip joining the endpoints, half-width on each end. */}
                {inRange && (
                  <View
                    style={{
                      position: 'absolute',
                      top: (CELL_HEIGHT - DOT) / 2,
                      height: DOT,
                      left: t === start ? '50%' : 0,
                      right: t === end ? '50%' : 0,
                      backgroundColor: c.track,
                    }}
                  />
                )}
                {day && (
                  <Touchable
                    onPress={() => onPick(day)}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected: endpoint, disabled }}
                    accessibilityLabel={`${formatWeekdayDayMonth(day, lang)} ${day.getFullYear()}`}
                    style={({ pressed }) => ({
                      alignSelf: 'center',
                      width: DOT,
                      height: DOT,
                      borderRadius: DOT / 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: endpoint ? c.primary : pressed ? c.border : 'transparent',
                      borderWidth: sameDay(day, today) && !endpoint ? 1.5 : 0,
                      borderColor: c.primary,
                      opacity: disabled ? 0.3 : 1,
                    })}
                  >
                    <AppText variant="label" tone={endpoint ? 'onPrimary' : 'default'}>
                      {day.getDate()}
                    </AppText>
                  </Touchable>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export function QuickChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        minHeight: 32,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        justifyContent: 'center',
        backgroundColor: selected ? c.primary : pressed ? c.border : c.track,
      })}
    >
      <AppText variant="label" tone={selected ? 'onPrimary' : 'default'}>
        {label}
      </AppText>
    </Touchable>
  );
}

function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? theme.colors.border : theme.colors.track,
      })}
    >
      <Icon name={icon} size={17} color={theme.colors.text} />
    </Touchable>
  );
}
