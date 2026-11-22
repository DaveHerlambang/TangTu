import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/themes';

/**
 * Small muted label above a form control, with an optional "optional" hint. `message` shows a short line under
 * the label in the theme's primary text colour — what to do next (e.g. "Pick one to save"), never red (§5).
 */
export function FormField({
  label,
  optional,
  message,
  children,
}: {
  label: string;
  optional?: boolean;
  message?: string | null;
  children: ReactNode;
}) {
  const { t } = useT();
  const { theme } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label" tone="muted">
        {label}
        {optional ? <AppText variant="caption" tone="muted">{`  ${t('common.optional')}`}</AppText> : null}
      </AppText>
      {message ? (
        <AppText variant="label" accessibilityLiveRegion="polite" style={{ color: theme.colors.primaryText }}>
          {message}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}
