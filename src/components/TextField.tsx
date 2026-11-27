import { useState, type ReactNode, type Ref } from 'react';
import { TextInput, View, type StyleProp, type TextInputInstance, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';

import { MAX_FONT_SCALE } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, spacing } from '@/theme/themes';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  /** Rendered inside the field, before the text (e.g. a currency prefix). */
  leading?: ReactNode;
  /** Rendered inside the field, after the text (e.g. a clear button). */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Overrides for the text itself (e.g. the wide layout's big amount). */
  inputStyle?: StyleProp<TextStyle>;
  ref?: Ref<TextInputInstance>;
}

export function TextField({ leading, trailing, style, inputStyle, onFocus, onBlur, ref, ...rest }: TextFieldProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: 46,
          paddingHorizontal: spacing.md + 2,
          borderRadius: radius.md,
          backgroundColor: c.surface,
          borderWidth: 1.5,
          // Focus ring in the theme's primary color makes the active field obvious.
          borderColor: focused ? c.primary : c.border,
        },
        style,
      ]}
    >
      {leading}
      <TextInput
        ref={ref}
        placeholderTextColor={c.textMuted}
        selectionColor={c.primary}
        cursorColor={c.primary}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[{ flex: 1, height: '100%', fontFamily: fonts.semibold, fontSize: 15, color: c.text, padding: 0 }, inputStyle]}
      />
      {trailing}
    </View>
  );
}
