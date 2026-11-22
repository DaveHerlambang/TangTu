import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CategoryBadge } from '@/components/CategoryBadge';
import { Touchable } from '@/components/Touchable';
import { useT } from '@/i18n';
import { formatTime } from '@/i18n/dates';
import { useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, type Theme } from '@/theme/themes';
import type { TransactionWithCategory } from '@/types/models';
import { categoryName } from '@/utils/categoryNames';
import { formatMoney } from '@/utils/money';

interface TransactionRowProps {
  item: TransactionWithCategory;
  onPress: () => void;
  onLongPress: () => void;
}

/** One transaction (§4): badge · headline (the note if there is one — "subject first" — else the category) · time · amount. */
export function TransactionRow({ item, onPress, onLongPress }: TransactionRowProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, lang } = useT();
  const name = categoryName(item.category, lang);
  const time = formatTime(new Date(item.occurred_at));
  const amount = item.kind === 'INCOME' ? `+${formatMoney(item.amount, item.currency)}` : formatMoney(item.amount, item.currency);
  const headline = item.note || name;
  const sub = item.note ? `${name} · ${time}` : time;
  return (
    <Touchable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${headline}, ${amount}, ${sub}`}
      accessibilityHint={t('home.row.actions')}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
    >
      <CategoryBadge icon={item.category.icon} tint={item.category.tint} />
      <View style={{ flex: 1, gap: 1 }}>
        <AppText variant="body" numberOfLines={1}>
          {headline}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {sub}
        </AppText>
      </View>
      <AppText
        variant="heading"
        tone={item.kind === 'INCOME' ? 'success' : 'default'}
        numberOfLines={1}
        style={{ flexShrink: 0, maxWidth: '45%' }}
        adjustsFontSizeToFit
      >
        {amount}
      </AppText>
    </Touchable>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 60,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: t.colors.surface,
      boxShadow: t.shadow,
    },
  });
