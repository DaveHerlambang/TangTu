import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Touchable } from '@/components/Touchable';
import { useNow } from '@/hooks/useNow';
import { useT } from '@/i18n';
import { formatWeekdayDayMonth } from '@/i18n/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/themes';
import { formatPeriodName, localDayKey } from '@/utils/format';
import { formatMoney, type Currency } from '@/utils/money';
import type { DaySpend } from '@/utils/summary';

const CHART_HEIGHT = 110;
const GAP = 2;
const BAR_MAX_WIDTH = 12;
const MIN_BAR = 3;
const TICK_WIDTH = 28;
/** A day number under every 7th bar, counted from the first day of the period. */
const TICK_EVERY = 7;

interface DailySpendProps {
  days: readonly DaySpend[];
  /** `summarize(...).dailyAverage` — the same figure as Home's "Daily average". */
  average: number;
  currency: Currency;
  period: string;
}

/**
 * "Which days" (§9.3): a bar per day of the period from a zero baseline, a thin dashed line at the
 * daily average, today outlined. The line above names the biggest day, whose bar is in the money
 * colour; the rest are in the outline colour. Tap a day to open its transactions.
 */
export function DailySpend({ days, average, currency, period }: DailySpendProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, lang } = useT();
  const today = localDayKey(new Date(useNow()));
  const [width, setWidth] = useState(0);

  const busiest = days.reduce<DaySpend | null>((best, d) => (d.spent > 0 && (!best || d.spent > best.spent) ? d : best), null);
  const max = Math.max(busiest?.spent ?? 0, average, 1);
  const headline = busiest
    ? t('charts.daily.most', { day: formatWeekdayDayMonth(busiest.date, lang), amount: formatMoney(busiest.spent, currency) })
    : t('charts.none', { period: formatPeriodName(period, lang) });

  const cell = width > 0 ? (width - GAP * (days.length - 1)) / days.length : 0;
  const avgY = CHART_HEIGHT - Math.round((average / max) * CHART_HEIGHT);
  // Keep the "avg" label inside the chart: under the line when the line is near the top.
  const labelBelow = avgY < 18;

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <AppText variant="caption" tone="muted">
          {t('charts.daily.title')}
        </AppText>
        <AppText variant="label">{headline}</AppText>
      </View>

      <View>
        <View
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: GAP, borderBottomWidth: 1, borderBottomColor: c.border }}
        >
          {days.map((d) => {
            const isToday = d.key === today;
            const isBusiest = d === busiest;
            const height = d.spent > 0 ? Math.max(MIN_BAR, Math.round((d.spent / max) * CHART_HEIGHT)) : isToday ? MIN_BAR : 0;
            const day = formatWeekdayDayMonth(d.date, lang);
            const amount = formatMoney(d.spent, currency);
            return (
              <Touchable
                key={d.key}
                onPress={() => router.push({ pathname: '/day/[date]', params: { date: d.key } })}
                accessibilityRole="button"
                accessibilityLabel={t(isToday ? 'charts.daily.bar.today' : 'charts.daily.bar', { day, amount })}
                accessibilityHint={t('charts.daily.bar.hint')}
                style={({ pressed }) => ({ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', opacity: pressed ? 0.6 : 1 })}
              >
                <View
                  style={{
                    width: '100%',
                    maxWidth: BAR_MAX_WIDTH,
                    height,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    backgroundColor: d.spent === 0 ? 'transparent' : isBusiest ? c.accent : c.outline,
                    borderWidth: isToday ? 1.5 : 0,
                    borderColor: c.text,
                  }}
                />
              </Touchable>
            );
          })}

          {average > 0 && width > 0 ? (
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: avgY - 1 }}>
              <Svg width={width} height={2}>
                <Line x1={0} y1={1} x2={width} y2={1} stroke={c.textMuted} strokeWidth={1} strokeDasharray="4 3" />
              </Svg>
              <AppText
                variant="caption"
                tone="muted"
                style={{
                  position: 'absolute',
                  right: 0,
                  ...(labelBelow ? { top: 3 } : { bottom: 3 }),
                  paddingHorizontal: 4,
                  borderRadius: 4,
                  backgroundColor: c.surface,
                }}
              >
                {t('charts.daily.avg', { amount: formatMoney(average, currency) })}
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Day numbers under every 7th bar, placed by measured width (one cell is too narrow for a label). */}
        <View style={{ height: 18, marginTop: spacing.xs }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {width > 0
            ? days.map((d, i) =>
                i % TICK_EVERY === 0 ? (
                  <AppText
                    key={d.key}
                    variant="caption"
                    tone={d.key === today ? 'default' : 'muted'}
                    style={{
                      position: 'absolute',
                      width: TICK_WIDTH,
                      textAlign: 'center',
                      left: Math.min(Math.max(0, i * (cell + GAP) + cell / 2 - TICK_WIDTH / 2), width - TICK_WIDTH),
                    }}
                  >
                    {d.date.getDate()}
                  </AppText>
                ) : null,
              )
            : null}
        </View>
      </View>
    </Card>
  );
}
