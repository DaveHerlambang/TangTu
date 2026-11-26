import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { hasAnyData } from '@/db/backupRepository';
import { readLegacyData, type LegacyData } from '@/db/legacyRepository';
import { useDb } from '@/hooks/useDbQuery';
import { useT } from '@/i18n';
import { RESTORE_UNDO_DAYS, restoreBackup } from '@/services/backup';
import { useAppStore } from '@/store/useAppStore';
import { showToast } from '@/store/useToastStore';
import { errorAlert } from '@/utils/errorMessage';

/**
 * The offline version's data on this phone (§11), and moving it to the signed-in account: straight away into
 * an empty account; into one with data only after "Replace this account's data?" (a safety copy is kept, as
 * for any restore). The old database is only read, never changed. Once moved, it is never offered again.
 */
export function useLegacyMove() {
  const db = useDb();
  const translator = useT();
  const { t, tp } = translator;
  const moved = useAppStore((s) => s.legacyMoved);
  const [legacy, setLegacy] = useState<LegacyData | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (moved) return;
    let alive = true;
    readLegacyData()
      .then((data) => alive && setLegacy(data))
      .catch(() => alive && setLegacy(null));
    return () => {
      alive = false;
    };
  }, [moved]);

  const run = useCallback(
    async (data: LegacyData) => {
      setBusy(true);
      try {
        await restoreBackup(db, data.backup, { announce: false });
        useAppStore.getState().setLegacyMoved();
        showToast({ message: t('toast.legacy.moved') });
      } catch (e) {
        const { title, message } = errorAlert(e, translator);
        Alert.alert(title, message);
      } finally {
        setBusy(false);
      }
    },
    [db, t, translator],
  );

  const start = useCallback(async () => {
    if (!legacy || busy || useAppStore.getState().legacyMoved) return;
    try {
      if (!(await hasAnyData(db))) return void (await run(legacy));
    } catch (e) {
      const { title, message } = errorAlert(e, translator);
      Alert.alert(title, message);
      return;
    }
    Alert.alert(
      t('dialog.legacy.replace.title'),
      t('dialog.legacy.replace.body', { transactions: tp('count.transactions', legacy.transactions), days: RESTORE_UNDO_DAYS }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('legacy.move'), style: 'destructive', onPress: () => void run(legacy) },
      ],
    );
  }, [legacy, busy, db, run, t, tp, translator]);

  // Once moved it's never offered again, whatever was read before.
  return { legacy: moved ? null : legacy, busy, start };
}
