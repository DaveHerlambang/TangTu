import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useLocales } from 'expo-localization';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { ChoiceSheet } from '@/components/ChoiceSheet';
import { StartDaySheet } from '@/components/StartDaySheet';
import { ThemeSwatch } from '@/components/ThemeSwatch';
import { Touchable } from '@/components/Touchable';
import { BRAND } from '@/constants/brand';
import { useT, type LanguagePref, type MessageKey } from '@/i18n';
import { LANGUAGE_PREFS, resolveLanguage } from '@/i18n/core';
import { formatDayMonth, formatDayMonthYear, formatTime } from '@/i18n/dates';
import type { BackupFile } from '@/db/backupRepository';
import { useDb } from '@/hooks/useDbQuery';
import { useLegacyMove } from '@/hooks/useLegacyMove';
import { exportBackup, getRestoreUndo, pickBackup, restoreBackup, RESTORE_UNDO_DAYS, undoRestore, type RestoreUndo } from '@/services/backup';
import { useAppStore } from '@/store/useAppStore';
import { showToast } from '@/store/useToastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { THEME_ORDER, radius, spacing, themes, type ThemeName } from '@/theme/themes';
import { errorAlert } from '@/utils/errorMessage';
import { formatBackupAge } from '@/utils/format';
import { showAlert } from '@/store/useDialogStore';

const THEME_LABEL: Record<ThemeName, MessageKey> = {
  sakura: 'theme.sakura',
  light: 'theme.light',
  matcha: 'theme.matcha',
  latte: 'theme.latte',
  dark: 'theme.dark',
  black: 'theme.black',
};
const LANGUAGE_LABEL: Record<LanguagePref, MessageKey> = { system: 'language.system', en: 'language.en', id: 'language.id' };

