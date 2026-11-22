import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, SectionList, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { Touchable } from '@/components/Touchable';
import { listActivity, type Activity, type ActivityKind } from '@/db/activityRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useT } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/themes';
import { describeActivity, formatActivityTime } from '@/utils/activityText';
import { formatAgo } from '@/utils/format';

const ICONS: Record<ActivityKind, IconName> = {
  recap: 'stats-chart-outline',
  restore: 'download-outline',
  restore_undone: 'arrow-undo-outline',
  whats_new: 'sparkles-outline',
};

/**
 * The bell's history (§8.7, TracKar's screen). Opening it marks everything as seen (clears the red
 * dot); rows that were new when you came in keep a soft outline until you leave. A row opens a sheet
 * with the full text and a shortcut to what it's about; What's new opens its own page.
 */
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = theme.colors;
  const translator = useT();
  const { t } = translator;

  // What counted as "new" when the bell was pressed (the store is updated right below).
  const [seenBefore] = useState(() => useAppStore.getState().notificationsSeenAt);
  useFocusEffect(
    useCallback(() => {
      useAppStore.getState().markNotificationsSeen();
    }, []),
  );

  const { data: items = [], loading } = useDbQuery(listActivity);
  const [selected, setSelected] = useState<Activity | null>(null);
  const isNew = useCallback((a: Activity) => seenBefore === null || a.created_at > seenBefore, [seenBefore]);

  const sections = useMemo(
    () =>
      [
        { key: 'new', title: t('notifications.new'), data: items.filter(isNew) },
        { key: 'earlier', title: t('notifications.earlier'), data: items.filter((a) => !isNew(a)) },
      ].filter((s) => s.data.length > 0),
    [items, isNew, t],
  );

  const open = (a: Activity) => {
    if (a.kind === 'whats_new') router.push({ pathname: '/whats-new', params: { version: a.params.version } });
    else setSelected(a);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SectionList
        sections={sections}
        keyExtractor={(a) => String(a.id)}
        renderItem={({ item }) => {
          const { title, body } = describeActivity(item, translator);
          return (
            <Touchable
              onPress={() => open(item)}
              accessibilityRole="button"
              accessibilityLabel={`${title}. ${body.split('\n')[0]}`}
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}
            >
              <Card style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderWidth: isNew(item) ? 1.5 : 0, borderColor: c.primary }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: c.track }}>
                  <Icon name={ICONS[item.kind]} size={19} color={c.text} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                      {title}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {formatAgo(item.created_at, translator)}
                    </AppText>
                  </View>
                  <AppText variant="caption" tone="muted" numberOfLines={2}>
                    {body}
                  </AppText>
                </View>
              </Card>
            </Touchable>
          );
        }}
        renderSectionHeader={({ section }) =>
          sections.length > 1 ? (
            <AppText variant="label" tone="muted" style={{ paddingTop: spacing.md, paddingBottom: spacing.sm }}>
              {section.title}
            </AppText>
          ) : (
            <View style={{ height: spacing.sm }} />
          )
        }
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          loading ? undefined : (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.track }}>
                <Icon name="notifications-outline" size={22} color={c.primaryText} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="heading">{t('notifications.empty.title')}</AppText>
                <AppText variant="caption" tone="muted">
                  {t('notifications.empty.body')}
                </AppText>
              </View>
            </Card>
          )
        }
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
      />

      {selected && <DetailSheet item={selected} onClose={() => setSelected(null)} />}
    </View>
  );
}

/** The full message, with a shortcut to what it's about. */
function DetailSheet({ item, onClose }: { item: Activity; onClose: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const translator = useT();
  const { t, lang } = translator;
  const { height } = useWindowDimensions();
  const { title, body } = describeActivity(item, translator);

  const go = (run: () => void) => {
    onClose();
    run();
  };
  const canUndo = item.kind === 'restore' && item.params.undoUntil !== null && new Date(item.params.undoUntil) > new Date();

  return (
    <BottomSheet visible onClose={onClose}>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.track }}>
            <Icon name={ICONS[item.kind]} size={20} color={c.text} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="title">{title}</AppText>
            <AppText variant="caption" tone="muted">
              {formatActivityTime(item.created_at, lang)}
            </AppText>
          </View>
        </View>

        <ScrollView style={{ maxHeight: height * 0.4 }} showsVerticalScrollIndicator={false}>
          <AppText selectable>{body}</AppText>
        </ScrollView>

        {item.kind === 'recap' ? (
          <Button
            label={t('notifications.openCharts')}
            icon="arrow-forward"
            onPress={() =>
              go(() => {
                // Charts opens on the recap's period (a past one, so it's stored as a key, not `null`).
                useAppStore.getState().setSelectedPeriod(item.params.period);
                router.navigate('/charts');
              })
            }
          />
        ) : null}
        {canUndo ? <Button label={t('notifications.openSettings')} icon="arrow-forward" onPress={() => go(() => router.push('/settings'))} /> : null}
        <Button label={t('common.close')} kind="soft" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}
