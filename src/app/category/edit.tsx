import { Stack, router, useLocalSearchParams } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CategoryBadge } from '@/components/CategoryBadge';
import { FormField } from '@/components/FormField';
import { Icon } from '@/components/Icon';
import { IconPickerSheet } from '@/components/IconPickerSheet';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { TintPicker } from '@/components/TintPicker';
import { Touchable } from '@/components/Touchable';
import { FALLBACK_ICON, templateOf, templatesFor, type CategoryIcon, type TemplateKey } from '@/constants/categories';
import {
  archiveCategory,
  categoryUsage,
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  nextTint,
  putCategory,
  updateCategory,
} from '@/db/categoriesRepository';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useT } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { showToast } from '@/store/useToastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type TintKey } from '@/theme/themes';
import { CATEGORY_KINDS, type Category, type CategoryKind } from '@/types/models';
import { categoryName, iconLabelKey, shownNames, storedName, templateLabelKey } from '@/utils/categoryNames';
import { errorAlert } from '@/utils/errorMessage';
import { hapticSuccess, hapticTick } from '@/utils/haptics';

interface Draft {
  template: TemplateKey | null;
  /** The text in the name field (a template fills in its name; `storedName` decides what is saved). */
  name: string;
  icon: CategoryIcon;
  tint: TintKey;
}

const invalidate = () => useAppStore.getState().invalidateData();

/**
 * The category editor (§7.4), as a modal. New: kind, then the §7.3 templates (tap one to fill in name,
 * icon and colour; tap it again to start blank), then the fields. Edit: the same fields, plus
 * Archive / Restore and Delete. Params: `id` to edit, or `kind` for a new category; `pick=1` (from the
 * add-transaction form's "+ New") hands the new category back so the form selects it.
 */
