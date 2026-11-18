import { useState, type ReactNode, type Ref } from 'react';
// eslint-disable-next-line no-restricted-imports -- this is the one sanctioned wrapper around Pressable
import { Pressable, type GestureResponderEvent, type HostInstance, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

interface PressState {
  pressed: boolean;
}

export interface TouchableProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle> | ((state: PressState) => StyleProp<ViewStyle>);
  children?: ReactNode | ((state: PressState) => ReactNode);
  ref?: Ref<HostInstance>;
}

/**
 * Drop-in replacement for `Pressable` that supports `style={({ pressed }) => ...}` and
 * render-function children.
 *
 * Why it exists: NativeWind's JSX interop wraps every core `Pressable` and only understands
 * style *objects* — a style callback is silently discarded, so the component renders with no
 * styles at all. We track `pressed` ourselves and hand Pressable plain values instead.
 * ESLint blocks importing `Pressable` directly so this can't regress.
 */
export function Touchable({ style, children, onPressIn, onPressOut, ref, ...rest }: TouchableProps) {
  const [pressed, setPressed] = useState(false);
  const state = { pressed };

  return (
    <Pressable
      ref={ref}
      {...rest}
      onPressIn={(e: GestureResponderEvent) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={typeof style === 'function' ? style(state) : style}
    >
      {typeof children === 'function' ? children(state) : children}
    </Pressable>
  );
}
