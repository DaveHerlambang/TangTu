import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountsToggle } from '@/components/AmountsToggle';
import { AmountText } from '@/components/AmountText';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CategoryBadge } from '@/components/CategoryBadge';
import { Icon } from '@/components/Icon';
import { NotificationBell } from '@/components/NotificationBell';
import { PeriodHeader } from '@/components/PeriodHeader';
import { Touchable } from '@/components/Touchable';
import { BRAND } from '@/constants/brand';
import { listTransactions } from '@/db/transactionsRepository';
import { useAmounts, useHideAmountsOnLeave } from '@/hooks/useAmounts';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useHideOnScroll } from '@/hooks/useHideOnScroll';
import { useTransactionActions } from '@/hooks/useTransactionActions';
import { usePeriodSettings, useSelectedPeriod } from '@/hooks/usePeriodSettings';
import { useT } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, type Theme } from '@/theme/themes';
import type { TransactionWithCategory } from '@/types/models';
import { categoryName } from '@/utils/categoryNames';
import { formatDayLabel, periodRange } from '@/utils/format';
import { formatMoney } from '@/utils/money';
import { groupByDay, summarize, type PeriodSummary } from '@/utils/summary';

/**
 * Home (§4): the period header, the summary card (amounts hidden until the eye is tapped), the
 * period's transactions grouped by day (newest first, day total on the right), and the + button,
 * which slides away while scrolling down. Swipe a row left for Again · Edit · Delete; long-press for
 * the same actions in a sheet.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const c = theme.colors;
  const translator = useT();
  const { t } = translator;
  const { startDay, kind: periodKind } = usePeriodSettings();
  const { key } = useSelectedPeriod();
  const currency = useAppStore((s) => s.defaultCurrency);
  useHideAmountsOnLeave();

  const load = useCallback((db: SQLiteDatabase) => listTransactions(db, periodRange(key, startDay)), [key, startDay]);
  const { data, error, reload } = useDbQuery(load);
  const rows = useMemo(() => data ?? [], [data]);
  const summary = useMemo(() => summarize(rows, currency, { key, startDay }), [rows, currency, key, startDay]);
  const sections = useMemo(() => groupByDay(rows, currency).map((g) => ({ ...g, data: g.items })), [rows, currency]);

  const fab = useHideOnScroll();
  const [refreshing, setRefreshing] = useState(false);
  const actions = useTransactionActions();
  const list = useRef<SectionList<TransactionWithCategory, (typeof sections)[number]>>(null);

  /** The Transactions stat: bring the first day of the list to the top. */
  const scrollToList = () => {
    if (sections.length > 0) list.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, viewOffset: insets.top + spacing.md, animated: true });
  };

  const header = (
    <View style={{ gap: spacing.lg, marginBottom: spacing.xs }}>
      <PeriodHeader
        caption={BRAND.name}
        right={
          <>
          <Touchable
            onPress={() => router.push('/search')}
            accessibilityRole="button"
            accessibilityLabel={t('home.search')}
            hitSlop={6}
            style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Icon name="search-outline" size={18} color={c.text} />
          </Touchable>
          <NotificationBell />
          <Touchable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel={t('home.settings')}
            hitSlop={6}
            style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Icon name="settings-outline" size={18} color={c.text} />
          </Touchable>
          </>
        }
      />
      {error ? (
        <Card>
          <AppText tone="danger">{t('home.loadError', { message: error.message })}</AppText>
        </Card>
      ) : null}
      <SummaryCard summary={summary} onCountPress={scrollToList} />
      {data && rows.length === 0 ? (
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={styles.emptyIcon}>
              <Icon name="wallet-outline" size={20} color={c.text} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="heading">{t(periodKind === 'month' ? 'home.empty.title.month' : 'home.empty.title.period')}</AppText>
              <AppText variant="caption" tone="muted">
                {t('home.empty.body')}
              </AppText>
            </View>
          </View>
          <Button label={t('home.empty.action')} kind="soft" icon="add" onPress={() => router.push('/transaction/new')} />
        </Card>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <SectionList
        ref={list}
        sections={sections}
        keyExtractor={(r) => String(r.id)}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: 110 }}
        onScroll={fab.onScroll}
        scrollEventThrottle={fab.scrollEventThrottle}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[c.primaryText]}
            tintColor={c.primaryText}
            progressBackgroundColor={c.surface}
            onRefresh={async () => {
              setRefreshing(true);
              await reload();
              setRefreshing(false);
            }}
          />
        }
        renderSectionHeader={({ section }) => {
          const day = formatDayLabel(section.date, translator);
          const total = section.spent > 0 ? formatMoney(section.spent, currency) : section.income > 0 ? `+${formatMoney(section.income, currency)}` : null;
          return (
            <View
              style={styles.sectionHeader}
              accessible
              accessibilityRole="header"
              accessibilityLabel={
                section.spent > 0
                  ? t('home.dayTotal', { day, amount: formatMoney(section.spent, currency) })
                  : section.income > 0
                    ? t('home.dayIncome', { day, amount: formatMoney(section.income, currency) })
                    : day
              }
            >
              <AppText variant="label" tone="muted" style={{ flex: 1 }}>
                {day}
              </AppText>
              {total ? (
                <AppText variant="label" tone={section.spent > 0 ? 'muted' : 'success'}>
                  {total}
                </AppText>
              ) : null}
            </View>
          );
        }}
        renderItem={({ item }) => actions.renderItem(item)}
      />

      <Animated.View style={[styles.fabSlot, { bottom: spacing.lg }, fab.style]}>
        <Touchable
          onPress={() => router.push('/transaction/new')}
          accessibilityRole="button"
          accessibilityLabel={t('home.add')}
          style={({ pressed }) => [styles.fab, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
        >
          <Icon name="add" size={28} color={c.onPrimary} />
        </Touchable>
      </Animated.View>

      {actions.sheet}
    </View>
  );
}

