import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/themes';

/**
 * "Can't reach your data" with Try again (§5, since 0.5.0): calm, never red, never a technical message. Shown
 * above whatever was last loaded, so a dropped connection doesn't look like an empty month.
 */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useT();
  const { theme } = useTheme();
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} accessible accessibilityLiveRegion="polite">
        <Icon name="cloud-offline-outline" size={20} color={theme.colors.textMuted} />
        <AppText variant="label" style={{ flex: 1 }}>
          {t('home.loadError')}
        </AppText>
      </View>
      <Button label={t('common.tryAgain')} kind="soft" size="sm" icon="refresh" onPress={onRetry} />
    </Card>
  );
}
