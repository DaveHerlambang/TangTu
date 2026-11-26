import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { MenuItem, PopoverMenu, usePopoverAnchor } from '@/components/PopoverMenu';
import { Touchable } from '@/components/Touchable';
import { deleteAllData } from '@/db/backupRepository';
import { seedMockData } from '@/dev/mockData';
import { useDb } from '@/hooks/useDbQuery';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Developer tools: a floating gear (left edge) with a context menu. English only: they never ship,
 * so they skip the dictionaries.
 * Only load this through a `__DEV__` guard (see the root layout) so it never ships.
 */
export function DevToolsGear() {
  const db = useDb();
  const { theme } = useTheme();
  const hidden = useAppStore((s) => s.devToolsHidden);
  const setHidden = useAppStore((s) => s.setDevToolsHidden);
  const invalidateData = useAppStore((s) => s.invalidateData);
  const { ref, anchor, open, close } = usePopoverAnchor();
  const [busy, setBusy] = useState(false);

  /** Replaces everything with deterministic fake history (src/dev/mockData.ts). */
  const fill = async (months: 6 | 12) => {
    setBusy(true);
    try {
      const s = await seedMockData(db, months, useAppStore.getState().periodStartDay);
      if (router.canDismiss()) router.dismissAll();
      useAppStore.getState().setSelectedPeriod(null);
      invalidateData();
      Alert.alert('Mock data added', `${s.periods} periods: ${s.categories} categories, ${s.transactions} transactions.`);
    } catch (e) {
      Alert.alert('Mock data failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmFill = (months: 6 | 12) => {
    close();
    Alert.alert('Replace everything with mock data?', "All of the signed-in account's data is deleted first, online. Use a test account only. This cannot be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace', style: 'destructive', onPress: () => void fill(months) },
    ]);
  };

  const nuke = async () => {
    setBusy(true);
    try {
      await deleteAllData(db);
      // Leave any detail screen (its row may be gone) and make every list re-query.
      if (router.canDismiss()) router.dismissAll();
      invalidateData();
      Alert.alert('Account emptied', "All of this account's data was deleted.");
    } catch (e) {
      Alert.alert('Reset failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmNuke = () => {
    close();
    Alert.alert("Nuke this account's data?", 'Deletes every category, transaction and bell message of the signed-in account, online. Use a test account only.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete everything', style: 'destructive', onPress: nuke },
    ]);
  };

  if (hidden) {
    return (
      <Touchable
        onPress={() => setHidden(false)}
        hitSlop={{ top: 8, bottom: 8, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Show developer tools"
        className="absolute left-0 top-[58%] h-12 w-3.5 items-center justify-center rounded-r-full active:w-5"
        style={{ backgroundColor: theme.colors.primary, opacity: 0.55 }}
      >
        <Icon name="chevron-forward" size={12} color="#FFFFFF" />
      </Touchable>
    );
  }

  return (
    <>
      <View ref={ref} collapsable={false} className="absolute left-3 top-[58%]">
        <Touchable
          onPress={open}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Developer tools"
          className="h-11 w-11 items-center justify-center rounded-full border active:scale-90"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            boxShadow: `0px 8px 18px ${theme.colors.shadow}`,
            opacity: 0.92,
          }}
        >
          {busy ? (
            <ActivityIndicator color={theme.colors.danger} />
          ) : (
            <Icon name="construct-outline" size={20} color={theme.colors.danger} />
          )}
        </Touchable>
      </View>

      <PopoverMenu anchor={anchor} onClose={close} width={250}>
        <Text
          className="px-3 pb-1 pt-2 font-nunito-extrabold text-[11px] uppercase tracking-widest"
          style={{ color: theme.colors.danger }}
        >
          Developer tools
        </Text>
        <MenuItem icon="color-wand-outline" label="Mock data · 6 months" hint="Replace everything with fake history" onPress={() => confirmFill(6)} />
        <MenuItem icon="color-wand-outline" label="Mock data · 1 year" hint="Replace everything with fake history" onPress={() => confirmFill(12)} />
        <MenuItem icon="trash-outline" label="Nuke database" hint="Delete all local data" destructive onPress={confirmNuke} />
        <MenuItem
          icon="eye-off-outline"
          label="Hide gear"
          hint="Tap the tab on the left edge to bring it back"
          onPress={() => {
            close();
            setHidden(true);
          }}
        />
      </PopoverMenu>
    </>
  );
}
