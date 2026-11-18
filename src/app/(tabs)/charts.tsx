import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { PeriodHeader } from '@/components/PeriodHeader';
import { useT } from '@/i18n';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, type Theme } from '@/theme/themes';

/**
 * Charts (§9): where did it go · is this month worse · which days — for the period chosen on Home.
 * Phase 1 shows the shared period header and an empty state; the charts arrive in phase 4.
 */
export default function ChartsScreen() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const { t } = useT();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, gap: spacing.lg }}
    >
      <PeriodHeader caption={t('tabs.charts')} />

      <Card style={styles.emptyCard}>
        <View style={styles.emptyIcon}>
          <Icon name="bar-chart-outline" size={20} color={theme.colors.text} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{t('charts.empty.title')}</AppText>
          <AppText variant="caption" tone="muted">
            {t('charts.empty.body')}
          </AppText>
        </View>
      </Card>
    </ScrollView>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.background },
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
