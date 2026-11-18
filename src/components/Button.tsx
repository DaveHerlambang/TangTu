import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { Touchable, type TouchableProps } from '@/components/Touchable';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/themes';

type ButtonKind = 'primary' | 'soft' | 'danger' | 'ghost';
type ButtonSize = 'md' | 'sm';

interface ButtonProps extends Omit<TouchableProps, 'style' | 'children'> {
  label: string;
  kind?: ButtonKind;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<ButtonSize, number> = { md: 48, sm: 36 };

export function Button({
  label,
  kind = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const palette: Record<ButtonKind, { bg: string; fg: string }> = {
    primary: { bg: c.primary, fg: c.onPrimary },
    soft: { bg: c.track, fg: c.text },
    danger: { bg: 'transparent', fg: c.danger },
    ghost: { bg: 'transparent', fg: c.textMuted },
  };
  const { bg, fg } = palette[kind];
  const isDisabled = disabled || loading;

  return (
    <Touchable
      {...rest}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      style={({ pressed }) => [
        {
          height: HEIGHT[size],
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingHorizontal: size === 'md' ? spacing.xl : spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isDisabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        kind === 'primary' && !isDisabled && { boxShadow: `0px 6px 14px ${c.shadow}` },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {icon ? <Icon name={icon} size={size === 'md' ? 18 : 16} color={fg} /> : null}
          <AppText variant={size === 'md' ? 'heading' : 'label'} style={{ color: fg }}>
            {label}
          </AppText>
        </View>
      )}
    </Touchable>
  );
}
