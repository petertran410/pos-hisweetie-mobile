import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Txt } from './Text';
import { C, fonts, radius, toneColors } from './theme';

export type TextInputRef = ComponentRef<typeof TextInput>;

/** Ô nhập có nhãn phía trên (như màn "Login to your account"). */
export function TextField({
  label,
  error,
  right,
  style,
  onFocus,
  onBlur,
  ref,
  ...rest
}: TextInputProps & { label: string; error?: string; right?: ReactNode; ref?: Ref<TextInputRef> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="label" weight="semibold">
        {label}
      </Txt>
      <View style={[styles.box, focused ? styles.focused : null, error ? { borderColor: toneColors.danger.fg } : null]}>
        <TextInput
          ref={ref}
          placeholderTextColor={C.faint}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, style]}
          {...rest}
        />
        {right}
      </View>
      {error ? (
        <Txt variant="caption" color={toneColors.danger.fg}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radius.control,
    borderWidth: 1.2,
    borderColor: '#D5DEE6',
    backgroundColor: C.card,
    paddingHorizontal: 14,
    gap: 8,
  },
  focused: { borderColor: C.brand, borderWidth: 1.6 },
  input: { flex: 1, fontSize: 16, fontFamily: fonts.regular, color: C.text, paddingVertical: 12 },
});
