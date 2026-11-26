import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { DailySpend } from '@/components/DailySpend';
import { Icon } from '@/components/Icon';
import { LoadError } from '@/components/LoadError';
import { PeriodHeader } from '@/components/PeriodHeader';
import { SpendTrend } from '@/components/SpendTrend';
import type { Db } from '@/db/db';
import { listTransactions } from '@/db/transactionsRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { usePeriodSettings, useSelectedPeriod } from '@/hooks/usePeriodSettings';
import { useSpendTrend } from '@/hooks/useSpendTrend';
import { useT } from '@/i18n';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, type Theme } from '@/theme/themes';
import { periodRange } from '@/utils/format';
import { spendByDay, summarize } from '@/utils/summary';
import { DEFAULT_CURRENCY } from '@/utils/money';

/**
 * Charts (§9) for the period chosen on Home (shared): where did it go (ranked categories) · is this
 * month worse (the trend) · which days (daily bars). Every number comes from `summarize`, so it
 * matches Home. Before anything has been logged at all, one empty card instead.
 */
export default function ChartsScreen() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t } = useT();
  const { startDay } = usePeriodSettings();
  const { key, isCurrent, setKey } = useSelectedPeriod();
  const currency = DEFAULT_CURRENCY;

  const load = useCallback((db: Db) => listTransactions(db, periodRange(key, startDay)), [key, startDay]);
  const { data, error, reload } = useDbQuery(load);
  const { points, current } = useSpendTrend(key);

  const rows = useMemo(() => data ?? [], [data]);
  const summary = useMemo(() => summarize(rows, currency, { key, startDay }), [rows, currency, key, startDay]);
  const days = useMemo(() => spendByDay(rows, currency, { key, startDay }), [rows, currency, key, startDay]);
  const loaded = data !== undefined && points !== undefined;
  const nothingYet = loaded && points.length === 0 && rows.length === 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl, gap: spacing.lg }}
    >
      <PeriodHeader caption={t('tabs.charts')} />

      {error ? <LoadError onRetry={() => void reload()} /> : null}

      {nothingYet ? (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Icon name="bar-chart-outline" size={20} color={theme.colors.text} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="heading">{t('charts.empty.title')}</AppText>
            <AppText variant="caption" tone="muted">
              {t('charts.empty.body')}
            </AppText>
          </View>
        </Card>
      ) : loaded ? (
        <>
          {/* Keyed by period so "Other" folds again when the period changes. */}
          <CategoryBreakdown key={key} summary={summary} period={key} isCurrent={isCurrent} />
          <SpendTrend points={points} selected={key} current={current} measure="spent" currency={currency} onSelect={setKey} />
          <DailySpend days={days} average={summary.dailyAverage} currency={currency} period={key} />
        </>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.background },
    emptyCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    emptyIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.track,
    },
  });
