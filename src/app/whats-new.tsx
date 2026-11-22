import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { Touchable } from '@/components/Touchable';
import { RELEASE_NOTES, findRelease, latestRelease, type ReleaseHeading, type ReleaseNotes } from '@/constants/releaseNotes';
import { useT, type Language } from '@/i18n';
import { formatDayMonthYear } from '@/i18n/dates';
import { appVersion } from '@/services/activityEvents';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/themes';

const releaseDate = (r: ReleaseNotes, lang: Language) => formatDayMonthYear(new Date(`${r.date}T12:00:00`), lang);

/** "1.2.1" → "1.2": versions are listed in series so the list stays short as releases pile up. */
const seriesOf = (version: string) => version.split('.').slice(0, 2).join('.');

const HEADING_KEY = { new: 'whatsNew.heading.new', improved: 'whatsNew.heading.improved', fixed: 'whatsNew.heading.fixed' } as const;

/**
 * What changed, in plain words, for any version (§10, TracKar's page), in the app's language.
 * ‹ Version 0.1.0 › steps to the previous / next release; tapping the version opens every release
 * grouped by series. Opened from the bell (that version) or Settings (the latest).
 */
export default function WhatsNewScreen() {
  const params = useLocalSearchParams<{ version?: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, lang } = useT();

  const [version, setVersion] = useState(() => (findRelease(params.version) ?? latestRelease()).version);
  const [picking, setPicking] = useState(false);
  const release = findRelease(version) ?? latestRelease();
  const text = release[lang];
  const current = appVersion();

  // RELEASE_NOTES is newest first: "older" is the next entry, "newer" the previous one.
  const index = RELEASE_NOTES.findIndex((r) => r.version === release.version);
  const older = RELEASE_NOTES[index + 1];
  const newer = index > 0 ? RELEASE_NOTES[index - 1] : undefined;

  const headingColor: Record<ReleaseHeading, string> = { new: c.primaryText, improved: c.accentAlt, fixed: c.success };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <StepButton icon="chevron-back" label={older ? t('whatsNew.older', { version: older.version }) : t('whatsNew.noOlder')} target={older} onPress={setVersion} />
        <Touchable
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel={t('whatsNew.choose', { version: release.version })}
          style={({ pressed }) => ({ flex: 1, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AppText variant="title">{t('whatsNew.version', { version: release.version })}</AppText>
            <Icon name="chevron-down" size={16} color={c.text} />
          </View>
          <AppText variant="caption" tone="muted">
            {release.version === current ? `${releaseDate(release, lang)} · ${t('whatsNew.youreHere')}` : releaseDate(release, lang)}
          </AppText>
        </Touchable>
        <StepButton icon="chevron-forward" label={newer ? t('whatsNew.newer', { version: newer.version }) : t('whatsNew.noNewer')} target={newer} onPress={setVersion} />
      </View>

      <AppText>{text.summary}</AppText>

      {text.sections.map((section) => (
        <Card key={section.heading} style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: headingColor[section.heading] }} />
            <AppText variant="title">{t(HEADING_KEY[section.heading])}</AppText>
          </View>
          <View style={{ gap: spacing.md }}>
            {section.items.map((item) => (
              <View key={item} style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 7, backgroundColor: c.textMuted }} />
                <AppText style={{ flex: 1 }}>{item}</AppText>
              </View>
            ))}
          </View>
        </Card>
      ))}

      {picking && (
        <VersionSheet
          selected={release.version}
          current={current}
          onPick={(v) => {
            setVersion(v);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </ScrollView>
  );
}

function StepButton({ icon, label, target, onPress }: { icon: IconName; label: string; target: ReleaseNotes | undefined; onPress: (version: string) => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const disabled = !target;
  return (
    <Touchable
      onPress={() => target && onPress(target.version)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.border : c.track,
        opacity: disabled ? 0.35 : 1,
      })}
    >
      <Icon name={icon} size={17} color={c.text} />
    </Touchable>
  );
}

/** Every release, grouped by series (1.2.x, 1.1.x, …). Only the chosen version's series starts open. */
function VersionSheet({ selected, current, onPick, onClose }: { selected: string; current: string; onPick: (version: string) => void; onClose: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, tp, lang } = useT();
  const { height } = useWindowDimensions();
  const series = [...new Set(RELEASE_NOTES.map((r) => seriesOf(r.version)))];
  const [open, setOpen] = useState<Set<string>>(() => new Set([seriesOf(selected)]));

  const toggle = (s: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  return (
    <BottomSheet visible onClose={onClose}>
      <AppText variant="title" style={{ marginBottom: spacing.sm }}>
        {t('whatsNew.versions')}
      </AppText>
      <ScrollView style={{ maxHeight: height * 0.6 }} showsVerticalScrollIndicator={false}>
        {series.map((s) => {
          const releases = RELEASE_NOTES.filter((r) => seriesOf(r.version) === s);
          const expanded = open.has(s);
          const caption = `${s}.x · ${tp('count.releases', releases.length)}`;
          return (
            <View key={s}>
              <Touchable
                onPress={() => toggle(s)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={caption}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.xs, opacity: pressed ? 0.6 : 1 })}
              >
                <AppText variant="label" tone="muted" style={{ flex: 1 }}>
                  {caption}
                </AppText>
                <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} />
              </Touchable>
              {expanded &&
                releases.map((r) => {
                  const isSelected = r.version === selected;
                  return (
                    <Touchable
                      key={r.version}
                      onPress={() => onPick(r.version)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${t('whatsNew.version', { version: r.version })}, ${releaseDate(r, lang)}`}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.md,
                        minHeight: 56,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.md,
                        backgroundColor: isSelected || pressed ? c.track : 'transparent',
                      })}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                          <AppText variant="heading">{r.version}</AppText>
                          <AppText variant="caption" tone="muted">
                            {releaseDate(r, lang)}
                          </AppText>
                          {r.version === current && (
                            <View style={{ paddingHorizontal: 6, borderRadius: radius.pill, backgroundColor: c.primary }}>
                              <AppText variant="caption" tone="onPrimary">
                                {t('whatsNew.current')}
                              </AppText>
                            </View>
                          )}
                        </View>
                        <AppText variant="caption" tone="muted" numberOfLines={1}>
                          {r[lang].summary}
                        </AppText>
                      </View>
                      {isSelected && <Icon name="checkmark" size={18} color={c.primaryText} />}
                    </Touchable>
                  );
                })}
            </View>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}
