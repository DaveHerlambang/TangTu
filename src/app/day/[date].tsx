import { Stack, useLocalSearchParams } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { listTransactions } from '@/db/transactionsRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { usePeriodSettings } from '@/hooks/usePeriodSettings';
import { useTransactionActions } from '@/hooks/useTransactionActions';
import { useT } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Theme } from '@/theme/themes';
import { dayRange, formatDayLabel, parseDayKey, periodKey } from '@/utils/format';
import { formatMoney } from '@/utils/money';
import { summarize } from '@/utils/summary';

/**
 * One day's transactions (§4), opened from the daily chart: what was spent (and earned) that day,
 * then the rows — tap to edit, swipe or long-press for Again · Edit · Delete. `date` is "YYYY-MM-DD".
 */
export default function DayScreen() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const translator = useT();
  const { t } = translator;
  const { date } = useLocalSearchParams<{ date: string }>();
  const day = useMemo(() => parseDayKey(date ?? ''), [date]);
  const { startDay } = usePeriodSettings();
  const currency = useAppStore((s) => s.defaultCurrency);

  const load = useCallback((db: SQLiteDatabase) => (day ? listTransactions(db, dayRange(day)) : Promise.resolve([])), [day]);
  const { data, error } = useDbQuery(load);
  const actions = useTransactionActions();
  const rows = useMemo(() => data ?? [], [data]);
  // The one totals function, over just this day's rows.
  const s = useMemo(() => (day ? summarize(rows, currency, { key: periodKey(day, startDay), startDay }) : null), [rows, currency, day, startDay]);

  if (!day || !s) {
    return (
      <View style={[styles.screen, { padding: spacing.lg }]}>
        <Stack.Screen options={{ title: '' }} />
        <Card>
          <AppText tone="muted">{t('day.invalid')}</AppText>
        </Card>
      </View>
    );
  }

  const others = s.others
    .flatMap((o) => [o.spent > 0 ? formatMoney(o.spent, o.currency) : null, o.income > 0 ? `+${formatMoney(o.income, o.currency)}` : null])
    .filter((x): x is string => x !== null);

  const header = (
    <View style={{ gap: spacing.lg, marginBottom: spacing.lg }}>
      {error ? (
        <Card>
          <AppText tone="danger">{t('home.loadError', { message: error.message })}</AppText>
        </Card>
      ) : null}
      <Card style={{ gap: 2 }}>
        <View accessible accessibilityLabel={`${t('day.spent')}: ${formatMoney(s.spent, currency)}`} style={{ gap: 2 }}>
          <AppText variant="caption" tone="muted">
            {t('day.spent')}
          </AppText>
          <AppText variant="display" tone="accent" numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(s.spent, currency)}
          </AppText>
        </View>
        {s.income > 0 ? (
          <AppText variant="caption" tone="muted">
            {t('day.income', { amount: formatMoney(s.income, currency) })}
          </AppText>
        ) : null}
        {others.length > 0 ? (
          <AppText variant="caption" tone="muted">
            {t('home.summary.others', { amounts: others.join(' · ') })}
          </AppText>
        ) : null}
      </Card>
      {data && rows.length === 0 ? (
        <Card>
          <AppText variant="caption" tone="muted">
            {t('day.empty')}
          </AppText>
        </Card>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: formatDayLabel(day, translator) }} />
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        renderItem={({ item }) => actions.renderItem(item)}
      />
      {actions.sheet}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.background },
  });
