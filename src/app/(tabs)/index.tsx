import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { BackHandler, Keyboard, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountsToggle } from '@/components/AmountsToggle';
import { AmountText } from '@/components/AmountText';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CategoryBadge } from '@/components/CategoryBadge';
import { Icon } from '@/components/Icon';
import { LegacyOffer } from '@/components/LegacyOffer';
import { LoadError } from '@/components/LoadError';
import { NotificationBell } from '@/components/NotificationBell';
import { PeriodHeader } from '@/components/PeriodHeader';
import { SearchPanel } from '@/components/SearchPanel';
import { Touchable } from '@/components/Touchable';
import { WideHome } from '@/components/wide/WideHome';
import { BRAND } from '@/constants/brand';
import type { Db } from '@/db/db';
import { listTransactions, SEARCH_LIMIT } from '@/db/transactionsRepository';
import { useAmounts, useHideAmountsOnLeave } from '@/hooks/useAmounts';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useHideOnScroll } from '@/hooks/useHideOnScroll';
import { useTransactionActions } from '@/hooks/useTransactionActions';
import { useTransactionSearch } from '@/hooks/useTransactionSearch';
import { useWideLayout } from '@/hooks/useWideLayout';
import { usePeriodSettings, useSelectedPeriod } from '@/hooks/usePeriodSettings';
import { useT } from '@/i18n';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, type Theme } from '@/theme/themes';
import type { TransactionWithCategory } from '@/types/models';
import { categoryName } from '@/utils/categoryNames';
import { formatDayLabel, formatPeriodName, periodRange } from '@/utils/format';
import { DEFAULT_CURRENCY, formatMoney } from '@/utils/money';
import { groupByDay, summarize, totalsByCurrency, type PeriodSummary } from '@/utils/summary';

/**
 * Home (§4): the period header, the summary card (amounts hidden until the eye is tapped), the search
 * field, the period's transactions grouped by day (newest first, day total on the right), and the +
 * button, which slides away while scrolling down. Touching the search field turns search on: the card
 * gives way to a one-line count, date and category chips appear, and the list shows the matches live.
 * Cancel or Back ends it. Swipe a row left for Again · Edit · Delete; long-press for the same in a sheet.
 */
export default function HomeScreen() {
  // Layout E, "Buku kas", on a wide web window (0.6.0, §13.9); the phone layout everywhere else.
  return useWideLayout() ? <WideHome /> : <PhoneHome />;
}

function PhoneHome() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const c = theme.colors;
  const translator = useT();
  const { t, tp } = translator;
  const { startDay, kind: periodKind } = usePeriodSettings();
  const { key, isCurrent } = useSelectedPeriod();
  const currency = DEFAULT_CURRENCY;
  useHideAmountsOnLeave();

  const load = useCallback((db: Db) => listTransactions(db, periodRange(key, startDay)), [key, startDay]);
  const { data, error, reload } = useDbQuery(load);
  const rows = useMemo(() => data ?? [], [data]);
  const summary = useMemo(() => summarize(rows, currency, { key, startDay }), [rows, currency, key, startDay]);

  const search = useTransactionSearch(key, startDay);
  const results = search.results;
  const shownRows = useMemo(() => (search.active ? (results ?? []) : rows), [search.active, results, rows]);
  const sections = useMemo(() => groupByDay(shownRows, currency).map((g) => ({ ...g, data: g.items })), [shownRows, currency]);
  const resultsSpent = useMemo(() => (results ? (totalsByCurrency(results).get(currency)?.spent ?? 0) : 0), [results, currency]);
  // Back ends the search before it leaves Home.
  const { active: searching, exit: exitSearch } = search;
  useFocusEffect(
    useCallback(() => {
      if (!searching) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        Keyboard.dismiss();
        exitSearch();
        return true;
      });
      return () => sub.remove();
    }, [searching, exitSearch]),
  );

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
      <LegacyOffer />
      {error ? (
        <LoadError onRetry={() => void reload()} />
      ) : null}
      {search.active ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
          <AppText variant="label" tone="muted" accessibilityLiveRegion="polite">
            {results === null
              ? ' '
              : [tp('count.transactions', results.length), resultsSpent > 0 ? t('search.spent', { amount: formatMoney(resultsSpent, currency) }) : null]
                  .filter(Boolean)
                  .join(' · ') + (results.length >= SEARCH_LIMIT ? ` · ${t('search.capped', { count: SEARCH_LIMIT })}` : '')}
          </AppText>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
          <SummaryCard summary={summary} caption={isCurrent ? t(periodKind === 'month' ? 'home.this.month' : 'home.this.period') : formatPeriodName(key, translator.lang)} onCountPress={scrollToList} />
        </Animated.View>
      )}
      <Animated.View layout={LinearTransition.duration(200)}>
        <SearchPanel search={search} />
      </Animated.View>
      {search.active && results && results.length === 0 ? (
        <Card>
          <AppText tone="muted">{t('search.none')}</AppText>
        </Card>
      ) : null}
      {!search.active && data && rows.length === 0 ? (
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
              await Promise.all([reload(), search.reload()]);
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
 * The dashboard card (§4, since 0.3.0): the period → **Spent | Income** side by side at the same size
 * (TangTu tracks both) → a small "left" line → other currencies (not in totals) → Top category · Daily
 * average · Transactions. "Left" shows only once there is income in the period: without it, it would just
 * be minus the spending (§5, owner). Over the income it reads calmly, never red. Every amount follows
 * the eye; screen readers hear "hidden" while it's closed. The stats are buttons: the top category opens
 * its screen, the average opens Charts, the count scrolls to the list.
 */
function SummaryCard({ summary: s, caption, onCountPress }: { summary: PeriodSummary; caption: string; onCountPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t, tp, lang } = useT();
  const { spoken } = useAmounts();
  const top = s.byCategory[0] ?? null;
  const showLeft = s.income > 0;
  const leftText = (f: (n: number, c: typeof s.currency) => string) =>
    s.left >= 0 ? t('home.summary.left', { amount: f(s.left, s.currency) }) : t('home.summary.over', { amount: f(-s.left, s.currency) });
  const others = s.others
    .flatMap((o) => [o.spent > 0 ? formatMoney(o.spent, o.currency) : null, o.income > 0 ? `+${formatMoney(o.income, o.currency)}` : null])
    .filter((x): x is string => x !== null);

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <AppText variant="label" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
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
        accessibilityLabel={[
          caption,
          `${t('home.summary.spent')}: ${spoken(s.spent, s.currency)}`,
          `${t('home.summary.income')}: ${spoken(s.income, s.currency)}`,
          showLeft ? leftText(spoken) : null,
        ]
          .filter(Boolean)
          .join('. ')}
        style={{ gap: spacing.sm }}
      >
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={styles.total}>
            <AppText variant="caption" tone="muted">
              {t('home.summary.spent')}
            </AppText>
            <AmountText variant="title" tone="accent" numberOfLines={1} adjustsFontSizeToFit>
              {(f) => f(s.spent, s.currency)}
            </AmountText>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.total}>
            <AppText variant="caption" tone="muted">
              {t('home.summary.income')}
            </AppText>
            <AmountText variant="title" tone={s.income > 0 ? 'success' : 'muted'} numberOfLines={1} adjustsFontSizeToFit>
              {(f) => f(s.income, s.currency)}
            </AmountText>
          </View>
        </View>
        {showLeft ? (
          <AmountText variant="caption" tone="muted">
            {(f) => leftText(f)}
          </AmountText>
        ) : null}
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
    total: { flex: 1, gap: 2 },
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
