import { router, useFocusEffect } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, BackHandler, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { BUTTON_HEIGHT, Button } from '@/components/Button';
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
import { hapticNudge, hapticSuccess, hapticTick } from '@/utils/haptics';
import {
  DEFAULT_CURRENCY,
  EMPTY_ENTRY,
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
  /** Always rupiah for new entries (§14.1); a transaction from 0.1.x keeps the currency it was logged in. */
  currency: Currency;
  categoryId: number | null;
  /** 00:00 local of the chosen day. */
  day: Date;
  note: string;
}

type DateChoice = 'today' | 'yesterday' | 'pick';

const DAY_MS = 86_400_000;
const AMOUNT_SIZE = 44;
/**
 * While the note is typed, the Save bar rides on the keyboard, so the focused field must clear the bar's
 * visible part — padding, button, padding — plus a little air, not just the keyboard.
 */
const NOTE_CLEARANCE = spacing.md + BUTTON_HEIGHT.md + spacing.md + spacing.lg;
const PAD_MS = 240;
/** A short side-to-side shake: "this one". */
const shake = () =>
  withSequence(withTiming(-8, { duration: 50 }), withRepeat(withTiming(8, { duration: 80 }), 3, true), withTiming(0, { duration: 50 }));
const invalidate = () => useAppStore.getState().invalidateData();

/** The chosen day at the clock time of `timeOf` (now for a new entry; the original time when editing). */
const occurredAt = (day: Date, timeOf: Date) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), timeOf.getHours(), timeOf.getMinutes(), timeOf.getSeconds()).toISOString();

/** Strips the joined category: what `putTransaction` writes back on Undo. */
const rowOf = ({ category: _category, ...row }: Transaction & { category?: Category }): Transaction => row;

