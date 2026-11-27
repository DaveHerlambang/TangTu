import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ScrollView, StyleSheet, View, type TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountsToggle } from '@/components/AmountsToggle';
import { AmountText } from '@/components/AmountText';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CategoryBadge } from '@/components/CategoryBadge';
import { Icon, type IconName } from '@/components/Icon';
import { LoadError } from '@/components/LoadError';
import { NotificationBell } from '@/components/NotificationBell';
import { PeriodHeader } from '@/components/PeriodHeader';
import { useSearchRangeLabel } from '@/components/SearchPanel';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { Touchable } from '@/components/Touchable';
import { BRAND } from '@/constants/brand';
import { listCategoriesByUse } from '@/db/categoriesRepository';
import type { Db } from '@/db/db';
import { NOTE_MAX_LENGTH, SEARCH_LIMIT, createTransaction, deleteTransaction, listTransactions } from '@/db/transactionsRepository';
import { useHideAmountsOnLeave } from '@/hooks/useAmounts';
import { useDbQuery } from '@/hooks/useDbQuery';
import { usePeriodSettings, useSelectedPeriod } from '@/hooks/usePeriodSettings';
import { useTransactionActions } from '@/hooks/useTransactionActions';
import { useTransactionSearch, type TransactionSearch } from '@/hooks/useTransactionSearch';
import { useT } from '@/i18n';
import { formatTime } from '@/i18n/dates';
import { useAppStore } from '@/store/useAppStore';
import { showAlert } from '@/store/useDialogStore';
import { showToast } from '@/store/useToastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, spacing, type Theme } from '@/theme/themes';
import { CATEGORY_KINDS, type CategoryKind, type Id, type TransactionWithCategory } from '@/types/models';
import { categoryName } from '@/utils/categoryNames';
import { errorAlert } from '@/utils/errorMessage';
import { formatDayLabel, formatPeriodName, localDayKey, parseDayKey, periodLastDay, periodRange, periodStart } from '@/utils/format';
import { DEFAULT_CURRENCY, currencySymbol, formatMoney, formatQuickAmount } from '@/utils/money';
import { SEARCH_RANGE_CHOICES } from '@/utils/searchRange';
import { groupByDay, summarize, totalsByCurrency, type PeriodSummary } from '@/utils/summary';

const currency = DEFAULT_CURRENCY;
const invalidate = () => useAppStore.getState().invalidateData();
/** Rupiah has no decimals; twelve digits is the number pad's limit too (§4). */
const MAX_DIGITS = 12;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Layout E, "Buku kas" (0.6.0, §13.9; owner, 2026-11-26): Home on a wide web window. The filters stay on the left
 * (search text, dates, categories); on the right, the period with the bell and Settings, the totals in one line,
 * a quick-entry row (Expense | Income · amount · category · note · day · Save, all by keyboard: Tab between
 * fields, Enter saves and returns to the amount), and the transactions as a table grouped by day. A row opens the
 * editor; Again · Edit · Delete sit at the end of each row. Same rules as the phone: Undo after every change,
 * Delete asks first.
 */
