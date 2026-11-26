import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { CategoryBadge } from '@/components/CategoryBadge';
import { SwipeActions } from '@/components/SwipeActions';
import { TransactionRow } from '@/components/TransactionRow';
import { createTransaction, deleteTransaction, putTransaction } from '@/db/transactionsRepository';
import { useDb } from '@/hooks/useDbQuery';
import { useT } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { showToast } from '@/store/useToastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/themes';
import type { TransactionWithCategory } from '@/types/models';
import { categoryName } from '@/utils/categoryNames';
import { errorAlert } from '@/utils/errorMessage';
import { formatMoney } from '@/utils/money';

const invalidate = () => useAppStore.getState().invalidateData();

/**
 * What every transaction list does with its rows (§5): tap to edit; swipe left for Again · Edit ·
 * Delete; long-press for the same actions in a sheet. Used by Home, the category and the day screens.
 * Render `renderItem(row)` for each row and `sheet` once, at the end of the screen.
 */
export function useTransactionActions() {
  const db = useDb();
  const translator = useT();
  const { t, lang } = translator;
  const { theme } = useTheme();
  const c = theme.colors;
  const [actionsFor, setActionsFor] = useState<TransactionWithCategory | null>(null);

  const fail = (e: unknown) => {
    const { title, message } = errorAlert(e, translator);
    Alert.alert(title, message);
  };

  const label = (r: TransactionWithCategory) => ({ amount: formatMoney(r.amount, r.currency), category: categoryName(r.category, lang) });

  /** Again: the same amount, currency and category, now (§5). */
  const again = async (r: TransactionWithCategory) => {
    try {
      const id = await createTransaction(db, {
        kind: r.kind,
        amount: r.amount,
        currency: r.currency,
        categoryId: r.category_id,
        note: '',
        occurredAt: new Date().toISOString(),
      });
      invalidate();
      showToast({
        message: t('toast.tx.added', label(r)),
        actionLabel: t('common.undo'),
        onAction: async () => {
          await deleteTransaction(db, id).catch(() => {});
          invalidate();
        },
      });
    } catch (e) {
      fail(e);
    }
  };

  /** Deleting asks first, then still offers Undo (§5). */
  const confirmDelete = (r: TransactionWithCategory) => {
    Alert.alert(t('dialog.deleteTx.title'), t('dialog.deleteTx.body', label(r)), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            const removed = await deleteTransaction(db, r.id);
            invalidate();
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
    ]);
  };

  const edit = (r: TransactionWithCategory) => router.push({ pathname: '/transaction/[id]', params: { id: String(r.id) } });

  const renderItem = (item: TransactionWithCategory) => (
    <View style={{ marginBottom: spacing.sm }}>
      <SwipeActions
        actions={[
          { key: 'again', label: t('common.again'), icon: 'repeat', color: c.track, contentColor: c.text, onPress: () => void again(item) },
          { key: 'edit', label: t('common.edit'), icon: 'create-outline', color: c.primary, contentColor: c.onPrimary, onPress: () => edit(item) },
          {
            key: 'delete',
            label: t('common.delete'),
            icon: 'trash-outline',
            color: c.danger,
            // `surface` reads on `danger` in every theme (white doesn't on Dark's pink).
            contentColor: c.surface,
            onPress: () => confirmDelete(item),
          },
        ]}
      >
        <TransactionRow item={item} onPress={() => edit(item)} onLongPress={() => setActionsFor(item)} />
      </SwipeActions>
    </View>
  );

  const sheet = actionsFor ? (
    <BottomSheet visible onClose={() => setActionsFor(null)}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
          <CategoryBadge icon={actionsFor.category.icon} tint={actionsFor.category.tint} />
          <View style={{ flex: 1 }}>
            <AppText variant="heading" numberOfLines={1}>
              {actionsFor.note || categoryName(actionsFor.category, lang)}
            </AppText>
            <AppText variant="caption" tone="muted">
              {formatMoney(actionsFor.amount, actionsFor.currency)}
            </AppText>
          </View>
        </View>
        {(
          [
            ['again', t('common.again'), 'repeat', () => void again(actionsFor)],
            ['edit', t('common.edit'), 'create-outline', () => edit(actionsFor)],
          ] as const
        ).map(([k, text, icon, run]) => (
          <Button
            key={k}
            label={text}
            kind="soft"
            icon={icon}
            onPress={() => {
              setActionsFor(null);
              run();
            }}
          />
        ))}
        <Button
          label={t('common.delete')}
          kind="danger"
          icon="trash-outline"
          onPress={() => {
            const r = actionsFor;
            setActionsFor(null);
            confirmDelete(r);
          }}
        />
      </View>
    </BottomSheet>
  ) : null;

  return { renderItem, sheet };
}
