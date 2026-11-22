import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Touchable } from '@/components/Touchable';
import { BRAND } from '@/constants/brand';
import { usePeriodSettings } from '@/hooks/usePeriodSettings';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, spacing } from '@/theme/themes';
import { formatPeriodName, formatPeriodShort } from '@/utils/format';
import { formatMoney, type Currency } from '@/utils/money';
import type { TrendPoint } from '@/utils/summary';
import { hapticTick } from '@/utils/haptics';

const CHART_HEIGHT = 96;
const MIN_BAR = 4;
const BAR_MAX_WIDTH = 28;

interface SpendTrendProps {
  points: readonly TrendPoint[];
  /** The period on screen; its bar is highlighted. */
  selected: string;
  /** The period that contains today ("So far"). */
  current: string;
  /** Spending (the Charts tab, expense categories) or income (an income category). */
  measure: 'spent' | 'income';
  currency: Currency;
  onSelect: (key: string) => void;
}

/**
 * "Spent, last 6 periods" (§9.2) — TracKar's EarningsTrend: one bar per period from a zero
 * baseline, the shown period in the money colour and the others in the quiet outline colour. No
 * values on the bars; the line above compares the shown period with the one before, and tapping a
 * bar switches to that period. With fewer than two periods it says when the trend will appear.
 */
export function SpendTrend({ points, selected, current, measure, currency, onSelect }: SpendTrendProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, lang } = useT();
  const { kind, word } = usePeriodSettings();

  if (points.length < 2) {
    return (
      <Card>
        <AppText variant="caption" tone="muted">
          {t(kind === 'month' ? 'charts.trend.hint.month' : 'charts.trend.hint.period')}
        </AppText>
      </Card>
    );
  }

  const value = (p: TrendPoint) => (measure === 'spent' ? p.spent : p.income);
  const max = Math.max(...points.map(value), 1);
  const index = points.findIndex((p) => p.key === selected);
  const shown = index >= 0 ? points[index] : null;
  const before = index > 0 ? points[index - 1] : null;
  const short = (key: string) => formatPeriodShort(key, lang);

  let comparison = '';
  if (shown && shown.key === current) {
    comparison = before
      ? t('charts.trend.soFar', { period: short(before.key), amount: formatMoney(value(before), currency) })
      : t(kind === 'month' ? 'charts.trend.soFarFirst.month' : 'charts.trend.soFarFirst.period');
  } else if (shown && before) {
    const diff = value(shown) - value(before);
    const period = short(before.key);
    comparison =
      diff === 0
        ? t('charts.trend.same', { period })
        : t(diff > 0 ? 'charts.trend.more' : 'charts.trend.less', { amount: formatMoney(Math.abs(diff), currency), period });
  } else if (shown) {
    comparison = t(kind === 'month' ? 'charts.trend.first.month' : 'charts.trend.first.period', { app: BRAND.name });
  }

  const titleKey =
    measure === 'spent'
      ? kind === 'month'
        ? 'charts.trend.title.month'
        : 'charts.trend.title.period'
      : kind === 'month'
        ? 'charts.trend.titleIncome.month'
        : 'charts.trend.titleIncome.period';

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <AppText variant="caption" tone="muted">
          {t(titleKey, { count: points.length })}
        </AppText>
        {comparison ? <AppText variant="label">{comparison}</AppText> : null}
      </View>

      <View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            height: CHART_HEIGHT,
            gap: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
          }}
        >
          {points.map((p) => {
            const isShown = p.key === selected;
            const v = value(p);
            const height = v > 0 ? Math.max(MIN_BAR, Math.round((v / max) * CHART_HEIGHT)) : 0;
            return (
              <Touchable
                key={p.key}
                onPress={() => {
                  if (isShown) return;
                  hapticTick();
                  onSelect(p.key);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isShown }}
                accessibilityLabel={t(measure === 'spent' ? 'charts.trend.bar.spent' : 'charts.trend.bar.income', {
                  period: formatPeriodName(p.key, lang),
                  amount: formatMoney(v, currency),
                })}
                accessibilityHint={isShown ? undefined : t('charts.trend.bar.hint', { period: word })}
                // The whole column is the target, not just the bar: short bars stay easy to tap.
                style={({ pressed }) => ({
                  flex: 1,
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View
                  style={{
                    width: '100%',
                    maxWidth: BAR_MAX_WIDTH,
                    height,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    backgroundColor: isShown ? c.accent : c.outline,
                  }}
                />
              </Touchable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
          {points.map((p) => (
            <AppText
              key={p.key}
              variant="caption"
              tone={p.key === selected ? 'default' : 'muted'}
              style={[{ flex: 1, textAlign: 'center' }, p.key === selected && { fontFamily: fonts.extrabold }]}
              numberOfLines={1}
            >
              {short(p.key)}
            </AppText>
          ))}
        </View>
      </View>
    </Card>
  );
}