export function WideHome() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const translator = useT();
  const { t, tp } = translator;
  const { startDay, kind: periodKind } = usePeriodSettings();
  const { key, isCurrent } = useSelectedPeriod();
  useHideAmountsOnLeave();

  const load = useCallback((db: Db) => listTransactions(db, periodRange(key, startDay)), [key, startDay]);
  const { data, error, reload } = useDbQuery(load);
  const rows = useMemo(() => data ?? [], [data]);
  const summary = useMemo(() => summarize(rows, currency, { key, startDay }), [rows, key, startDay]);

  const search = useTransactionSearch(key, startDay, { panel: true });
  const results = search.results;
  const shownRows = useMemo(() => (search.filtered ? (results ?? []) : rows), [search.filtered, results, rows]);
  const days = useMemo(() => groupByDay(shownRows, currency), [shownRows]);
  const resultsSpent = useMemo(() => (results ? (totalsByCurrency(results).get(currency)?.spent ?? 0) : 0), [results]);
  const actions = useTransactionActions();
  const amountRef = useRef<TextInputInstance>(null);

  const caption = isCurrent ? t(periodKind === 'month' ? 'home.this.month' : 'home.this.period') : formatPeriodName(key, translator.lang);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FilterPanel search={search} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <PeriodHeader
            caption={BRAND.name}
            right={
              <>
                <NotificationBell />
                <Touchable
                  onPress={() => router.push('/settings')}
                  accessibilityRole="button"
                  accessibilityLabel={t('home.settings')}
                  style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Icon name="settings-outline" size={18} color={c.text} />
                </Touchable>
              </>
            }
          />

          {error ? <LoadError onRetry={() => void reload()} /> : null}

          {search.filtered ? (
            <AppText variant="label" tone="muted" accessibilityLiveRegion="polite" style={styles.totals}>
              {results === null
                ? ' '
                : [tp('count.transactions', results.length), resultsSpent > 0 ? t('search.spent', { amount: formatMoney(resultsSpent, currency) }) : null]
                    .filter(Boolean)
                    .join(' · ') + (results.length >= SEARCH_LIMIT ? ` · ${t('search.capped', { count: SEARCH_LIMIT })}` : '')}
            </AppText>
          ) : (
            <TotalsLine summary={summary} caption={caption} />
          )}

          <QuickEntry amountRef={amountRef} />

          <View style={styles.table} accessibilityRole="list">
            {days.map((day) => (
              <View key={day.date.toISOString()}>
                <DayHeader date={day.date} spent={day.spent} income={day.income} />
                {day.items.map((item) => (
                  <Row key={String(item.id)} item={item} actions={actions} />
                ))}
              </View>
            ))}
            {search.filtered && results && results.length === 0 ? (
              <AppText tone="muted" style={{ padding: spacing.lg }}>
                {t('search.none')}
              </AppText>
            ) : null}
            {!search.filtered && data && rows.length === 0 ? (
              <View style={{ padding: spacing.lg, gap: spacing.xs }}>
                <AppText variant="heading">{t(periodKind === 'month' ? 'home.empty.title.month' : 'home.empty.title.period')}</AppText>
                <AppText variant="caption" tone="muted">
                  {t('home.empty.body')}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------

/** The summary card of the phone, as one line (§13.9): spent · income · left · count, the eye, Details. */
function TotalsLine({ summary: s, caption }: { summary: PeriodSummary; caption: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, tp } = useT();
  const dot = (
    <AppText variant="label" tone="muted">
      ·
    </AppText>
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm, rowGap: spacing.xs }}>
      <AppText variant="label" tone="muted">
        {caption}
      </AppText>
      {dot}
      <AppText variant="label" tone="muted">
        {t('home.summary.spent')}
      </AppText>
      <AmountText variant="heading" tone="accent">
        {(f) => f(s.spent, s.currency)}
      </AmountText>
      {dot}
      <AppText variant="label" tone="muted">
        {t('home.summary.income')}
      </AppText>
      <AmountText variant="heading" tone={s.income > 0 ? 'success' : 'muted'}>
        {(f) => f(s.income, s.currency)}
      </AmountText>
      {s.income > 0 ? (
        <>
          {dot}
          <AmountText variant="label" tone="muted">
            {(f) => (s.left >= 0 ? t('home.summary.left', { amount: f(s.left, s.currency) }) : t('home.summary.over', { amount: f(-s.left, s.currency) }))}
          </AmountText>
        </>
      ) : null}
      {dot}
      <AppText variant="label" tone="muted">
        {tp('count.transactions', s.count)}
      </AppText>
      <View style={{ flex: 1 }} />
      <AmountsToggle variant="pill" />
      <Touchable
        onPress={() => router.navigate('/charts')}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          minHeight: 22,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.pill,
          backgroundColor: c.track,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <AppText variant="caption" style={{ color: c.primaryText }}>
          {t('home.details')}
        </AppText>
        <Icon name="chevron-forward" size={12} color={c.primaryText} />
      </Touchable>
    </View>
  );
}

// ---------------------------------------------------------------------------

/** A plain field look for the browser's own controls (select, date), matching `TextField`. */
function fieldStyle(theme: Theme, focused: boolean, missing = false): CSSProperties {
  const c = theme.colors;
  return {
    height: 46,
    boxSizing: 'border-box',
    padding: '0 12px',
    borderRadius: radius.md,
    border: `1.5px solid ${focused || missing ? c.primary : c.border}`,
    backgroundColor: c.surface,
    color: c.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    outline: 'none',
    colorScheme: theme.isDark ? 'dark' : 'light',
  };
}

