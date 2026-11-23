import '../../global.css';

import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { ThemedSplash } from '@/components/ThemedSplash';
import { ToastHost } from '@/components/ToastHost';
import { DATABASE_NAME, initializeDatabase } from '@/db/database';
import { useActivityEvents } from '@/hooks/useActivityEvents';
import { useHideAmountsInBackground } from '@/hooks/useAmounts';
import { useT } from '@/i18n';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/themes';

// Dev-only tools. `__DEV__` is inlined as `false` in production bundles, so Metro drops this
// branch *before* collecting dependencies and the module never ships (a top-level `import`
// would still be bundled even if the JSX were never rendered).
const DevToolsGear = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- the conditional require is what lets Metro strip it
    (require('@/components/DevToolsGear') as typeof import('@/components/DevToolsGear')).DevToolsGear
  : null;

// Keep the native splash up while fonts and the database load; the themed splash takes over
// from it (see ThemedSplash) so there's never a blank frame in between.
void SplashScreen.preventAutoHideAsync().catch(() => {});
const hideNativeSplash = () => void SplashScreen.hideAsync().catch(() => {});

/** Shown underneath the native splash while loading; matches its color. */
function Loading() {
  return <View style={{ flex: 1, backgroundColor: '#FCF6F9' }} />;
}

function ThemedStack() {
  useHideAmountsInBackground();
  useActivityEvents();
  const { theme } = useTheme();
  const { t } = useT();
  const c = theme.colors;
  // Once per launch: the greeting covers the first render, then fades to reveal the app.
  const [greeting, setGreeting] = useState(true);
  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: c.background },
          headerStyle: { backgroundColor: c.background },
          headerTintColor: c.text,
          headerTitleStyle: { fontFamily: fonts.extrabold, color: c.text },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          animation: 'slide_from_right',
        }}
      >
        {/*
          Every screen is singular (0.4.2, B10): a second tap while the first screen is still opening brings the
          same screen forward instead of stacking a copy — on a slow phone "+ New" opened two editors. `true` keys
          a screen by its path ([id], [date]); the editors keyed by a query parameter say which one.
        */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: t('screen.settings') }} dangerouslySingular />
        <Stack.Screen name="categories" options={{ title: t('screen.categories') }} dangerouslySingular />
        <Stack.Screen
          name="category/edit"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          dangerouslySingular={(name, params) => `${name}:${String(params.id ?? 'new')}`}
        />
        {/* Titles come from the screens themselves (the category's name, the day). */}
        <Stack.Screen name="category/[id]" dangerouslySingular />
        <Stack.Screen name="day/[date]" dangerouslySingular />
        <Stack.Screen name="notifications" options={{ title: t('screen.notifications') }} dangerouslySingular />
        <Stack.Screen
          name="whats-new"
          options={{ title: t('screen.whatsNew') }}
          dangerouslySingular={(name, params) => `${name}:${String(params.version ?? '')}`}
        />
        <Stack.Screen name="transaction/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} dangerouslySingular />
        <Stack.Screen name="transaction/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} dangerouslySingular />
      </Stack>
      {__DEV__ && DevToolsGear ? <DevToolsGear /> : null}
      <ToastHost />
      {greeting && <ThemedSplash onShown={hideNativeSplash} onDone={() => setGreeting(false)} />}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  // Safety net: never leave the native splash up if something goes wrong before the app renders.
  useEffect(() => {
    const t = setTimeout(hideNativeSplash, 5000);
    return () => clearTimeout(t);
  }, []);

  // On a font error we still render; text falls back to the system font.
  if (!fontsLoaded && !fontError) return <Loading />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <Suspense fallback={<Loading />}>
          <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase} useSuspense>
            <ThemeProvider>
              <ThemedStack />
            </ThemeProvider>
          </SQLiteProvider>
        </Suspense>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
