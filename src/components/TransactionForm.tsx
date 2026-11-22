import { router, useFocusEffect } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CategoryBadge } from '@/components/CategoryBadge';
import { sameDay, startOfDay } from '@/components/CalendarGrid';
import { ChoiceSheet } from '@/components/ChoiceSheet';
import { DatePickerSheet } from '@/components/DatePickerSheet';
import { FormField } from '@/components/FormField';
import { Icon } from '@/components/Icon';
import { NumberPad } from '@/components/NumberPad';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { Touchable } from '@/components/Touchable';
import { listCategoriesByUse } from '@/db/categoriesRepository';
import {
  NOTE_MAX_LENGTH,
  createTransaction,
  deleteTransaction,
  getTransaction,
  putTransaction,
  updateTransaction,
} from '@/db/transactionsRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useT } from '@/i18n';
import { formatWeekdayDayMonth } from '@/i18n/dates';
import { useAppStore } from '@/store/useAppStore';
import { showToast } from '@/store/useToastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, spacing } from '@/theme/themes';
import { CATEGORY_KINDS, type Category, type CategoryKind, type Transaction } from '@/types/models';
import { categoryName } from '@/utils/categoryNames';
import { errorAlert } from '@/utils/errorMessage';
import { hapticSuccess, hapticTick } from '@/utils/haptics';
import {
  CURRENCIES,
  EMPTY_ENTRY,
  convertEntry,
  entryToMinor,
  formatEntry,
  formatMoney,
  minorToEntry,
  pressKey,
  type AmountEntry,
  type Currency,
} from '@/utils/money';

interface Form {
  kind: CategoryKind;
  entry: AmountEntry;
  currency: Currency;
  categoryId: number | null;
  /** 00:00 local of the chosen day. */
  day: Date;
  note: string;
}

const DAY_MS = 86_400_000;
const invalidate = () => useAppStore.getState().invalidateData();

/** The chosen day at the clock time of `timeOf` (now for a new entry; the original time when editing). */
const occurredAt = (day: Date, timeOf: Date) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), timeOf.getHours(), timeOf.getMinutes(), timeOf.getSeconds()).toISOString();

/** Strips the joined category: what `putTransaction` writes back on Undo. */
const rowOf = ({ category: _category, ...row }: Transaction & { category?: Category }): Transaction => row;

/**
 * Add / edit a transaction (§4) — the critical path: amount on the in-app pad (focused at once),
 * Expense | Income, tap a category (most used first; "+ New" makes one from a template and selects
 * it), optional date and note, Save. Saving closes, buzzes, and offers Undo.
 */
