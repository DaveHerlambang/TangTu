import { Stack, router, useLocalSearchParams } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useMemo } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { CategoryBadge } from '@/components/CategoryBadge';
import { Icon } from '@/components/Icon';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { SpendTrend } from '@/components/SpendTrend';
import { Touchable } from '@/components/Touchable';
import { getCategory } from '@/db/categoriesRepository';
import { listTransactions } from '@/db/transactionsRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { usePeriodSettings, useSelectedPeriod } from '@/hooks/usePeriodSettings';
import { useSpendTrend } from '@/hooks/useSpendTrend';
import { useTransactionActions } from '@/hooks/useTransactionActions';
import { useT } from '@/i18n';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Theme } from '@/theme/themes';
import { categoryName } from '@/utils/categoryNames';
import { formatDayLabel, formatPeriodName, periodRange } from '@/utils/format';
import { DEFAULT_CURRENCY, formatMoney } from '@/utils/money';
import { formatShare, groupByDay, summarize } from '@/utils/summary';

/**
 * One category (§4): its total for the period (and its share of everything), its trend, and its
 * transactions grouped by day. Shares the period with Home and Charts; tapping a trend bar or the
 * arrows switches it everywhere. Opened from the ranked bars and from Home's "Top category".
 */
export default function CategoryScreen() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const c = theme.colors;
  const translator = useT();
  const { t, tp, lang } = translator;
  const { id } = useLocalSearchParams<{ id: string }>();
  const categoryId = Number(id);
  const { startDay } = usePeriodSettings();
  const { key, setKey } = useSelectedPeriod();
  const currency = DEFAULT_CURRENCY;

  const load = useCallback(
    async (db: SQLiteDatabase) => {
      const [category, rows] = await Promise.all([getCategory(db, categoryId), listTransactions(db, periodRange(key, startDay))]);
      return { category, rows };
    },
    [categoryId, key, startDay],
  );
  const { data, error } = useDbQuery(load);
  const { points, current } = useSpendTrend(key, categoryId);
  const actions = useTransactionActions();

  const category = data?.category ?? null;
  const isIncome = category?.kind === 'INCOME';
  // Both from the one totals function: everything in the period, and this category's part of it.
  const all = useMemo(() => summarize(data?.rows ?? [], currency, { key, startDay }), [data, currency, key, startDay]);
  const mine = useMemo(() => (data?.rows ?? []).filter((r) => r.category_id === categoryId), [data, categoryId]);
  const own = useMemo(() => summarize(mine, currency, { key, startDay }), [mine, currency, key, startDay]);
  const sections = useMemo(() => groupByDay(mine, currency).map((g) => ({ ...g, data: g.items })), [mine, currency]);

  const total = isIncome ? own.income : own.spent;
  const whole = isIncome ? all.income : all.spent;
  const periodName = formatPeriodName(key, lang);
  const others = own.others.filter((o) => (isIncome ? o.income : o.spent) > 0).map((o) => formatMoney(isIncome ? o.income : o.spent, o.currency));
  const name = category ? categoryName(category, lang) : '';

  if (data && !category) {
    return (
      <View style={[styles.screen, { padding: spacing.lg }]}>
        <Stack.Screen options={{ title: '' }} />
        <Card>
          <AppText tone="muted">{t('category.notFound')}</AppText>
        </Card>
      </View>
    );
  }

  const header = category ? (
    <View style={{ gap: spacing.lg, marginBottom: spacing.xs }}>
      <MonthSwitcher month={key} onChange={setKey} />
      {error ? (
        <Card>
          <AppText tone="danger">{t('home.loadError')}</AppText>
        </Card>
      ) : null}
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <CategoryBadge icon={category.icon} tint={category.tint} size={44} dimmed={category.archived_at !== null} />
          <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${t(isIncome ? 'category.incomeIn' : 'category.spentIn', { period: periodName })}: ${formatMoney(total, currency)}`}>
            <AppText variant="caption" tone="muted">
              {t(isIncome ? 'category.incomeIn' : 'category.spentIn', { period: periodName })}
            </AppText>
            <AppText variant="display" tone={isIncome ? 'success' : 'accent'} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(total, currency)}
            </AppText>
          </View>
        </View>
        <View style={{ gap: 2 }}>
          <AppText variant="caption" tone="muted">
            {[
              whole > 0 ? t(isIncome ? 'category.share.income' : 'category.share.spent', { share: formatShare(total / whole) }) : null,
              tp('count.transactions', own.count),
            ]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
          {others.length > 0 ? (
            <AppText variant="caption" tone="muted">
              {t('home.summary.others', { amounts: others.join(' · ') })}
            </AppText>
          ) : null}
          {category.archived_at ? (
            <AppText variant="caption" tone="muted">
              {`${t('categories.archived')} · ${t('categories.archived.hint')}`}
            </AppText>
          ) : null}
        </View>
      </Card>
      {points ? <SpendTrend points={points} selected={key} current={current} measure={isIncome ? 'income' : 'spent'} currency={currency} onSelect={setKey} /> : null}
      {data && mine.length === 0 ? (
        <Card>
          <AppText variant="caption" tone="muted">
            {t('category.empty', { period: periodName })}
          </AppText>
        </Card>
      ) : null}
    </View>
  ) : undefined;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: name,
          headerRight: category
            ? () => (
                <Touchable
                  onPress={() => router.push({ pathname: '/category/edit', params: { id: String(category.id) } })}
                  accessibilityRole="button"
                  accessibilityLabel={t('screen.editCategory')}
                  hitSlop={8}
                  style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}
                >
                  <Icon name="create-outline" size={20} color={c.text} />
                </Touchable>
              )
            : undefined,
        }}
      />
      <SectionList
        sections={sections}
        keyExtractor={(r) => String(r.id)}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        renderSectionHeader={({ section }) => {
          const day = formatDayLabel(section.date, translator);
          const amount = isIncome ? section.income : section.spent;
          return (
            <View style={styles.sectionHeader}>
              <AppText variant="label" tone="muted" style={{ flex: 1 }}>
                {day}
              </AppText>
              {amount > 0 ? (
                <AppText variant="label" tone={isIncome ? 'success' : 'muted'}>
                  {isIncome ? `+${formatMoney(amount, currency)}` : formatMoney(amount, currency)}
                </AppText>
              ) : null}
            </View>
          );
        }}
        renderItem={({ item }) => actions.renderItem(item)}
      />
      {actions.sheet}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.background },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.sm },
  });