/** The blinking caret after the amount while the pad is open (steady when the phone asks for less motion). */
function Caret({ color }: { color: string }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(withRepeat(withTiming(0, { duration: 530 }), -1, true));
    return () => cancelAnimation(opacity);
  }, [reduceMotion, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      style={[
        {
          width: 3,
          height: AMOUNT_SIZE - 6,
          borderRadius: 2,
          marginLeft: 4,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

/**
 * Add / edit a transaction (§4), top to bottom in the order you think it: Expense | Income → the amount,
 * big and centred → category → day and note → Save. The number pad stays away until the amount is tapped
 * (owner, 0.2.0: see the whole screen first, open the pad yourself); it slides in above Save and steps
 * aside when a category is picked, the day or the note is touched, ⌄ is pressed or Back. Save is always
 * enabled and always says "Save": pressed with something missing, it takes you there — the pad opens and the
 * amount shakes, or the grid scrolls into view — with a short line saying what to do (owner, 0.2.0: no
 * disabled button that changes its words). Saving closes, buzzes, and offers Undo.
 */
export function TransactionForm({ editId, initialKind }: { editId: number | null; initialKind?: CategoryKind }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = theme.colors;
  const translator = useT();
  const { t, lang } = translator;

  const loadExisting = useCallback((db: SQLiteDatabase) => (editId === null ? Promise.resolve(null) : getTransaction(db, editId)), [editId]);
  const existingQuery = useDbQuery(loadExisting);
  const existing = existingQuery.data ?? null;
  const db = existingQuery.db;

  // The form = what was loaded (blank for a new one) + the user's edits (`form`, null until the first edit).
  const [form, setForm] = useState<Form | null>(() =>
    editId === null
      ? {
          kind: initialKind ?? 'EXPENSE',
          entry: EMPTY_ENTRY,
          currency: DEFAULT_CURRENCY,
          categoryId: null,
          day: startOfDay(new Date()),
          note: '',
        }
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

  const [padOpen, setPadOpen] = useState(false);
  const [sheet, setSheet] = useState<'date' | 'calendar' | null>(null);
  const [busy, setBusy] = useState(false);
  /** What Save last found missing; its line shows until that part is filled. */
  const [missing, setMissing] = useState<'amount' | 'category' | null>(null);
  const scrollRef = useRef<React.ComponentRef<typeof KeyboardAwareScrollView>>(null);
  const categoryY = useRef(0);
  const amountShake = useSharedValue(0);
  const categoryShake = useSharedValue(0);
  const amountShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: amountShake.get() }],
  }));
  const categoryShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: categoryShake.get() }],
  }));

  // The pad opens by growing its holder from 0 to the pad's height: the bar rises from the bottom while Save
  // stays put (no layout animation on Save — that made it drop in from above the pad).
  const reduceMotion = useReducedMotion();
  const padProgress = useSharedValue(0);
  const padHeight = useSharedValue(0);
  useEffect(() => {
    padProgress.set(
      withTiming(padOpen ? 1 : 0, {
        duration: reduceMotion ? 0 : PAD_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [padOpen, reduceMotion, padProgress]);
  const padStyle = useAnimatedStyle(() => ({
    height: padHeight.get() * padProgress.get(),
    opacity: padProgress.get(),
  }));

  // Back closes the pad before it leaves the screen.
  useFocusEffect(
    useCallback(() => {
      if (!padOpen) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setPadOpen(false);
        return true;
      });
      return () => sub.remove();
    }, [padOpen]),
  );

  if (!f) return <View style={{ flex: 1, backgroundColor: c.background }} />;

  const amount = entryToMinor(f.entry, f.currency);
  const category = categories.find((cat) => cat.id === categoryId) ?? null;
  const amountMissing = missing === 'amount' && amount === 0;
  const categoryMissing = missing === 'category' && category === null;
  const today = startOfDay(new Date());
  const yesterday = new Date(today.getTime() - DAY_MS);
  const dateChoice: DateChoice = sameDay(f.day, today) ? 'today' : sameDay(f.day, yesterday) ? 'yesterday' : 'pick';
  const dayLabel =
    dateChoice === 'today' ? t('common.today') : dateChoice === 'yesterday' ? t('common.yesterday') : formatWeekdayDayMonth(f.day, lang);
  const amountColor = amount === 0 ? c.textMuted : f.kind === 'INCOME' ? c.success : c.text;

  const fail = (e: unknown) => {
    const { title, message } = errorAlert(e, translator);
    Alert.alert(title, message);
  };

  /** Save with something missing: go there and say what to do — calm, no error. */
  const nudge = (what: 'amount' | 'category') => {
    hapticNudge();
    setMissing(what);
    AccessibilityInfo.announceForAccessibility(t(what === 'amount' ? 'tx.amount.needed' : 'tx.category.needed'));
    if (what === 'amount') {
      setPadOpen(true);
      if (!reduceMotion) amountShake.set(shake());
    } else {
      setPadOpen(false);
      scrollRef.current?.scrollTo({
        y: Math.max(0, categoryY.current - spacing.lg),
        animated: !reduceMotion,
      });
      if (!reduceMotion) categoryShake.set(shake());
    }
  };

  const save = async () => {
    if (busy) return;
    if (amount === 0) return nudge('amount');
    if (!category) return nudge('category');
    setBusy(true);
    const input = {
      kind: f.kind,
      amount,
      currency: f.currency,
      categoryId: category.id,
      note: f.note,
      occurredAt: occurredAt(f.day, existing ? new Date(existing.occurred_at) : new Date()),
    };
    const label = {
      amount: formatMoney(amount, f.currency),
      category: categoryName(category, lang),
    };
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
      t('dialog.deleteTx.body', {
        amount: formatMoney(existing.amount, existing.currency),
        category: categoryName(existing.category, lang),
      }),
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

  const pickDate = (choice: DateChoice) => {
    if (choice === 'pick') {
      setSheet('calendar');
      return;
    }
    update({ day: choice === 'today' ? today : yesterday });
    setSheet(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAwareScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        bottomOffset={NOTE_CLEARANCE}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      >
        {/* 1. What kind: decides the amount's colour and which categories show. */}
        <SegmentedControl
          options={CATEGORY_KINDS.map((k) => ({
            value: k,
            label: t(`kind.${k}`),
          }))}
          value={f.kind}
          onChange={(k) => {
            if (k === f.kind) return;
            hapticTick();
            setPickedId(null);
            update({ kind: k, categoryId: null });
          }}
        />

        {/* 2. The amount: big and centred, like a payment screen. Tap it to open (or close) the pad. */}
        <Touchable
          onPress={() => {
            hapticTick();
            setPadOpen((open) => !open);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${t('tx.amount')}: ${formatMoney(amount, f.currency)}`}
          accessibilityHint={t('tx.amount.a11yHint')}
          accessibilityState={{ expanded: padOpen }}
          style={({ pressed }) => ({
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: pressed ? c.track : 'transparent',
          })}
        >
          <Animated.View
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                maxWidth: '100%',
              },
              amountShakeStyle,
            ]}
          >
            <AppText
              accessibilityLiveRegion="polite"
              numberOfLines={1}
              adjustsFontSizeToFit
              maxFontSizeMultiplier={1.15}
              style={{
                flexShrink: 1,
                fontFamily: fonts.extrabold,
                fontSize: AMOUNT_SIZE,
                lineHeight: AMOUNT_SIZE + 8,
                color: amountColor,
              }}
            >
              {formatEntry(f.entry, f.currency)}
            </AppText>
            {padOpen ? <Caret color={c.primaryText} /> : null}
          </Animated.View>
          <View
            style={{
              width: '60%',
              height: 2,
              borderRadius: 1,
              backgroundColor: padOpen ? c.primaryText : c.border,
            }}
          />
          {amountMissing ? (
            <AppText variant="label" style={{ color: c.primaryText }}>
              {t('tx.amount.needed')}
            </AppText>
          ) : !padOpen ? (
            <AppText variant="caption" tone="muted">
              {amount === 0 ? t('tx.amount.tap') : t('tx.amount.tapChange')}
            </AppText>
          ) : null}
        </Touchable>

        {/* 3. Category. Picking one puts the pad away: the amount is done. */}
        <View onLayout={(e) => (categoryY.current = e.nativeEvent.layout.y)}>
          <FormField label={t('tx.category')} message={categoryMissing ? t('tx.category.needed') : null}>
            <Animated.View
              accessibilityRole="radiogroup"
              style={[
                {
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  marginHorizontal: -4,
                },
                categoryShakeStyle,
              ]}
            >
              {categories.map((cat) => {
                const selected = cat.id === categoryId;
                const name = categoryName(cat, lang);
                return (
                  <View key={cat.id} style={{ width: '25%', padding: 4 }}>
                    <Touchable
                      onPress={() => {
                        hapticTick();
                        setPickedId(null);
                        setPadOpen(false);
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
                  onPress={() => {
                    setPadOpen(false);
                    router.push({
                      pathname: '/category/edit',
                      params: { kind: f.kind, pick: '1' },
                    });
                  }}
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
            </Animated.View>
            {categories.length === 0 ? (
              <AppText variant="caption" tone="muted">
                {t('tx.noCategories')}
              </AppText>
            ) : null}
          </FormField>
        </View>

        {/* 4. The optional bits on one line: the day (a chip that opens the choices) and a note. */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <Touchable
            onPress={() => {
              setPadOpen(false);
              setSheet('date');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('tx.date.change', { date: dayLabel })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              minHeight: 46,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: c.border,
              backgroundColor: pressed ? c.track : c.surface,
            })}
          >
            <Icon name="calendar-outline" size={18} color={c.text} />
            <AppText variant="label">{dayLabel}</AppText>
            <Icon name="chevron-down" size={14} color={c.text} />
          </Touchable>
          <TextField
            style={{ flex: 1, minWidth: 180 }}
            leading={<Icon name="create-outline" size={18} color={c.textMuted} />}
            value={f.note}
            onChangeText={(note) => update({ note })}
            placeholder={t('tx.note.placeholder')}
            accessibilityLabel={t('tx.note')}
            maxLength={NOTE_MAX_LENGTH}
            returnKeyType="done"
            onFocus={() => setPadOpen(false)}
          />
        </View>

        {existing ? <Button label={t('common.delete')} kind="danger" icon="trash-outline" onPress={confirmDelete} /> : null}
      </KeyboardAwareScrollView>

      {/* Pinned to the bottom: the pad (only when asked for) above Save. Rides on the keyboard while typing a note. */}
      <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: c.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            boxShadow: `0px -6px 18px ${c.shadow}`,
          }}
        >
          {/* Always mounted (so its height is known), revealed bottom-up; out of reach while closed. */}
          <Animated.View
            style={[{ overflow: 'hidden', pointerEvents: padOpen ? 'auto' : 'none' }, padStyle]}
            accessibilityElementsHidden={!padOpen}
            importantForAccessibility={padOpen ? 'auto' : 'no-hide-descendants'}
          >
            <View
              onLayout={(e) => padHeight.set(e.nativeEvent.layout.height)}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                paddingBottom: spacing.md,
              }}
            >
              <NumberPad
                currency={f.currency}
                onKey={(key) => update({ entry: pressKey(f.entry, key, f.currency) })}
                onQuick={(minor) => update({ entry: minorToEntry(minor, f.currency) })}
                onHide={() => setPadOpen(false)}
              />
            </View>
          </Animated.View>
          <Button label={t('common.save')} onPress={save} loading={busy} />
        </View>
      </KeyboardStickyView>

      {sheet === 'date' && (
        <ChoiceSheet<DateChoice>
          title={t('tx.date.title')}
          options={[
            {
              key: 'today',
              label: t('common.today'),
              detail: formatWeekdayDayMonth(today, lang),
            },
            {
              key: 'yesterday',
              label: t('common.yesterday'),
              detail: formatWeekdayDayMonth(yesterday, lang),
            },
            {
              key: 'pick',
              label: t('tx.date.pick'),
              detail: dateChoice === 'pick' ? formatWeekdayDayMonth(f.day, lang) : undefined,
            },
          ]}
          value={dateChoice}
          onClose={() => setSheet(null)}
          onPick={pickDate}
        />
      )}
      {sheet === 'calendar' && (
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
