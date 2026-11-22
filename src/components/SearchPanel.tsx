import { useState, type ReactNode } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { CategoryBadge } from '@/components/CategoryBadge';
import { DatePickerSheet } from '@/components/DatePickerSheet';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { Touchable } from '@/components/Touchable';
import type { TransactionSearch } from '@/hooks/useTransactionSearch';
import { usePeriodSettings, useSelectedPeriod } from '@/hooks/usePeriodSettings';
import { useT } from '@/i18n';
import { formatDayMonth } from '@/i18n/dates';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, type Theme } from '@/theme/themes';
import { categoryName } from '@/utils/categoryNames';
import { formatPeriodName, shiftPeriodKey } from '@/utils/format';
import { SEARCH_RANGE_CHOICES, type SearchRangeChoice } from '@/utils/searchRange';

/**
 * Search on Home (§4, §5): the field sits between the summary and the list. Touching it turns search on
 * (Home swaps the card for a one-line result count); then the date chips and the category chips show
 * under it. Cancel (or Back) turns it off and resets everything.
 */
export function SearchPanel({ search }: { search: TransactionSearch }) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, lang } = useT();
  const { kind } = usePeriodSettings();
  const { key, isCurrent } = useSelectedPeriod();
  // Picking days: first "from", then "to".
  const [step, setStep] = useState<{ from: Date | null } | null>(null);

  const rangeLabel = (choice: SearchRangeChoice): string => {
    switch (choice) {
      case 'this':
        return isCurrent ? t(kind === 'month' ? 'search.range.this.month' : 'search.range.this.period') : formatPeriodName(key, lang);
      case 'last':
        return isCurrent
          ? t(kind === 'month' ? 'search.range.last.month' : 'search.range.last.period')
          : formatPeriodName(shiftPeriodKey(key, -1), lang);
      case 'three':
        return t(kind === 'month' ? 'search.range.three.month' : 'search.range.three.period');
      case 'all':
        return t('search.range.all');
      case 'custom': {
        if (!search.days) return t('search.range.pick');
        const [a, b] = [search.days.from, search.days.to].sort((x, y) => x.getTime() - y.getTime());
        return `${formatDayMonth(a, lang)} – ${formatDayMonth(b, lang)}`;
      }
    }
  };

  const chip = (opts: { key: string; on: boolean; label: string; onPress: () => void; role: 'radio' | 'checkbox'; leading?: ReactNode }) => (
    <Touchable
      key={opts.key}
      onPress={opts.onPress}
      accessibilityRole={opts.role}
      accessibilityState={opts.role === 'radio' ? { selected: opts.on } : { checked: opts.on }}
      accessibilityLabel={opts.label}
      style={({ pressed }) => [styles.chip, !opts.leading && styles.chipPlain, opts.on && styles.chipOn, { opacity: pressed ? 0.7 : 1 }]}
    >
      {opts.leading}
      <AppText variant="label" numberOfLines={1} style={{ color: opts.on ? c.onPrimary : c.text }}>
        {opts.label}
      </AppText>
    </Touchable>
  );

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TextField
          style={{ flex: 1 }}
          value={search.text}
          onChangeText={search.setText}
          onFocus={search.start}
          placeholder={t('search.placeholder')}
          accessibilityLabel={t('home.search')}
          returnKeyType="search"
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
        {search.active ? (
          <Touchable
            onPress={() => {
              Keyboard.dismiss();
              search.exit();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('search.exit')}
            hitSlop={8}
            style={({ pressed }) => ({ minHeight: 46, justifyContent: 'center', paddingHorizontal: spacing.xs, opacity: pressed ? 0.6 : 1 })}
          >
            <AppText variant="label" style={{ color: c.primaryText }}>
              {t('common.cancel')}
            </AppText>
          </Touchable>
        ) : null}
      </View>

      {search.active ? (
        <Animated.View entering={FadeIn.duration(180)} style={{ gap: spacing.sm }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chipRow}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('search.range.hint')}
          >
            {SEARCH_RANGE_CHOICES.map((choice) =>
              chip({
                key: choice,
                role: 'radio',
                on: search.range === choice,
                label: rangeLabel(choice),
                onPress: () => (choice === 'custom' ? setStep({ from: null }) : search.setRange(choice)),
              }),
            )}
          </ScrollView>
          {search.categories.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.chipRow}
              accessibilityLabel={t('search.filter.hint')}
            >
              {search.categories.map((cat) =>
                chip({
                  key: String(cat.id),
                  role: 'checkbox',
                  on: search.picked.includes(cat.id),
                  label: categoryName(cat, lang),
                  onPress: () => search.toggleCategory(cat.id),
                  leading: <CategoryBadge icon={cat.icon} tint={cat.tint} size={22} dimmed={cat.archived_at !== null} />,
                }),
              )}
            </ScrollView>
          ) : null}
        </Animated.View>
      ) : null}

      {step && (
        <DatePickerSheet
          key={step.from ? 'to' : 'from'}
          value={step.from ?? search.days?.from ?? new Date()}
          title={t(step.from ? 'search.range.to' : 'search.range.from')}
          onClose={() => setStep(null)}
          onPick={(day) => {
            if (!step.from) {
              setStep({ from: day });
              return;
            }
            search.pickDays({ from: step.from, to: day });
            setStep(null);
          }}
        />
      )}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
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
    chipPlain: { paddingLeft: spacing.md },
    chipOn: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  });