/**
 * Settings (§4): categories and the month's start day, theme and language, your data — backup, restore and
 * undo restore with "Last backup", moving the offline version's data (§11) — the account (signed in as, sign
 * out; since 0.5.0), and About: What's new and the version.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const translator = useT();
  const { t, tp, lang } = translator;
  const c = theme.colors;
  const db = useDb();
  const defaultTheme = useAppStore((s) => s.defaultTheme);
  const setDefaultTheme = useAppStore((s) => s.setDefaultTheme);
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const [sheet, setSheet] = useState<'theme' | 'language' | 'startDay' | null>(null);
  const startDay = useAppStore((s) => s.periodStartDay);
  const setPeriodStartDay = useAppStore((s) => s.setPeriodStartDay);
  const setSelectedPeriod = useAppStore((s) => s.setSelectedPeriod);
  const lastBackupAt = useAppStore((s) => s.lastBackupAt);
  const setLastBackupAt = useAppStore((s) => s.setLastBackupAt);
  const [busy, setBusy] = useState<'export' | 'restore' | 'undo' | null>(null);
  // What "Undo last restore" would bring back (the data from just before the latest restore).
  const [undo, setUndo] = useState<RestoreUndo | null>(null);
  const refreshUndo = useCallback(() => getRestoreUndo().then(setUndo), []);
  const { email, signOut } = useAuth();
  const legacyMove = useLegacyMove();
  useEffect(() => {
    void refreshUndo();
  }, [refreshUndo]);

  const fail = (e: unknown) => {
    const { title, message } = errorAlert(e, translator);
    showAlert(title, message);
  };
  const counts = (n: { categories: number; transactions: number }) => ({
    categories: tp('count.categories', n.categories),
    transactions: tp('count.transactions', n.transactions),
  });

  const doExport = async () => {
    setBusy('export');
    try {
      await exportBackup(db, t('settings.backup.shareTitle'));
      // The share sheet can't tell "saved" from "cancelled", so ask. Only "Yes, saved" moves "Last backup".
      showAlert(t('dialog.backupSaved.title'), t('dialog.backupSaved.body'), [
        { text: t('dialog.backupSaved.no'), style: 'cancel' },
        { text: t('dialog.backupSaved.yes'), onPress: () => setLastBackupAt(new Date().toISOString()) },
      ]);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const runRestore = async (backup: BackupFile) => {
    setBusy('restore');
    try {
      await restoreBackup(db, backup);
      await refreshUndo();
      showToast({ message: t('toast.backup.restored') });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  /** Restoring replaces everything, so it confirms first (§5), then keeps a safety copy for Undo. */
  const doRestore = async () => {
    setBusy('restore');
    try {
      const picked = await pickBackup();
      if (!picked) return;
      const { backup, summary } = picked;
      showAlert(t('dialog.restore.title'), t('dialog.restore.body', { date: formatDayMonthYear(summary.exportedAt, lang), ...counts(summary) }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('dialog.restore.confirm'),
          style: 'destructive',
          onPress: () => void runRestore(backup),
        },
      ]);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const runUndoRestore = async () => {
    setBusy('undo');
    try {
      await undoRestore(db);
      showToast({ message: t('toast.backup.undone') });
    } catch (e) {
      fail(e);
    } finally {
      await refreshUndo();
      setBusy(null);
    }
  };

  const doUndoRestore = () => {
    if (!undo) return;
    const saved = `${formatDayMonth(undo.savedAt, lang)} ${formatTime(undo.savedAt)}`;
    showAlert(t('dialog.undoRestore.title'), t('dialog.undoRestore.body', { date: saved, ...counts(undo) }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('dialog.undoRestore.confirm'),
        style: 'destructive',
        onPress: () => void runUndoRestore(),
      },
    ]);
  };

  /** Signing out asks first (§5); the data stays in the project. */
  const doSignOut = () => {
    showAlert(t('dialog.signOut.title'), t('dialog.signOut.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.account.signOut'), style: 'destructive', onPress: () => void signOut().catch(fail) },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
    >
      <Section title={t('settings.tracking')}>
        <Row
          icon="pricetags-outline"
          label={t('screen.categories')}
          detail={t('settings.categories.detail')}
          onPress={() => router.push('/categories')}
        />
        <Divider />
        <Row
          icon="calendar-outline"
          label={t('settings.startDay')}
          detail={t('settings.startDay.detail')}
          value={t('settings.startDay.value', { day: startDay })}
          onPress={() => setSheet('startDay')}
        />
      </Section>

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

      <Section title={t('settings.data')} footer={t('settings.data.footer', { days: RESTORE_UNDO_DAYS })}>
        <Row
          icon="cloud-upload-outline"
          label={t('settings.backup')}
          detail={t('settings.backup.last', { age: formatBackupAge(lastBackupAt, translator) })}
          onPress={doExport}
          busy={busy === 'export'}
          disabled={busy !== null}
        />
        <Divider />
        <Row
          icon="download-outline"
          label={t('settings.restore')}
          detail={t('settings.restore.detail')}
          onPress={doRestore}
          busy={busy === 'restore'}
          disabled={busy !== null}
        />
        {undo ? (
          <>
            <Divider />
            <Row
              icon="arrow-undo-outline"
              label={t('settings.undoRestore')}
              detail={t('settings.undoRestore.detail', { date: formatDayMonthYear(undo.until, lang) })}
              onPress={doUndoRestore}
              busy={busy === 'undo'}
              disabled={busy !== null}
            />
          </>
        ) : null}
        {legacyMove.legacy ? (
          <>
            <Divider />
            <Row
              icon="phone-portrait-outline"
              label={t('legacy.settings')}
              detail={t('legacy.settings.detail', { transactions: tp('count.transactions', legacyMove.legacy.transactions) })}
              onPress={() => void legacyMove.start()}
              busy={legacyMove.busy}
              disabled={busy !== null || legacyMove.busy}
            />
          </>
        ) : null}
      </Section>

      <Section title={t('settings.account')} footer={t('settings.account.footer')}>
        <Row
          icon="log-out-outline"
          label={t('settings.account.signOut')}
          detail={t('settings.account.signedInAs', { email: email ?? '' })}
          onPress={doSignOut}
          disabled={busy !== null}
        />
      </Section>

      <Section title={t('settings.about')}>
        <Row icon="sparkles-outline" label={t('settings.whatsNew')} detail={t('settings.whatsNew.detail')} onPress={() => router.push('/whats-new')} />
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
      {sheet === 'startDay' && (
        <StartDaySheet
          value={startDay}
          onClose={() => setSheet(null)}
          onPick={(day) => {
            setSheet(null);
            if (day === startDay) return;
            // Period keys mean something else with another start day: go back to the current one.
            setPeriodStartDay(day);
            setSelectedPeriod(null);
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
  // What "System default" means right now, named in that language's own words.
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
  disabled,
}: {
  icon: IconName;
  label: string;
  detail: string;
  value?: string;
  onPress: () => void;
  /** Working on it: a spinner instead of the chevron. */
  busy?: boolean;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityState={{ busy: !!busy, disabled: !!(busy || disabled) }}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={detail}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        backgroundColor: pressed ? theme.colors.track : 'transparent',
        opacity: disabled && !busy ? 0.5 : 1,
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
      {busy ? <ActivityIndicator size="small" color={theme.colors.textMuted} /> : <Icon name="chevron-forward" size={16} />}
    </Touchable>
  );
}

function Divider() {
  const { theme } = useTheme();
  return <View style={{ height: 1, marginLeft: 60, backgroundColor: theme.colors.border }} />;
}
