import { Stack, useLocalSearchParams } from 'expo-router';

import { TransactionForm } from '@/components/TransactionForm';
import { useT } from '@/i18n';

/** Add a transaction (§4). `?kind=INCOME` opens on Income. */
export default function NewTransactionScreen() {
  const { t } = useT();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t('screen.newTransaction') }} />
      <TransactionForm editId={null} initialKind={kind === 'INCOME' ? 'INCOME' : 'EXPENSE'} />
    </>
  );
}
