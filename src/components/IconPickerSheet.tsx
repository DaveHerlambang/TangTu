import { useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { categoryGlyph } from '@/components/CategoryBadge';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { Touchable } from '@/components/Touchable';
import { ICON_GROUPS, type CategoryIcon } from '@/constants/categories';
import { useT } from '@/i18n';
import { translate } from '@/i18n/core';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type TintKey } from '@/theme/themes';
import { iconGroupLabelKey, iconLabelKey, nameKey } from '@/utils/categoryNames';
import { hapticTick } from '@/utils/haptics';

interface IconPickerSheetProps {
  value: CategoryIcon;
  /** The category's tint: the selected icon is previewed in it. */
  tint: TintKey;
  onPick: (icon: CategoryIcon) => void;
  onClose: () => void;
}

const PER_ROW = 6;

/**
 * §7.4: the §7.2 groups as sections, 6 per row. Search matches the icon's name in either language
 * (so "kopi" and "coffee" both find the cup) and the group's name in the current one.
 */
export function IconPickerSheet({ value, tint, onPick, onClose }: IconPickerSheetProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, lang } = useT();
  const { height } = useWindowDimensions();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = nameKey(query);
    if (!q) return ICON_GROUPS;
    return ICON_GROUPS.map((g) => {
      if (nameKey(t(iconGroupLabelKey(g.key))).includes(q)) return g;
      const icons = g.icons.filter((icon: CategoryIcon) =>
        [translate('en', iconLabelKey(icon)), translate('id', iconLabelKey(icon)), icon.replace(/-/g, ' ')].some((s) => nameKey(s).includes(q)),
      );
      return { ...g, icons };
    }).filter((g) => g.icons.length > 0);
  }, [query, t]);

  const { fill, ink } = theme.tints[tint];

  return (
    <BottomSheet visible onClose={onClose}>
      <View style={{ gap: spacing.md }}>
        <AppText variant="title">{t('icons.title')}</AppText>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={t('icons.search')}
          accessibilityLabel={t('icons.search')}
          returnKeyType="search"
          autoCorrect={false}
          leading={<Icon name="search-outline" size={16} />}
        />
        <ScrollView style={{ maxHeight: height * 0.5 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md }}>
          {groups.length === 0 ? (
            <AppText variant="body" tone="muted" style={{ textAlign: 'center', paddingVertical: spacing.lg }}>
              {t('icons.none', { query: query.trim() })}
            </AppText>
          ) : (
            groups.map((g) => (
              <View key={`${lang}-${g.key}`} style={{ gap: spacing.xs }}>
                <AppText variant="label" tone="muted">
                  {t(iconGroupLabelKey(g.key))}
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
                  {g.icons.map((icon: CategoryIcon) => {
                    const selected = icon === value;
                    return (
                      <View key={icon} style={{ width: `${100 / PER_ROW}%`, padding: 3 }}>
                        <Touchable
                          onPress={() => {
                            hapticTick();
                            onPick(icon);
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={t(iconLabelKey(icon))}
                          style={({ pressed }) => ({
                            aspectRatio: 1,
                            minHeight: 44,
                            borderRadius: radius.md,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: selected ? fill : pressed ? c.track : 'transparent',
                            borderWidth: selected ? 2 : 0,
                            borderColor: ink,
                          })}
                        >
                          <Icon name={categoryGlyph(icon)} size={22} color={selected ? ink : c.text} />
                        </Touchable>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}
