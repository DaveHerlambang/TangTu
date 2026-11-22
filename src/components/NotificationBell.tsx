import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Touchable } from '@/components/Touchable';
import { countUnreadActivity } from '@/db/activityRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useT } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The bell on Home (§8.7, TracKar's). A red dot means the history has something newer than the last
 * time the bell was opened; opening the screen clears it.
 */
export function NotificationBell() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useT();
  const seenAt = useAppStore((s) => s.notificationsSeenAt);
  const query = useCallback((db: SQLiteDatabase) => countUnreadActivity(db, seenAt), [seenAt]);
  const { data: unread = 0 } = useDbQuery(query);
  const hasNew = unread > 0;

  return (
    <Touchable
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={hasNew ? t('bell.labelNew') : t('bell.label')}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name="notifications-outline" size={18} color={c.text} />
      {hasNew && (
        <View
          style={{
            position: 'absolute',
            top: 5,
            right: 6,
            width: 11,
            height: 11,
            borderRadius: 6,
            backgroundColor: c.danger,
            borderWidth: 2,
            borderColor: c.surface,
          }}
        />
      )}
    </Touchable>
  );
}