// ---------------------------------------------------------------------------

/**
 * TracKar's dashboard card (§4): "Spent this month" + eye + Details → the big number in the money
 * colour → income · left → other currencies (not in totals) → Top category · Daily average · Transactions.
 * Every amount here follows the eye; screen readers hear "hidden" while it's closed. The stats are
 * buttons: the top category opens its screen, the average opens Charts, the count scrolls to the list.
 */
function SummaryCard({ summary: s, onCountPress }: { summary: PeriodSummary; onCountPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t, tp, lang } = useT();
  const { spoken } = useAmounts();
  const { kind } = usePeriodSettings();
  const top = s.byCategory[0] ?? null;
  const caption = t(kind === 'month' ? 'home.spentThis.month' : 'home.spentThis.period');
  const others = s.others
    .flatMap((o) => [o.spent > 0 ? formatMoney(o.spent, o.currency) : null, o.income > 0 ? `+${formatMoney(o.income, o.currency)}` : null])
    .filter((x): x is string => x !== null);

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <AppText variant="label" tone="muted" style={{ flex: 1 }}>
          {caption}
        </AppText>
        <AmountsToggle variant="pill" />
        <Touchable
          onPress={() => router.navigate('/charts')}
          accessibilityRole="button"
          hitSlop={{ top: 11, bottom: 11, left: 4, right: 8 }}
          style={({ pressed }) => [styles.detailsPill, { opacity: pressed ? 0.7 : 1 }]}
        >
          <AppText variant="caption" style={{ color: theme.colors.primaryText }}>
            {t('home.details')}
          </AppText>
          <Icon name="chevron-forward" size={12} color={theme.colors.primaryText} />
        </Touchable>
      </View>

      <View
        accessible
        accessibilityLabel={`${caption}: ${spoken(s.spent, s.currency)}. ${t('home.summary.incomeLeft', {
          income: spoken(s.income, s.currency),
          left: spoken(s.left, s.currency),
        })}`}
        style={{ gap: 2 }}
      >
        <AmountText variant="display" tone="accent" numberOfLines={1} adjustsFontSizeToFit>
          {(f) => f(s.spent, s.currency)}
        </AmountText>
        <AmountText variant="caption" tone="muted">
          {(f) => t('home.summary.incomeLeft', { income: f(s.income, s.currency), left: f(s.left, s.currency) })}
        </AmountText>
        {others.length > 0 ? (
          <AppText variant="caption" tone="muted">
            {t('home.summary.others', { amounts: others.join(' · ') })}
          </AppText>
        ) : null}
      </View>

      <View style={styles.stats}>
        <Touchable
          disabled={!top}
          onPress={() => top && router.push({ pathname: '/category/[id]', params: { id: String(top.category.id) } })}
          accessibilityRole="button"
          accessibilityLabel={`${t('home.stat.top')}: ${top ? categoryName(top.category, lang) : t('home.stat.top.none')}`}
          accessibilityHint={top ? t('home.stat.top.hint') : undefined}
          style={({ pressed }) => [styles.stat, { opacity: pressed ? 0.6 : 1 }]}
        >
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {t('home.stat.top')}
          </AppText>
          {top ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CategoryBadge icon={top.category.icon} tint={top.category.tint} size={22} />
              <AppText variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                {categoryName(top.category, lang)}
              </AppText>
            </View>
          ) : (
            <AppText variant="label" tone="muted">
              {t('home.stat.top.none')}
            </AppText>
          )}
        </Touchable>
        <View style={styles.vDivider} />
        <Touchable
          onPress={() => router.navigate('/charts')}
          accessibilityRole="button"
          accessibilityLabel={`${t('home.stat.average')}: ${spoken(s.dailyAverage, s.currency)}`}
          accessibilityHint={t('home.stat.average.hint')}
          style={({ pressed }) => [styles.stat, { opacity: pressed ? 0.6 : 1 }]}
        >
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {t('home.stat.average')}
          </AppText>
          <AmountText variant="label" numberOfLines={1} adjustsFontSizeToFit>
            {(f) => f(s.dailyAverage, s.currency)}
          </AmountText>
        </Touchable>
        <View style={styles.vDivider} />
        <Touchable
          disabled={s.count === 0}
          onPress={onCountPress}
          accessibilityRole="button"
          accessibilityLabel={tp('count.transactions', s.count)}
          accessibilityHint={s.count > 0 ? t('home.stat.count.hint') : undefined}
          style={({ pressed }) => [styles.stat, { opacity: pressed ? 0.6 : 1 }]}
        >
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {t('home.stat.count')}
          </AppText>
          <AppText variant="label">{s.count}</AppText>
        </Touchable>
      </View>
    </Card>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.background },
    headerButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    detailsPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      minHeight: 22,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: t.colors.track,
    },
    stats: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    stat: { flex: 1, gap: 4, justifyContent: 'center' },
    vDivider: { width: 1, backgroundColor: t.colors.border },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.sm },
    emptyIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.track,
    },
    fabSlot: { position: 'absolute', right: spacing.lg },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0px 8px 18px ${t.colors.shadow}`,
    },
  });
