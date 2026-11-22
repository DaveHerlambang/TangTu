import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { CategoryBadge } from '@/components/CategoryBadge';
import { Icon } from '@/components/Icon';
import { Touchable } from '@/components/Touchable';
import { FALLBACK_ICON } from '@/constants/categories';
import { usePeriodSettings } from '@/hooks/usePeriodSettings';
import { useT } from '@/i18n';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Theme } from '@/theme/themes';
import { categoryName } from '@/utils/categoryNames';
import { formatPeriodName } from '@/utils/format';
import { formatMoney } from '@/utils/money';
import { formatShare, rankCategories, type CategoryShare, type PeriodSummary } from '@/utils/summary';

const BAR_HEIGHT = 8;

interface CategoryBreakdownProps {
  summary: PeriodSummary;
  /** The period on screen, and whether it's the current one ("this month" vs "in September"). */
  period: string;
  isCurrent: boolean;
}

/**
 * "Where did it go" (§9.1): one row per expense category, largest first — badge · name · bar ·
 * amount · % of spent. The top 7, then "Other" (tap to unfold the rest). The line above names the
 * biggest one. Default currency only; other currencies are listed underneath as not counted.
 */
export function CategoryBreakdown({ summary, period, isCurrent }: CategoryBreakdownProps) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, tp, lang } = useT();
  const { kind } = usePeriodSettings();
  const [expanded, setExpanded] = useState(false);
  const ranking = useMemo(() => rankCategories(summary), [summary]);
  const periodName = formatPeriodName(period, lang);

  const leftOut = summary.others.filter((o) => o.spent > 0).map((o) => formatMoney(o.spent, o.currency));
  const first = ranking.top[0];
  const max = first?.spent ?? 1;

  const headline = first
    ? t(isCurrent ? (kind === 'month' ? 'charts.where.headline.current.month' : 'charts.where.headline.current.period') : 'charts.where.headline.past', {
        category: categoryName(first.category, lang),
        share: formatShare(first.share),
        period: periodName,
      })
    : t('charts.none', { period: periodName });

  const bar = (spent: number, share: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(2, (spent / max) * 100)}%` }]} />
      </View>
      <AppText variant="caption" tone="muted" style={styles.share}>
        {share}
      </AppText>
    </View>
  );

  const row = (item: CategoryShare) => {
    const name = categoryName(item.category, lang);
    const amount = formatMoney(item.spent, summary.currency);
    const share = formatShare(item.share);
    return (
      <Touchable
        key={item.category.id}
        onPress={() => router.push({ pathname: '/category/[id]', params: { id: String(item.category.id) } })}
        accessibilityRole="button"
        accessibilityLabel={t('charts.where.row', { category: name, amount, share })}
        accessibilityHint={t('charts.where.row.hint')}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
      >
        <CategoryBadge icon={item.category.icon} tint={item.category.tint} size={32} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.nameLine}>
            <AppText variant="label" numberOfLines={1} style={{ flex: 1 }}>
              {name}
            </AppText>
            <AppText variant="label" numberOfLines={1}>
              {amount}
            </AppText>
          </View>
          {bar(item.spent, share)}
        </View>
      </Touchable>
    );
  };

  const otherShare = summary.spent > 0 ? ranking.restSpent / summary.spent : 0;
  const otherName = t('charts.where.other');
  const otherAmount = formatMoney(ranking.restSpent, summary.currency);

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <AppText variant="caption" tone="muted">
          {t('charts.where.title')}
        </AppText>
        <AppText variant="label">{headline}</AppText>
      </View>

      {ranking.top.length > 0 ? (
        <View style={{ gap: spacing.xs }}>
          {ranking.top.map(row)}
          {ranking.rest.length > 0 && !expanded ? (
            <Touchable
              onPress={() => setExpanded(true)}
              accessibilityRole="button"
              accessibilityState={{ expanded: false }}
              accessibilityLabel={`${t('charts.where.row', { category: otherName, amount: otherAmount, share: formatShare(otherShare) })}, ${tp('count.categories', ranking.rest.length)}`}
              accessibilityHint={t('charts.where.other.hint')}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
            >
              <CategoryBadge icon={FALLBACK_ICON} tint="slate" size={32} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.nameLine}>
                  <AppText variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {otherName}
                  </AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                    {tp('count.categories', ranking.rest.length)}
                  </AppText>
                  <AppText variant="label" numberOfLines={1}>
                    {otherAmount}
                  </AppText>
                </View>
                {bar(ranking.restSpent, formatShare(otherShare))}
              </View>
              <Icon name="chevron-down" size={16} color={c.textMuted} />
            </Touchable>
          ) : null}
          {expanded ? (
            <>
              {ranking.rest.map(row)}
              <Touchable
                onPress={() => setExpanded(false)}
                accessibilityRole="button"
                accessibilityState={{ expanded: true }}
                hitSlop={8}
                style={({ pressed }) => [styles.less, { opacity: pressed ? 0.6 : 1 }]}
              >
                <AppText variant="caption" style={{ color: c.primaryText }}>
                  {t('charts.where.showLess')}
                </AppText>
                <Icon name="chevron-up" size={14} color={c.primaryText} />
              </Touchable>
            </>
          ) : null}
        </View>
      ) : null}

      {leftOut.length > 0 ? (
        <AppText variant="caption" tone="muted">
          {t('charts.where.leftOut', { amounts: leftOut.join(' · ') })}
        </AppText>
      ) : null}
    </Card>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, paddingVertical: spacing.xs },
    nameLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
    track: { flex: 1, height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, backgroundColor: t.colors.track, overflow: 'hidden' },
    fill: { height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, backgroundColor: t.colors.accent },
    // Room for "100%" at 1.3× without the bars shifting from row to row.
    share: { minWidth: 40, textAlign: 'right' },
    less: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 32 },
  });
