import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/themes';

const tabIcon = (outline: IconName, filled: IconName) =>
  function TabBarIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return <Icon name={focused ? filled : outline} size={22} color={String(color)} />;
  };

/** Two tabs, like TracKar (Dashboard + Notes): Home and Charts. */
export default function TabsLayout() {
  const { theme } = useTheme();
  const { t } = useT();
  const c = theme.colors;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primaryText,
        tabBarInactiveTintColor: c.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11 },
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen name="charts" options={{ title: t('tabs.charts'), tabBarIcon: tabIcon('bar-chart-outline', 'bar-chart') }} />
    </Tabs>
  );
}
