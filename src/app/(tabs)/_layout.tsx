import { Tabs } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { useWideGutter, useWideLayout } from '@/hooks/useWideLayout';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/themes';

const tabIcon = (outline: IconName, filled: IconName) =>
  function TabBarIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return <Icon name={focused ? filled : outline} size={22} color={String(color)} />;
  };

/** Two tabs, like TracKar (Dashboard + Notes): Home and Charts. On a wide web window they sit in a rail on the left (0.6.0, §13.9). */
export default function TabsLayout() {
  const { theme } = useTheme();
  const { t } = useT();
  const c = theme.colors;
  const wide = useWideLayout();
  const insets = useSafeAreaInsets();
  // Charts on a wide window: a centred column beside the 88-wide rail.
  const chartsGutter = useWideGutter(88);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primaryText,
        tabBarInactiveTintColor: c.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11 },
        tabBarStyle: wide
          ? { width: 88, backgroundColor: c.surface, borderRightColor: c.border, borderTopWidth: 0 }
          : // The web's bottom bar is 56 high plus the safe area (0.6.4). At React Navigation's 49 each tab (5 px padding
            // top and bottom, a 28 px icon) left the label a 10 px box, which the web clips: "Home" / "Charts" were cut
            // off at the bottom (seen on the iPhone in Safari, measured in Chrome). The phone draws past the box, so
            // the phone app keeps 49.
            { backgroundColor: c.surface, borderTopColor: c.border, ...(Platform.OS === 'web' ? { height: 56 + insets.bottom } : null) },
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uikit',
        tabBarLabelPosition: 'below-icon',
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen
        name="charts"
        options={{
          title: t('tabs.charts'),
          tabBarIcon: tabIcon('bar-chart-outline', 'bar-chart'),
          sceneStyle: [{ backgroundColor: c.background }, chartsGutter],
        }}
      />
    </Tabs>
  );
}
