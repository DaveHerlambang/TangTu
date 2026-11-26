import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useLegacyMove } from '@/hooks/useLegacyMove';
import { useT } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { spacing } from '@/theme/themes';

/**
 * Home's one-time offer (§11, since 0.5.0): this phone still has the offline version's data — move it to the
 * account? "Not now" hides the card; Settings → Your data keeps the offer until it's moved.
 */
export function LegacyOffer() {
  const { t, tp } = useT();
  const dismissed = useAppStore((s) => s.legacyOfferDismissed);
  const dismiss = useAppStore((s) => s.dismissLegacyOffer);
  const { legacy, busy, start } = useLegacyMove();
  if (!legacy || dismissed) return null;
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 4 }}>
        <AppText variant="label">{t('legacy.title')}</AppText>
        <AppText variant="caption" tone="muted">
          {t('legacy.body', { transactions: tp('count.transactions', legacy.transactions), categories: tp('count.categories', legacy.categories) })}
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button label={t('legacy.move')} size="sm" icon="cloud-upload-outline" onPress={() => void start()} loading={busy} />
        <Button label={t('legacy.notNow')} size="sm" kind="soft" onPress={dismiss} />
      </View>
    </Card>
  );
}
