import { useRef, useState } from 'react';
import { AccessibilityInfo, View, type TextInputInstance } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { Touchable } from '@/components/Touchable';
import { BRAND } from '@/constants/brand';
import { useT } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/themes';
import { errorAlert } from '@/utils/errorMessage';
import { hapticNudge } from '@/utils/haptics';

/**
 * Sign in (§4, since 0.5.0): email + password of an account made in the project's dashboard (§0.4). No sign-up,
 * no password reset in the app (§14.13). The button is always enabled and always says "Sign in" (owner, 0.2.0:
 * no disabled buttons); what's missing or refused shows as a calm line, never red (§5). A build without
 * Supabase settings says the app isn't set up yet instead.
 */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = theme.colors;
  const translator = useT();
  const { t } = translator;
  const { status, signIn } = useAuth();
  // "Remember me" (§4): the last signed-in email is filled in; the password never is.
  const [email, setEmail] = useState(() => useAppStore.getState().lastEmail ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const say = (text: string) => {
    hapticNudge();
    setMessage(text);
    AccessibilityInfo.announceForAccessibility(text);
  };

  const submit = async () => {
    if (busy) return;
    if (!email.trim() || !password) return say(t('signIn.missing'));
    setBusy(true);
    setMessage(null);
    try {
      await signIn(email, password);
      // The guard in the root layout opens Home once the session arrives.
    } catch (e) {
      say(errorAlert(e, translator).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={spacing.xl}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        padding: spacing.xl,
        paddingTop: insets.top + spacing.xl,
        paddingBottom: insets.bottom + spacing.xl,
        gap: spacing.xl,
      }}
    >
      <View style={{ alignItems: 'center', gap: 2 }}>
        <AppText variant="display">{BRAND.name}</AppText>
        <AppText variant="label" tone="muted">
          {BRAND.fullName}
        </AppText>
      </View>

      {status === 'unconfigured' ? (
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="title">{t('signIn.notSetUp.title')}</AppText>
          <AppText tone="muted">{t('signIn.notSetUp.body')}</AppText>
        </Card>
      ) : (
        <Card style={{ gap: spacing.md }}>
          <View style={{ gap: 4 }}>
            <AppText variant="title" accessibilityRole="header">
              {t('signIn.title')}
            </AppText>
            <AppText variant="caption" tone="muted">
              {t('signIn.body')}
            </AppText>
          </View>
          <TextField
            leading={<Icon name="mail-outline" size={18} color={c.textMuted} />}
            value={email}
            onChangeText={setEmail}
            placeholder={t('signIn.email')}
            accessibilityLabel={t('signIn.email')}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            submitBehavior="submit"
          />
          <TextField
            ref={passwordRef}
            leading={<Icon name="lock-closed-outline" size={18} color={c.textMuted} />}
            trailing={
              <Touchable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t(showPassword ? 'signIn.hidePassword' : 'signIn.showPassword')}
              >
                <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.textMuted} />
              </Touchable>
            }
            value={password}
            onChangeText={setPassword}
            placeholder={t('signIn.password')}
            accessibilityLabel={t('signIn.password')}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
          {message ? (
            <AppText variant="label" style={{ color: c.primaryText }} accessibilityLiveRegion="polite">
              {message}
            </AppText>
          ) : null}
          <Button label={t('signIn.submit')} onPress={() => void submit()} loading={busy} />
          <AppText variant="caption" tone="muted">
            {t('signIn.help')}
          </AppText>
        </Card>
      )}
    </KeyboardAwareScrollView>
  );
}