export default function CategoryEditorScreen() {
  const params = useLocalSearchParams<{ id?: string; kind?: string; pick?: string }>();
  const editId = params.id ? Number(params.id) : null;
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = theme.colors;
  const translator = useT();
  const { t, lang } = translator;

  const [kind, setKind] = useState<CategoryKind>(params.kind === 'INCOME' ? 'INCOME' : 'EXPENSE');
  const load = useCallback(
    async (db: SQLiteDatabase) => {
      const existing = editId === null ? null : await getCategory(db, editId);
      const k = existing?.kind ?? kind;
      return { kind: k, existing, active: await listCategories(db, k), tint: await nextTint(db, k) };
    },
    [editId, kind],
  );
  const { data, db } = useDbQuery(load);

  // The form = what was loaded (the category, or a blank one for the chosen kind) + the user's edits.
  // `edited` is null until the first change, and reset when the kind changes.
  const [edited, setDraft] = useState<Draft | null>(null);
  const loaded = useMemo<Draft | null>(() => {
    if (!data) return null;
    const e = data.existing;
    if (e) return { template: e.template_key, name: categoryName(e, lang), icon: e.icon, tint: e.tint };
    // Wait for the data of the kind just chosen (its next tint), not the previous kind's.
    return data.kind === kind ? { template: null, name: '', icon: FALLBACK_ICON, tint: data.tint } : null;
  }, [data, kind, lang]);
  const draft = edited ?? loaded;
  const [pickingIcon, setPickingIcon] = useState(false);
  const [busy, setBusy] = useState(false);

  const existing = data?.existing ?? null;
  const isNew = editId === null;

  /** Templates whose untouched name an active category already shows under. */
  const usedTemplates = useMemo(() => {
    const taken = new Set((data?.active ?? []).flatMap((cat) => [...shownNames(cat)]));
    return new Set(
      templatesFor(kind)
        .map((tpl) => tpl.key as TemplateKey)
        .filter((key) => [...shownNames({ name: null, template_key: key })].some((n) => taken.has(n))),
    );
  }, [data, kind]);

  const fail = (e: unknown) => {
    const { title, message } = errorAlert(e, translator);
    Alert.alert(title, message);
  };

  if (editId !== null && data && !existing) {
    return (
      <View style={{ flex: 1, padding: spacing.lg, backgroundColor: c.background }}>
        <Stack.Screen options={{ title: t('screen.editCategory') }} />
        <AppText tone="muted">{t('error.category.notFound')}</AppText>
      </View>
    );
  }

  const shown = draft ? (draft.name.trim() ? draft.name.trim() : draft.template ? t(templateLabelKey(draft.template)) : '') : '';
  const canSave = !!draft && !busy && !!(draft.name.trim() || draft.template);

  const pickTemplate = (key: TemplateKey) => {
    hapticTick();
    if (draft?.template === key) {
      // Tapping the selected template again starts blank.
      setDraft({ template: null, name: '', icon: FALLBACK_ICON, tint: data?.tint ?? 'rose' });
      return;
    }
    const tpl = templateOf(key);
    setDraft({ template: key, name: t(templateLabelKey(key)), icon: tpl.icon, tint: tpl.tint });
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    const name = storedName(draft.name, draft.template);
    try {
      if (isNew) {
        const id = await createCategory(db, { kind, name, templateKey: draft.template, icon: draft.icon, tint: draft.tint });
        if (params.pick) useAppStore.getState().setPickedCategoryId(id);
        invalidate();
        hapticSuccess();
        router.back();
        showToast({
          message: t('toast.category.added', { name: categoryName({ name, template_key: draft.template }, lang) }),
          actionLabel: t('common.undo'),
          onAction: async () => {
            await deleteCategory(db, id).catch(() => {});
            invalidate();
          },
        });
      } else if (existing) {
        const before = existing;
        await updateCategory(db, before.id, { name, icon: draft.icon, tint: draft.tint });
        invalidate();
        hapticSuccess();
        router.back();
        showToast({ message: t('toast.category.saved'), actionLabel: t('common.undo'), onAction: () => undoTo(db, before) });
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const archive = async (category: Category) => {
    try {
      await archiveCategory(db, category.id);
      invalidate();
      router.back();
      showToast({
        message: t('toast.category.archived', { name: categoryName(category, lang) }),
        actionLabel: t('common.undo'),
        onAction: () => undoTo(db, category),
      });
    } catch (e) {
      fail(e);
    }
  };

  const remove = async (category: Category) => {
    const name = categoryName(category, lang);
    const uses = await categoryUsage(db, category.id);
    if (uses > 0) {
      // A used category is never deleted (§3): offer to archive it instead.
      Alert.alert(t('dialog.categoryInUse.title'), translator.tp('dialog.categoryInUse.body', uses, { name }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.archive'), onPress: () => void archive(category) },
      ]);
      return;
    }
    Alert.alert(t('dialog.deleteCategory.title'), t('dialog.deleteCategory.body', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            const removed = await deleteCategory(db, category.id);
            invalidate();
            router.back();
            showToast({ message: t('toast.category.deleted', { name }), actionLabel: t('common.undo'), onAction: () => undoTo(db, removed) });
          } catch (e) {
            fail(e);
          }
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: t(isNew ? 'screen.newCategory' : 'screen.editCategory') }} />
      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={spacing.xl}
      >
        {draft && (
          <>
            {/* Live preview of the badge as it will look in lists. */}
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }} accessibilityLabel={`${t('editor.preview')}: ${shown}`}>
              <CategoryBadge icon={draft.icon} tint={draft.tint} size={52} />
              <View style={{ flex: 1 }}>
                <AppText variant="title" numberOfLines={2} tone={shown ? 'default' : 'muted'}>
                  {shown || t('editor.name.placeholder')}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {t(`kind.${kind}`)}
                </AppText>
              </View>
            </Card>

            {isNew && (
              <FormField label={t('editor.kind')}>
                <SegmentedControl
                  options={CATEGORY_KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))}
                  value={kind}
                  onChange={(k) => {
                    if (k === kind) return;
                    setKind(k);
                    setDraft(null);
                  }}
                />
              </FormField>
            )}

            {isNew && (
              <View style={{ gap: spacing.sm }}>
                <View>
                  <AppText variant="label" tone="muted">
                    {t('editor.templates')}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {t('editor.templates.hint')}
                  </AppText>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {templatesFor(kind).map((tpl) => {
                    const key = tpl.key as TemplateKey;
                    const used = usedTemplates.has(key);
                    const selected = draft.template === key;
                    const label = t(templateLabelKey(key));
                    return (
                      <Touchable
                        key={key}
                        onPress={() => pickTemplate(key)}
                        disabled={used}
                        accessibilityRole="radio"
                        accessibilityState={{ selected, disabled: used }}
                        accessibilityLabel={used ? `${label}, ${t('editor.template.added')}` : label}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.sm,
                          minHeight: 40,
                          paddingLeft: 5,
                          paddingRight: spacing.md,
                          paddingVertical: 4,
                          borderRadius: radius.pill,
                          backgroundColor: selected || pressed ? c.track : c.surface,
                          borderWidth: 1.5,
                          borderColor: selected ? c.primaryText : c.border,
                          opacity: used ? 0.45 : 1,
                        })}
                      >
                        <CategoryBadge icon={tpl.icon} tint={tpl.tint} size={28} />
                        <AppText variant="label">{label}</AppText>
                        {used ? <Icon name="checkmark" size={14} color={c.textMuted} /> : null}
                      </Touchable>
                    );
                  })}
                </View>
              </View>
            )}

            <FormField label={t('editor.name')}>
              <TextField
                value={draft.name}
                onChangeText={(name) => setDraft({ ...draft, name })}
                placeholder={draft.template ? t(templateLabelKey(draft.template)) : t('editor.name.placeholder')}
                accessibilityLabel={t('editor.name')}
                maxLength={40}
                returnKeyType="done"
                autoCapitalize="sentences"
              />
            </FormField>

            <FormField label={t('editor.icon')}>
              <Touchable
                onPress={() => setPickingIcon(true)}
                accessibilityRole="button"
                accessibilityLabel={`${t('editor.icon.change')}: ${t(iconLabelKey(draft.icon))}`}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  minHeight: 52,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor: pressed ? c.track : c.surface,
                  borderWidth: 1.5,
                  borderColor: c.border,
                })}
              >
                <CategoryBadge icon={draft.icon} tint={draft.tint} />
                <AppText variant="body" style={{ flex: 1 }}>
                  {t(iconLabelKey(draft.icon))}
                </AppText>
                <AppText variant="label" style={{ color: c.primaryText }}>
                  {t('editor.icon.change')}
                </AppText>
              </Touchable>
            </FormField>

            <FormField label={t('editor.colour')}>
              <TintPicker value={draft.tint} onChange={(tint) => setDraft({ ...draft, tint })} />
            </FormField>

            <View style={{ gap: spacing.sm }}>
              <Button label={t('common.save')} onPress={save} disabled={!canSave} loading={busy} />
              {existing && !existing.archived_at && (
                <Button label={t('common.archive')} kind="soft" icon="archive-outline" onPress={() => void archive(existing)} />
              )}
              {existing && <Button label={t('common.delete')} kind="danger" icon="trash-outline" onPress={() => void remove(existing)} />}
            </View>
          </>
        )}
      </KeyboardAwareScrollView>

      {pickingIcon && draft && (
        <IconPickerSheet
          value={draft.icon}
          tint={draft.tint}
          onClose={() => setPickingIcon(false)}
          onPick={(icon) => {
            setDraft({ ...draft, icon });
            setPickingIcon(false);
          }}
        />
      )}
    </>
  );
}

/** Undo: put the category back exactly as it was before the action. */
async function undoTo(db: SQLiteDatabase, snapshot: Category) {
  await putCategory(db, snapshot);
  invalidate();
}