/**
 * The quick-entry row (§13.9). Saving keeps the kind, the category and the day (the next entry is often alike)
 * and empties the amount and the note, with the cursor back in the amount. Missing parts: the field gets the
 * focus and a calm line says what to do, as on the phone.
 */
function QuickEntry({ amountRef }: { amountRef: React.RefObject<TextInputInstance | null> }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const translator = useT();
  const { t, lang } = translator;
  const [kind, setKind] = useState<CategoryKind>('EXPENSE');
  const [digits, setDigits] = useState('');
  const [categoryId, setCategoryId] = useState<Id | null>(null);
  const [note, setNote] = useState('');
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<'amount' | 'category' | null>(null);
  const [focus, setFocus] = useState<'category' | 'day' | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  const loadCategories = useCallback((d: Db) => listCategoriesByUse(d, kind), [kind]);
  const { data: active, db } = useDbQuery(loadCategories);
  const categories = useMemo(() => (active ?? []).filter((cat) => cat.kind === kind), [active, kind]);
  const category = categories.find((cat) => cat.id === categoryId) ?? null;
  const amount = digits ? Number(digits) : 0;

  // A category made through "New" is selected when we come back (as in the phone form).
  useFocusEffect(
    useCallback(() => {
      const id = useAppStore.getState().pickedCategoryId;
      if (id !== null) {
        useAppStore.getState().setPickedCategoryId(null);
        setCategoryId(id);
      }
    }, []),
  );

  if ((missing === 'amount' && amount > 0) || (missing === 'category' && category !== null)) setMissing(null);

  const save = async () => {
    if (busy) return;
    if (amount === 0) {
      setMissing('amount');
      amountRef.current?.focus();
      return;
    }
    if (!category) {
      setMissing('category');
      selectRef.current?.focus();
      return;
    }
    setBusy(true);
    const now = new Date();
    try {
      const id = await createTransaction(db, {
        kind,
        amount,
        currency,
        categoryId: category.id,
        note,
        occurredAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()).toISOString(),
      });
      invalidate();
      showToast({
        message: t('toast.tx.added', { amount: formatMoney(amount, currency), category: categoryName(category, lang) }),
        actionLabel: t('common.undo'),
        onAction: async () => {
          await deleteTransaction(db, id).catch(() => {});
          invalidate();
        },
      });
      setDigits('');
      setNote('');
      amountRef.current?.focus();
    } catch (e) {
      const { title, message } = errorAlert(e, translator);
      showAlert(title, message);
    } finally {
      setBusy(false);
    }
  };
  const onEnter = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void save();
    }
  };

  return (
    <Card style={{ gap: spacing.sm }}>
      <AppText variant="label" tone="muted">
        {t('screen.newTransaction')}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
        <View style={{ width: 180 }}>
          <SegmentedControl
            options={CATEGORY_KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))}
            value={kind}
            onChange={(k) => {
              if (k === kind) return;
              setKind(k);
              setCategoryId(null);
            }}
          />
        </View>
        <TextField
          ref={amountRef}
          style={[{ width: 150 }, missing === 'amount' ? { borderColor: c.primary } : null]}
          value={digits ? formatQuickAmount(amount, currency) : ''}
          onChangeText={(v) => setDigits(v.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS))}
          onSubmitEditing={() => void save()}
          inputMode="numeric"
          placeholder="0"
          accessibilityLabel={t('tx.amount')}
          leading={
            <AppText variant="label" tone="muted">
              {currencySymbol(currency)}
            </AppText>
          }
          autoFocus
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <select
            ref={selectRef}
            aria-label={t('tx.category')}
            value={category ? String(category.id) : ''}
            onChange={(e) => setCategoryId(e.target.value || null)}
            onKeyDown={onEnter}
            onFocus={() => setFocus('category')}
            onBlur={() => setFocus(null)}
            style={{ ...fieldStyle(theme, focus === 'category', missing === 'category'), width: 180 }}
          >
            <option value="" disabled>
              {t('wide.entry.category')}
            </option>
            {categories.map((cat) => (
              <option key={String(cat.id)} value={String(cat.id)}>
                {categoryName(cat, lang)}
              </option>
            ))}
          </select>
          <Touchable
            onPress={() => router.push({ pathname: '/category/edit', params: { kind, pick: '1' } })}
            accessibilityRole="button"
            accessibilityLabel={t('screen.newCategory')}
            style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.track, opacity: pressed ? 0.7 : 1 })}
          >
            <Icon name="add" size={18} color={c.text} />
          </Touchable>
        </View>
        <TextField
          style={{ flex: 1, minWidth: 140 }}
          value={note}
          onChangeText={setNote}
          onSubmitEditing={() => void save()}
          maxLength={NOTE_MAX_LENGTH}
          placeholder={t('tx.note.placeholder')}
          accessibilityLabel={t('tx.note')}
        />
        <input
          type="date"
          aria-label={t('wide.entry.day')}
          value={localDayKey(day)}
          onChange={(e) => {
            const picked = parseDayKey(e.target.value);
            if (picked) setDay(picked);
          }}
          onKeyDown={onEnter}
          onFocus={() => setFocus('day')}
          onBlur={() => setFocus(null)}
          style={{ ...fieldStyle(theme, focus === 'day'), width: 150 }}
        />
        <Button label={t('common.save')} onPress={() => void save()} loading={busy} />
      </View>
      <AppText variant="caption" tone="muted" accessibilityLiveRegion="polite">
        {missing === 'amount'
          ? t('tx.amount.needed')
          : missing === 'category'
            ? categories.length === 0 && active !== undefined
              ? t('tx.noCategories')
              : t('tx.category.needed')
            : t('wide.entry.hint')}
      </AppText>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function DayHeader({ date, spent, income }: { date: Date; spent: number; income: number }) {
  const { theme } = useTheme();
  const translator = useT();
  const { t } = translator;
  const label = formatDayLabel(date, translator);
  const total = spent > 0 ? formatMoney(spent, currency) : income > 0 ? `+${formatMoney(income, currency)}` : null;
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={
        spent > 0 ? t('home.dayTotal', { day: label, amount: formatMoney(spent, currency) }) : income > 0 ? t('home.dayIncome', { day: label, amount: formatMoney(income, currency) }) : label
      }
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <AppText variant="label" tone="muted" style={{ flex: 1 }}>
        {label}
      </AppText>
      {total ? (
        <AppText variant="label" tone={spent > 0 ? 'muted' : 'success'}>
          {total}
        </AppText>
      ) : null}
    </View>
  );
}

