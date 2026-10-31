import { Text as RNText, type TextProps, type TextStyle, type ColorValue } from 'react-native';
import { C } from './theme';

/** Thang chữ theo iOS (cỡ chuẩn khi Dynamic Type ở mức mặc định). */
const VARIANTS = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.35 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: 0.38 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.32 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.24 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof VARIANTS;

export interface TxtProps extends TextProps {
  variant?: TextVariant;
  color?: ColorValue;
  weight?: TextStyle['fontWeight'];
  /** Số đều cột (tiền, số lượng). */
  numeric?: boolean;
  align?: TextStyle['textAlign'];
}

export function Txt({ variant = 'body', color, weight, numeric, align, style, ...rest }: TxtProps) {
  return (
    <RNText
      {...rest}
      style={[
        VARIANTS[variant],
        { color: color ?? C.label },
        weight ? { fontWeight: weight } : null,
        numeric ? { fontVariant: ['tabular-nums'] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
