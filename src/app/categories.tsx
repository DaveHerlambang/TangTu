import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CategoryBadge } from '@/components/CategoryBadge';
import { Icon } from '@/components/Icon';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SortableList } from '@/components/SortableList';
import { Touchable } from '@/components/Touchable';
import { listArchivedCategories, listCategories, putCategory, reorderCategories, restoreCategory } from '@/db/categoriesRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useT } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { showToast } from '@/store/useToastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/themes';
import { CATEGORY_KINDS, type Category, type CategoryKind } from '@/types/models';
import { categoryName } from '@/utils/categoryNames';
import { errorAlert } from '@/utils/errorMessage';

const ROW_HEIGHT = 60;

/**
 * Manage categories (§4, §7): Expense | Income, drag the grip to reorder, tap a row to edit (archive
 * and delete live in the editor), add from templates, and archived ones with Restore.
 */
export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = theme.colors;
  const translator = useT();
  const { t, lang } = translator;
  const [kind, setKind] = useState<CategoryKind>('EXPENSE');
  const [dragging, setDragging] = useState(false);

  const load = useCallback(
    async (db: SQLiteDatabase) => ({ active: await listCategories(db, kind), archived: await listArchivedCategories(db, kind) }),
    [kind],
  );
  const { data, db, reload } = useDbQuery(load);
  const active = data?.active ?? [];
  const archived = data?.archived ?? [];

  const fail = (e: unknown) => {
    const { title, message } = errorAlert(e, translator);
    Alert.alert(title, message);
  };

  const reorder = async (next: Category[]) => {
    try {
      await reorderCategories(db, kind, next.map((cat) => cat.id));
      await reload();
    } catch (e) {
      fail(e);
    }
  };

  const restore = async (category: Category) => {
    try {
      await restoreCategory(db, category.id);
      useAppStore.getState().invalidateData();
      showToast({
        message: t('toast.category.restored', { name: categoryName(category, lang) }),
        actionLabel: t('common.undo'),
        onAction: async () => {
          await putCategory(db, category);
          useAppStore.getState().invalidateData();
        },
      });
    } catch (e) {
      fail(e);
    }
  };

  return (
    <ScrollView
      scrollEnabled={!dragging}
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
    >
      <SegmentedControl
        options={CATEGORY_KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))}
        value={kind}
        onChange={setKind}
      />

      {data && active.length === 0 ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.track }}>
            <Icon name="pricetags-outline" size={20} color={c.text} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="heading">{t(`categories.empty.${kind}`)}</AppText>
            <AppText variant="caption" tone="muted">
              {t('categories.empty.body')}
            </AppText>
          </View>
        </Card>
      ) : active.length > 0 ? (
        <Card padded={false} style={{ paddingVertical: spacing.xs }}>
          <SortableList
            items={active}
            keyOf={(cat) => String(cat.id)}
            rowHeight={ROW_HEIGHT}
            onReorder={reorder}
            onDragStateChange={setDragging}
            renderRow={(cat, handle) => {
              const name = categoryName(cat, lang);
              return (
                <View style={{ height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingRight: spacing.sm }}>
                  <Touchable
                    onPress={() => router.push({ pathname: '/category/edit', params: { id: String(cat.id) } })}
                    accessibilityRole="button"
                    accessibilityLabel={t('categories.edit', { name })}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: ROW_HEIGHT,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      paddingLeft: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: pressed ? c.track : 'transparent',
                    })}
                  >
                    <CategoryBadge icon={cat.icon} tint={cat.tint} />
                    <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>
                      {name}
                    </AppText>
                  </Touchable>
                  {handle}
                </View>
              );
            }}
          />
        </Card>
      ) : null}

      <Button
        label={t('categories.add')}
        kind="soft"
        icon="add"
        onPress={() => router.push({ pathname: '/category/edit', params: { kind } })}
      />

      {archived.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <View style={{ paddingHorizontal: spacing.xs }}>
            <AppText variant="label" tone="muted">
              {t('categories.archived')}
            </AppText>
            <AppText variant="caption" tone="muted">
              {t('categories.archived.hint')}
            </AppText>
          </View>
          <Card padded={false} style={{ paddingVertical: spacing.xs }}>
            {archived.map((cat) => {
              const name = categoryName(cat, lang);
              return (
                <View key={cat.id} style={{ minHeight: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md }}>
                  <Touchable
                    onPress={() => router.push({ pathname: '/category/edit', params: { id: String(cat.id) } })}
                    accessibilityRole="button"
                    accessibilityLabel={t('categories.edit', { name })}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: ROW_HEIGHT }}
                  >
                    <CategoryBadge icon={cat.icon} tint={cat.tint} dimmed />
                    <AppText variant="body" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                      {name}
                    </AppText>
                  </Touchable>
                  <Button
                    label={t('common.restore')}
                    size="sm"
                    kind="soft"
                    accessibilityLabel={t('categories.restore', { name })}
                    onPress={() => void restore(cat)}
                  />
                </View>
              );
            })}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}
