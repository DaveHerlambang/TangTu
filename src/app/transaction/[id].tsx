import { Stack, useLocalSearchParams } from 'expo-router';

import { TransactionForm } from '@/components/TransactionForm';
import { useT } from '@/i18n';

/** Edit (or delete) a transaction. */
export default function EditTransactionScreen() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t('screen.editTransaction') }} />
      <TransactionForm editId={Number(id)} />
    </>
  );
}
