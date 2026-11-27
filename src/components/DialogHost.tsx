import { useEffect } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Touchable } from '@/components/Touchable';
import { useT } from '@/i18n';
import { useDialogStore } from '@/store/useDialogStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/themes';

/**
 * The web build's dialog (0.6.0; the phone uses the system's, see `showAlert`): a card in the middle of the
 * screen with the buttons in the order given, the last one being the action. Escape or a tap outside is the
 * cancel button (or just closes when there is none). Renders nothing on the phone.
 */
export function DialogHost() {
  const dialog = useDialogStore((s) => s.dialog);
  const close = useDialogStore((s) => s.close);
  const { theme } = useTheme();
  const { t } = useT();
  const c = theme.colors;

  const cancel = dialog?.buttons.find((b) => b.style === 'cancel');
  useEffect(() => {
    if (!dialog || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(dialog.id, cancel);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialog, cancel, close]);

  if (Platform.OS !== 'web' || !dialog) return null;
  const buttons = dialog.buttons.length > 0 ? dialog.buttons : [{ text: t('common.ok') }];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close(dialog.id, cancel)}>
      <View style={styles.center}>
        <Touchable
          onPress={() => close(dialog.id, cancel)}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10, 12, 20, 0.35)' }]}
        />
        <View
          accessibilityRole="alert"
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 420,
            gap: spacing.md,
            padding: spacing.xl,
            borderRadius: radius.lg,
            backgroundColor: c.surface,
            boxShadow: `0px 16px 40px ${c.shadow}`,
          }}
        >
          <AppText variant="heading">{dialog.title}</AppText>
          {dialog.message ? <AppText tone="muted">{dialog.message}</AppText> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm }}>
            {buttons.map((b, i) => (
              <Button
                key={`${i}:${b.text ?? ''}`}
                size="sm"
                label={b.text ?? t('common.ok')}
                kind={b.style === 'cancel' ? 'soft' : b.style === 'destructive' ? 'danger' : 'primary'}
                onPress={() => close(dialog.id, b)}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
});