export function TransactionForm({ editId, initialKind }: { editId: number | null; initialKind?: CategoryKind }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = theme.colors;
  const translator = useT();
  const { t, lang } = translator;
  const defaultCurrency = useAppStore((s) => s.defaultCurrency);

  const loadExisting = useCallback((db: SQLiteDatabase) => (editId === null ? Promise.resolve(null) : getTransaction(db, editId)), [editId]);
  const existingQuery = useDbQuery(loadExisting);
  const existing = existingQuery.data ?? null;
  const db = existingQuery.db;

  // The form = what was loaded (blank for a new one) + the user's edits (`form`, null until the first edit).
  const [form, setForm] = useState<Form | null>(() =>
    editId === null
      ? { kind: initialKind ?? 'EXPENSE', entry: EMPTY_ENTRY, currency: defaultCurrency, categoryId: null, day: startOfDay(new Date()), note: '' }
      : null,
  );
  const loaded = useMemo<Form | null>(
    () =>
      existing && {
        kind: existing.kind,
        entry: minorToEntry(existing.amount, existing.currency),
        currency: existing.currency,
        categoryId: existing.category_id,
        day: startOfDay(new Date(existing.occurred_at)),
        note: existing.note,
      },
    [existing],
  );
  const f = form ?? loaded;
  const update = (patch: Partial<Form>) => f && setForm({ ...f, ...patch });

  // A category just made through "+ New" is selected when we come back (see the category editor).
  const [pickedId, setPickedId] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      const id = useAppStore.getState().pickedCategoryId;
      if (id !== null) {
        useAppStore.getState().setPickedCategoryId(null);
        setPickedId(id);
      }
    }, []),
  );
  const categoryId = pickedId ?? f?.categoryId ?? null;

  const kind = f?.kind ?? initialKind ?? 'EXPENSE';
  const loadCategories = useCallback((d: SQLiteDatabase) => listCategoriesByUse(d, kind), [kind]);
  const { data: active } = useDbQuery(loadCategories);
  const categories = useMemo(() => {
    const list = active ?? [];
    // Editing a transaction whose category was archived: keep it on the grid so it stays selected.
    if (existing && existing.kind === kind && !list.some((cat) => cat.id === existing.category_id)) return [existing.category, ...list];
    return list;
  }, [active, existing, kind]);

  const [noteFocused, setNoteFocused] = useState(false);
  const [sheet, setSheet] = useState<'currency' | 'date' | null>(null);
  const [busy, setBusy] = useState(false);

  if (!f) return <View style={{ flex: 1, backgroundColor: c.background }} />;

  const amount = entryToMinor(f.entry, f.currency);
  const category = categories.find((cat) => cat.id === categoryId) ?? null;
  const canSave = amount > 0 && category !== null && !busy;
  const today = startOfDay(new Date());
  const yesterday = new Date(today.getTime() - DAY_MS);
  const pickedOtherDay = !sameDay(f.day, today) && !sameDay(f.day, yesterday);

  const fail = (e: unknown) => {
    const { title, message } = errorAlert(e, translator);
    Alert.alert(title, message);
  };

  const save = async () => {
    if (!category) return;
    setBusy(true);
    const input = {
      kind: f.kind,
      amount,
      currency: f.currency,
      categoryId: category.id,
      note: f.note,
      occurredAt: occurredAt(f.day, existing ? new Date(existing.occurred_at) : new Date()),
    };
    const label = { amount: formatMoney(amount, f.currency), category: categoryName(category, lang) };
    try {
      if (existing) {
        const before = rowOf(existing);
        await updateTransaction(db, existing.id, input);
        invalidate();
        hapticSuccess();
        router.back();
        showToast({
          message: t('toast.tx.saved'),
          actionLabel: t('common.undo'),
          onAction: async () => {
            await putTransaction(db, before);
            invalidate();
          },
        });
      } else {
        const id = await createTransaction(db, input);
        invalidate();
        hapticSuccess();
        router.back();
        showToast({
          message: t('toast.tx.added', label),
          actionLabel: t('common.undo'),
          onAction: async () => {
            await deleteTransaction(db, id).catch(() => {});
            invalidate();
          },
        });
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert(
      t('dialog.deleteTx.title'),
      t('dialog.deleteTx.body', { amount: formatMoney(existing.amount, existing.currency), category: categoryName(existing.category, lang) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const removed = await deleteTransaction(db, existing.id);
              invalidate();
              router.back();
              showToast({
                message: t('toast.tx.deleted'),
                actionLabel: t('common.undo'),
                onAction: async () => {
                  await putTransaction(db, removed);
                  invalidate();
                },
              });
            } catch (e) {
              fail(e);
            }
          },
        },
      ],
    );
  };

  const dateChip = (label: string, selected: boolean, onPress: () => void) => (
    <Touchable
      key={label}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        minHeight: 36,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        justifyContent: 'center',
        backgroundColor: selected ? c.primary : pressed ? c.border : c.track,
      })}
    >
      <AppText variant="label" tone={selected ? 'onPrimary' : 'default'}>
        {label}
      </AppText>
    </Touchable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {/* Amount: big, live-grouped, in the transaction's currency (tap the chip to change it). */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Touchable
            onPress={() => setSheet('currency')}
            accessibilityRole="button"
            accessibilityLabel={t('tx.currency.change', { currency: t(`currency.${f.currency}`) })}
            hitSlop={6}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              minHeight: 32,
              paddingHorizontal: spacing.sm + 2,
              borderRadius: radius.pill,
              backgroundColor: pressed ? c.border : c.track,
            })}
          >
            <AppText variant="label">{f.currency}</AppText>
            <Icon name="chevron-down" size={14} color={c.text} />
          </Touchable>
          <AppText
            accessibilityLabel={`${t('tx.amount')}: ${formatMoney(amount, f.currency)}`}
            accessibilityLiveRegion="polite"
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1.15}
            style={{
              flex: 1,
              textAlign: 'right',
              fontFamily: fonts.extrabold,
              fontSize: 40,
              lineHeight: 48,
              color: amount === 0 ? c.textMuted : f.kind === 'INCOME' ? c.success : c.text,
            }}
          >
            {formatEntry(f.entry, f.currency)}
          </AppText>
        </View>

        <SegmentedControl
          options={CATEGORY_KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))}
          value={f.kind}
          onChange={(k) => {
            if (k === f.kind) return;
            hapticTick();
            setPickedId(null);
            update({ kind: k, categoryId: null });
          }}
        />

        <FormField label={t('tx.category')}>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
            {categories.map((cat) => {
              const selected = cat.id === categoryId;
              const name = categoryName(cat, lang);
              return (
                <View key={cat.id} style={{ width: '25%', padding: 4 }}>
                  <Touchable
                    onPress={() => {
                      hapticTick();
                      setPickedId(null);
                      update({ categoryId: cat.id });
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={name}
                    style={({ pressed }) => ({
                      alignItems: 'center',
                      gap: 4,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: 2,
                      borderRadius: radius.md,
                      borderWidth: 1.5,
                      borderColor: selected ? c.primaryText : 'transparent',
                      backgroundColor: selected || pressed ? c.track : 'transparent',
                    })}
                  >
                    <CategoryBadge icon={cat.icon} tint={cat.tint} />
                    <AppText variant="caption" numberOfLines={2} style={{ textAlign: 'center' }}>
                      {name}
                    </AppText>
                  </Touchable>
                </View>
              );
            })}
            <View style={{ width: '25%', padding: 4 }}>
              <Touchable
                onPress={() => router.push({ pathname: '/category/edit', params: { kind: f.kind, pick: '1' } })}
                accessibilityRole="button"
                accessibilityLabel={t('screen.newCategory')}
                style={({ pressed }) => ({
                  alignItems: 'center',
                  gap: 4,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor: pressed ? c.track : 'transparent',
                })}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: c.outline,
                  }}
                >
                  <Icon name="add" size={20} color={c.text} />
                </View>
                <AppText variant="caption" style={{ textAlign: 'center' }}>
                  {t('tx.newCategory')}
                </AppText>
              </Touchable>
            </View>
          </View>
          {categories.length === 0 ? (
            <AppText variant="caption" tone="muted">
              {t('tx.noCategories')}
            </AppText>
          ) : null}
        </FormField>

        <FormField label={t('tx.date')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {dateChip(t('common.today'), sameDay(f.day, today), () => update({ day: today }))}
            {dateChip(t('common.yesterday'), sameDay(f.day, yesterday), () => update({ day: yesterday }))}
            {dateChip(pickedOtherDay ? formatWeekdayDayMonth(f.day, lang) : t('tx.date.pick'), pickedOtherDay, () => setSheet('date'))}
          </View>
        </FormField>

        <FormField label={t('tx.note')} optional>
          <TextField
            value={f.note}
            onChangeText={(note) => update({ note })}
            placeholder={t('tx.note.placeholder')}
            accessibilityLabel={t('tx.note')}
            maxLength={NOTE_MAX_LENGTH}
            returnKeyType="done"
            onFocus={() => setNoteFocused(true)}
            onBlur={() => setNoteFocused(false)}
          />
        </FormField>

        {existing ? <Button label={t('common.delete')} kind="danger" icon="trash-outline" onPress={confirmDelete} /> : null}
      </ScrollView>

      {/* Pinned to the bottom (and above the keyboard while typing a note, when the pad steps aside). */}
      <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <View
          style={{
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: c.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            boxShadow: `0px -6px 18px ${c.shadow}`,
          }}
        >
          {!noteFocused && (
            <NumberPad
              currency={f.currency}
              onKey={(key) => update({ entry: pressKey(f.entry, key, f.currency) })}
              onQuick={(minor) => update({ entry: minorToEntry(minor, f.currency) })}
            />
          )}
          <Button label={t('common.save')} onPress={save} disabled={!canSave} loading={busy} />
        </View>
      </KeyboardStickyView>

      {sheet === 'currency' && (
        <ChoiceSheet
          title={t('tx.currency.title')}
          hint={t('tx.currency.hint', { currency: defaultCurrency })}
          options={CURRENCIES.map((cur) => ({ key: cur, label: `${cur} · ${t(`currency.${cur}`)}`, detail: formatMoney(123_456, cur) }))}
          value={f.currency}
          onClose={() => setSheet(null)}
          onPick={(cur) => {
            update({ currency: cur, entry: convertEntry(f.entry, cur) });
            setSheet(null);
          }}
        />
      )}
      {sheet === 'date' && (
        <DatePickerSheet
          value={f.day}
          title={t('tx.date.title')}
          onClose={() => setSheet(null)}
          onPick={(day) => {
            update({ day: startOfDay(day) });
            setSheet(null);
          }}
        />
      )}
    </View>
  );
}
