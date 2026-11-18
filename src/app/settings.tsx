import Constants from 'expo-constants';
import { useLocales } from 'expo-localization';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { ThemeSwatch } from '@/components/ThemeSwatch';
import { Touchable } from '@/components/Touchable';
import { BRAND } from '@/constants/brand';
import { useT, type LanguagePref, type MessageKey } from '@/i18n';
import { LANGUAGE_PREFS, resolveLanguage } from '@/i18n/core';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { THEME_ORDER, radius, spacing, themes, type ThemeName } from '@/theme/themes';
import { hapticTick } from '@/utils/haptics';

const THEME_LABEL: Record<ThemeName, MessageKey> = { sakura: 'theme.sakura', light: 'theme.light', dark: 'theme.dark' };
const LANGUAGE_LABEL: Record<LanguagePref, MessageKey> = { system: 'language.system', en: 'language.en', id: 'language.id' };

/**
 * Settings (§4). Phase 1: Theme and Language. Later phases add the period start day, categories,
 * backup / restore / undo restore with "Last backup", and What's new.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useT();
  const c = theme.colors;
  const defaultTheme = useAppStore((s) => s.defaultTheme);
  const setDefaultTheme = useAppStore((s) => s.setDefaultTheme);
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const [sheet, setSheet] = useState<'theme' | 'language' | null>(null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
    >
      <Section title={t('settings.appearance')}>
        <Row
          icon="color-palette-outline"
          label={t('settings.theme')}
          detail={t('settings.theme.detail')}
          value={t(THEME_LABEL[defaultTheme])}
          onPress={() => setSheet('theme')}
        />
        <Divider />
        <Row
          icon="language-outline"
          label={t('settings.language')}
          detail={t('settings.language.detail')}
          value={t(LANGUAGE_LABEL[language])}
          onPress={() => setSheet('language')}
        />
      </Section>

      <View style={{ alignItems: 'center', gap: 2 }}>
        <AppText variant="label" tone="muted">
          {BRAND.name} · {BRAND.fullName}
        </AppText>
        <AppText variant="caption" tone="muted">
          {t('settings.version', { version: Constants.expoConfig?.version ?? '' })}
        </AppText>
      </View>

      {sheet === 'theme' && (
        <ChoiceSheet
          title={t('settings.theme')}
          hint={t('settings.theme.sheetHint')}
          options={THEME_ORDER.map((name) => ({
            key: name,
            label: t(THEME_LABEL[name]),
            leading: <ThemeSwatch theme={themes[name]} size={30} />,
          }))}
          value={defaultTheme}
          onClose={() => setSheet(null)}
          onPick={(name) => {
            setDefaultTheme(name);
            setSheet(null);
          }}
        />
      )}
      {sheet === 'language' && (
        <LanguageSheet
          value={language}
          onClose={() => setSheet(null)}
          onPick={(pref) => {
            setLanguage(pref);
            setSheet(null);
          }}
        />
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------

function LanguageSheet({ value, onPick, onClose }: { value: LanguagePref; onPick: (pref: LanguagePref) => void; onClose: () => void }) {
  const { t } = useT();
  // What "Follow phone" means right now, named in that language's own words.
  const phone = resolveLanguage('system', useLocales()[0]?.languageCode);
  return (
    <ChoiceSheet
      title={t('settings.language')}
      hint={t('settings.language.sheetHint')}
      options={LANGUAGE_PREFS.map((pref) => ({
        key: pref,
        label: t(LANGUAGE_LABEL[pref]),
        detail: pref === 'system' ? t('language.system.detail', { language: t(LANGUAGE_LABEL[phone]) }) : undefined,
      }))}
      value={value}
      onClose={onClose}
      onPick={onPick}
    />
  );
}

interface ChoiceOption<K extends string> {
  key: K;
  label: string;
  detail?: string;
  leading?: ReactNode;
}

/** A bottom sheet with a single-choice list (TracKar's theme sheet, generalised). */
function ChoiceSheet<K extends string>({
  title,
  hint,
  options,
  value,
  onPick,
  onClose,
}: {
  title: string;
  hint: string;
  options: ChoiceOption<K>[];
  value: K;
  onPick: (key: K) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <BottomSheet visible onClose={onClose}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ marginBottom: spacing.xs }}>
          <AppText variant="title">{title}</AppText>
          <AppText variant="caption" tone="muted">
            {hint}
          </AppText>
        </View>
        {options.map((o) => {
          const selected = o.key === value;
          return (
            <Touchable
              key={o.key}
              onPress={() => {
                hapticTick();
                onPick(o.key);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={o.detail ? `${o.label}, ${o.detail}` : o.label}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                minHeight: 52,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: selected || pressed ? c.track : 'transparent',
              })}
            >
              {o.leading}
              <View style={{ flex: 1 }}>
                <AppText variant="body">{o.label}</AppText>
                {o.detail ? (
                  <AppText variant="caption" tone="muted">
                    {o.detail}
                  </AppText>
                ) : null}
              </View>
              {selected ? <Icon name="checkmark" size={18} color={c.primaryText} /> : null}
            </Touchable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

function Section({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label" tone="muted" style={{ paddingLeft: spacing.xs }}>
        {title}
      </AppText>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {children}
      </Card>
      {footer && (
        <AppText variant="caption" tone="muted" style={{ paddingHorizontal: spacing.xs }}>
          {footer}
        </AppText>
      )}
    </View>
  );
}

function RowIcon({ icon }: { icon: IconName }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.track,
      }}
    >
      <Icon name={icon} size={18} color={theme.colors.text} />
    </View>
  );
}

function Row({
  icon,
  label,
  detail,
  value,
  onPress,
  busy,
}: {
  icon: IconName;
  label: string;
  detail: string;
  value?: string;
  onPress: () => void;
  busy?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        backgroundColor: pressed ? theme.colors.track : 'transparent',
        opacity: busy ? 0.5 : 1,
      })}
    >
      <RowIcon icon={icon} />
      <View style={{ flex: 1 }}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="caption" tone="muted">
          {detail}
        </AppText>
      </View>
      {/* The value may wrap under itself in Indonesian at 1.3× rather than squeeze the label. */}
      {value ? (
        <AppText variant="label" tone="accent" style={{ flexShrink: 1, maxWidth: '45%', textAlign: 'right' }}>
          {value}
        </AppText>
      ) : null}
      <Icon name="chevron-forward" size={16} />
    </Touchable>
  );
}

function Divider() {
  const { theme } = useTheme();
  return <View style={{ height: 1, marginLeft: 60, backgroundColor: theme.colors.border }} />;
}
