import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { MenuItem, PopoverMenu, usePopoverAnchor } from '@/components/PopoverMenu';
import { Touchable } from '@/components/Touchable';
import { resetDatabase } from '@/db/database';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Developer tools: a floating gear (left edge) with a context menu. English only: they never ship,
 * so they skip the dictionaries.
 * Only load this through a `__DEV__` guard (see the root layout) so it never ships.
 */
export function DevToolsGear() {
  const db = useSQLiteContext();
  const { theme } = useTheme();
  const hidden = useAppStore((s) => s.devToolsHidden);
  const setHidden = useAppStore((s) => s.setDevToolsHidden);
  const invalidateData = useAppStore((s) => s.invalidateData);
  const { ref, anchor, open, close } = usePopoverAnchor();
  const [busy, setBusy] = useState(false);

  const nuke = async () => {
    setBusy(true);
    try {
      await resetDatabase(db);
      // Leave any detail screen (its row may be gone) and make every list re-query.
      if (router.canDismiss()) router.dismissAll();
      invalidateData();
      Alert.alert('Database reset', 'All local data was deleted.');
    } catch (e) {
      Alert.alert('Reset failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmNuke = () => {
    close();
    Alert.alert('Nuke database?', 'Are you sure? This will delete all local data.', [
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
        {/* Phase 5: "Mock data · 6 months / 1 year" (src/dev/mockData.ts, rewritten for transactions). */}
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
