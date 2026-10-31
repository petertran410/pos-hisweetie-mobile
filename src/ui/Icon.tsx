import { SymbolView, type SFSymbol, type SymbolWeight } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import { C } from './theme';

export type IconName = SFSymbol;

/** Biểu tượng SF Symbols của iOS. */
export function Icon({
  name,
  size = 20,
  color,
  weight,
  style,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
  weight?: SymbolWeight;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color ?? C.tint}
      weight={weight}
      style={[{ width: size, height: size }, style]}
    />
  );
}
