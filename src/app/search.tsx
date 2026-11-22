import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { CategoryBadge } from '@/components/CategoryBadge';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { Touchable } from '@/components/Touchable';
import { listUsedCategories, searchTransactions, SEARCH_LIMIT } from '@/db/transactionsRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useTransactionActions } from '@/hooks/useTransactionActions';
import { useT } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, type Theme } from '@/theme/themes';
import { categoryName, nameMatches } from '@/utils/categoryNames';
import { formatDayLabel } from '@/utils/format';
import { formatMoney } from '@/utils/money';
import { groupByDay, totalsByCurrency } from '@/utils/summary';

/**
 * Search (§5): by note or category name (in either language), narrowed by category chips. Results
 * from all time, newest first and grouped by day, with the same row actions as Home. The line on top
 * counts them and adds up their spending in the default currency.
 */
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const c = theme.colors;
  const translator = useT();
  const { t, tp, lang } = translator;
  const currency = useAppStore((s) => s.defaultCurrency);
  const actions = useTransactionActions();

  const [text, setText] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  // Typing stays smooth: the query follows the text a beat behind.
  const query = useDeferredValue(text.trim());

  const { data: categories = [] } = useDbQuery(listUsedCategories);
  const nameMatchIds = useMemo(() => (query ? categories.filter((cat) => nameMatches(cat, query)).map((cat) => cat.id) : []), [categories, query]);
  const active = query.length > 0 || picked.length > 0;

  const load = useCallback(
    (db: SQLiteDatabase) => (active ? searchTransactions(db, { text: query, nameMatchIds, categoryIds: picked }) : Promise.resolve([])),
    [active, query, nameMatchIds, picked],
  );
  const { data } = useDbQuery(load);
  const rows = useMemo(() => data ?? [], [data]);
  const sections = useMemo(() => groupByDay(rows, currency).map((g) => ({ ...g, data: g.items })), [rows, currency]);
  const spent = useMemo(() => totalsByCurrency(rows).get(currency)?.spent ?? 0, [rows, currency]);

  const toggle = (id: number) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.xs }}>
      <TextField
        value={text}
        onChangeText={setText}
        placeholder={t('search.placeholder')}
        accessibilityLabel={t('screen.search')}
        autoFocus
        returnKeyType="search"
        autoCorrect={false}
        leading={<Icon name="search-outline" size={18} color={c.textMuted} />}
        trailing={
          text ? (
            <Touchable onPress={() => setText('')} accessibilityRole="button" accessibilityLabel={t('search.clear')} hitSlop={10}>
              <Icon name="close-circle" size={18} color={c.textMuted} />
            </Touchable>
          ) : null
        }
      />
      {categories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
          accessibilityLabel={t('search.filter.hint')}
        >
          {categories.map((cat) => {
            const on = picked.includes(cat.id);
            return (
              <Touchable
                key={cat.id}
                onPress={() => toggle(cat.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={categoryName(cat, lang)}
                style={({ pressed }) => [styles.chip, on && styles.chipOn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <CategoryBadge icon={cat.icon} tint={cat.tint} size={22} dimmed={cat.archived_at !== null} />
                <AppText variant="label" numberOfLines={1} style={{ color: on ? c.onPrimary : c.text }}>
                  {categoryName(cat, lang)}
                </AppText>
              </Touchable>
            );
          })}
        </ScrollView>
      ) : null}
      {!active ? (
        <AppText variant="caption" tone="muted">
          {t('search.hint')}
        </AppText>
      ) : data && rows.length === 0 ? (
        <Card>
          <AppText tone="muted">{t('search.none')}</AppText>
        </Card>
      ) : rows.length > 0 ? (
        <AppText variant="label" tone="muted" accessibilityLiveRegion="polite">
          {[tp('count.transactions', rows.length), spent > 0 ? t('search.spent', { amount: formatMoney(spent, currency) }) : null].filter(Boolean).join(' · ')}
          {rows.length >= SEARCH_LIMIT ? ` · ${t('search.capped', { count: SEARCH_LIMIT })}` : ''}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <SectionList
        sections={active ? sections : []}
        keyExtractor={(r) => String(r.id)}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <AppText variant="label" tone="muted">
              {formatDayLabel(section.date, translator)}
            </AppText>
          </View>
        )}
        renderItem={({ item }) => actions.renderItem(item)}
      />
      {actions.sheet}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.background },
    sectionHeader: { paddingTop: spacing.md, paddingBottom: spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      paddingLeft: 6,
      paddingRight: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    chipOn: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  });