/** One transaction: time · category · note · amount · Again, Edit, Delete. The row itself opens the editor. */
function Row({ item, actions }: { item: TransactionWithCategory; actions: ReturnType<typeof useTransactionActions> }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, lang } = useT();
  const name = categoryName(item.category, lang);
  const income = item.kind === 'INCOME';
  const tool = (icon: IconName, label: string, onPress: () => void, color: string = c.textMuted) => (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name={icon} size={17} color={color} />
    </Touchable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Touchable
        onPress={() => actions.edit(item)}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${item.note ? `${item.note}, ` : ''}${formatMoney(item.amount, item.currency)}`}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.sm,
          paddingLeft: spacing.lg,
          backgroundColor: pressed ? c.track : 'transparent',
        })}
      >
        <AppText variant="caption" tone="muted" style={{ width: 44 }}>
          {formatTime(new Date(item.occurred_at))}
        </AppText>
        <View style={{ width: 220, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <CategoryBadge icon={item.category.icon} tint={item.category.tint} size={26} dimmed={item.category.archived_at !== null} />
          <AppText variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
            {name}
          </AppText>
        </View>
        <AppText tone="muted" numberOfLines={1} style={{ flex: 1 }}>
          {item.note}
        </AppText>
        <AppText variant="heading" tone={income ? 'success' : 'default'} style={{ width: 150, textAlign: 'right' }}>
          {income ? `+${formatMoney(item.amount, item.currency)}` : formatMoney(item.amount, item.currency)}
        </AppText>
      </Touchable>
      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.sm }}>
        {tool('repeat', t('common.again'), () => void actions.again(item))}
        {tool('create-outline', t('common.edit'), () => actions.edit(item))}
        {tool('trash-outline', t('common.delete'), () => actions.confirmDelete(item), c.danger)}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

/** The filters, always on the left (§13.9): search text, the date choices (with two day fields for "Pick dates"), categories. */
function FilterPanel({ search }: { search: TransactionSearch }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, lang } = useT();
  const { startDay } = usePeriodSettings();
  const { key } = useSelectedPeriod();
  const rangeLabel = useSearchRangeLabel(search.days);
  const insets = useSafeAreaInsets();
  const [focus, setFocus] = useState<'from' | 'to' | null>(null);

  const option = (opts: { key: string; on: boolean; label: string; onPress: () => void; role: 'radio' | 'checkbox'; leading?: React.ReactNode }) => (
    <Touchable
      key={opts.key}
      onPress={opts.onPress}
      accessibilityRole={opts.role}
      accessibilityState={opts.role === 'radio' ? { selected: opts.on } : { checked: opts.on }}
      accessibilityLabel={opts.label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: 36,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.sm,
        backgroundColor: opts.on ? c.track : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {opts.leading}
      <AppText variant="label" numberOfLines={1} style={{ flex: 1 }}>
        {opts.label}
      </AppText>
      {opts.on ? <Icon name="checkmark" size={16} color={c.primaryText} /> : null}
    </Touchable>
  );

  const dayField = (which: 'from' | 'to') => {
    const value = search.days?.[which];
    return (
      <View style={{ gap: 2 }}>
        <AppText variant="caption" tone="muted">
          {t(which === 'from' ? 'wide.filters.from' : 'wide.filters.to')}
        </AppText>
        <input
          type="date"
          aria-label={t(which === 'from' ? 'wide.filters.from' : 'wide.filters.to')}
          value={value ? localDayKey(value) : ''}
          onChange={(e) => {
            const picked = parseDayKey(e.target.value);
            if (picked && search.days) search.pickDays({ ...search.days, [which]: picked });
          }}
          onFocus={() => setFocus(which)}
          onBlur={() => setFocus(null)}
          style={{ ...fieldStyle(theme, focus === which), width: '100%' }}
        />
      </View>
    );
  };

  return (
    <ScrollView
      style={{ width: 260, flexGrow: 0, borderRightWidth: 1, borderRightColor: c.border, backgroundColor: c.surface }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.lg + insets.top, gap: spacing.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <AppText variant="title">{t('wide.filters')}</AppText>
      <TextField
        value={search.text}
        onChangeText={search.setText}
        placeholder={t('search.placeholder')}
        accessibilityLabel={t('home.search')}
        autoCorrect={false}
        leading={<Icon name="search-outline" size={18} color={c.textMuted} />}
        trailing={
          search.text ? (
            <Touchable onPress={() => search.setText('')} accessibilityRole="button" accessibilityLabel={t('search.clear')} hitSlop={10}>
              <Icon name="close-circle" size={18} color={c.textMuted} />
            </Touchable>
          ) : null
        }
      />

      <View style={{ gap: 2 }} accessibilityRole="radiogroup" accessibilityLabel={t('search.range.hint')}>
        <AppText variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>
          {t('wide.filters.date')}
        </AppText>
        {SEARCH_RANGE_CHOICES.map((choice) =>
          option({
            key: choice,
            role: 'radio',
            on: search.range === choice,
            label: choice === 'custom' && search.range !== 'custom' ? t('search.range.pick') : rangeLabel(choice),
            onPress: () => {
              if (choice !== 'custom') return search.setRange(choice);
              // Starts as the shown period, then each day can be changed.
              search.pickDays(search.days ?? { from: periodStart(key, startDay), to: periodLastDay(key, startDay) });
            },
          }),
        )}
        {search.range === 'custom' ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {dayField('from')}
            {dayField('to')}
          </View>
        ) : null}
      </View>

      {search.categories.length > 0 ? (
        <View style={{ gap: 2 }} accessibilityLabel={t('search.filter.hint')}>
          <AppText variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>
            {t('wide.filters.categories')}
          </AppText>
          {search.categories.map((cat) =>
            option({
              key: String(cat.id),
              role: 'checkbox',
              on: search.picked.includes(cat.id),
              label: categoryName(cat, lang),
              onPress: () => search.toggleCategory(cat.id),
              leading: <CategoryBadge icon={cat.icon} tint={cat.tint} size={22} dimmed={cat.archived_at !== null} />,
            }),
          )}
        </View>
      ) : null}

      {search.filtered ? <Button label={t('wide.filters.clear')} kind="soft" size="sm" icon="close" onPress={search.reset} /> : null}
    </ScrollView>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, flexDirection: 'row', backgroundColor: t.colors.background },
    main: { padding: spacing.xl, alignItems: 'center' },
    column: { width: '100%', maxWidth: 1200, gap: spacing.lg },
    totals: { minHeight: 24 },
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
    table: {
      borderRadius: radius.lg,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      overflow: 'hidden',
      paddingBottom: spacing.xs,
    },
  });
