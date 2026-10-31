import { Text as RNText, type ColorValue, type TextProps, type TextStyle } from 'react-native';
import { C, fonts, type FontWeight } from './theme';

/** Thang chữ (dòng cao để dấu tiếng Việt không bị cắt). */
const VARIANTS = {
  display: { fontSize: 28, lineHeight: 36, weight: 'bold' },
  title: { fontSize: 22, lineHeight: 30, weight: 'bold' },
  heading: { fontSize: 17, lineHeight: 24, weight: 'semibold' },
  body: { fontSize: 15, lineHeight: 22, weight: 'regular' },
  label: { fontSize: 13, lineHeight: 18, weight: 'medium' },
  caption: { fontSize: 12, lineHeight: 16, weight: 'regular' },
} satisfies Record<string, { fontSize: number; lineHeight: number; weight: FontWeight }>;

export type TextVariant = keyof typeof VARIANTS;

export interface TxtProps extends TextProps {
  variant?: TextVariant;
  color?: ColorValue;
  weight?: FontWeight;
  /** Số đều cột (tiền, số lượng). */
  numeric?: boolean;
  align?: TextStyle['textAlign'];
}

export function Txt({ variant = 'body', color, weight, numeric, align, style, ...rest }: TxtProps) {
  const v = VARIANTS[variant];
  return (
    <RNText
      {...rest}
      style={[
        {
          fontSize: v.fontSize,
          lineHeight: v.lineHeight,
          fontFamily: fonts[weight ?? v.weight],
          color: color ?? C.text,
        },
        numeric ? { fontVariant: ['tabular-nums'] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
