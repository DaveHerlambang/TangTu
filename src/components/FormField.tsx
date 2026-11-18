import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useT } from '@/i18n';
import { spacing } from '@/theme/themes';

/** Small muted label above a form control, with an optional "optional" hint. */
export function FormField({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  const { t } = useT();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label" tone="muted">
        {label}
        {optional ? <AppText variant="caption" tone="muted">{`  ${t('common.optional')}`}</AppText> : null}
      </AppText>
      {children}
    </View>
  );
}
