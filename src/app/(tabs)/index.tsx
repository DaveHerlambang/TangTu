import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { PeriodHeader } from '@/components/PeriodHeader';
import { Touchable } from '@/components/Touchable';
import { BRAND } from '@/constants/brand';
import { usePeriodSettings } from '@/hooks/usePeriodSettings';
import { useT } from '@/i18n';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, type Theme } from '@/theme/themes';

/**
 * Home (§4): period header, summary card, day-grouped transactions, FAB.
 * Phase 1 shows the header and the empty state; the rest arrives with the core loop (phase 3).
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t } = useT();
  const { kind } = usePeriodSettings();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, gap: spacing.lg }}
    >
      <PeriodHeader
        caption={BRAND.name}
        right={
          <Touchable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel={t('home.settings')}
            hitSlop={6}
            style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Icon name="settings-outline" size={18} color={theme.colors.text} />
          </Touchable>
        }
      />

      <Card style={styles.emptyCard}>
        <View style={styles.emptyIcon}>
          <Icon name="wallet-outline" size={20} color={theme.colors.text} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{t(kind === 'month' ? 'home.empty.title.month' : 'home.empty.title.period')}</AppText>
          <AppText variant="caption" tone="muted">
            {t('home.empty.body')}
          </AppText>
        </View>
      </Card>
    </ScrollView>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.background },
    headerButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    emptyCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    emptyIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.track,
    },
  });
