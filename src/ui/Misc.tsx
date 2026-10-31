import RNSegmentedControl, {
  type NativeSegmentedControlIOSChangeEvent,
  type SegmentedControlProps,
} from '@react-native-segmented-control/segmented-control';
import type { ComponentType } from 'react';
import { StyleSheet, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import { initials } from '@/core/format';
import { Txt } from './Text';
import { C } from './theme';

/** Vòng tròn chữ cái đầu (khách hàng, người dùng). */
export function Avatar({ name, size = 40, color, background }: { name?: string | null; size?: number; color?: ColorValue; background?: ColorValue }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background ?? C.tintSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Txt
        weight="600"
        color={color ?? C.tint}
        style={{ fontSize: Math.round(size * 0.38), lineHeight: Math.round(size * 0.46) }}>
        {initials(name)}
      </Txt>
    </View>
  );
}

// Kiểu class của thư viện chưa khớp React 19 → khai báo lại dạng component.
const SegmentedControl = RNSegmentedControl as unknown as ComponentType<SegmentedControlProps>;

/** Segmented control native của iOS. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SegmentedControl
      values={options.map((o) => o.label)}
      selectedIndex={Math.max(0, options.findIndex((o) => o.value === value))}
      onChange={(e: { nativeEvent: NativeSegmentedControlIOSChangeEvent }) => {
        const next = options[e.nativeEvent.selectedSegmentIndex];
        if (next) onChange(next.value);
      }}
      style={[{ height: 32 }, style]}
    />
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginLeft: inset }} />;
}
