import Svg, { Path } from 'react-native-svg';
import { View } from 'react-native';

/** Biểu tượng lá trà trên nền teal (dùng tạm đến khi có logo chính thức). */
export function Logo({ size = 88 }: { size?: number }) {
  return (
    <View
      accessibilityLabel="HiSweetie POS"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        backgroundColor: '#1A5F6A',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Svg width={size * 0.55} height={size * 0.55} viewBox="0 0 48 48" fill="none">
        <Path
          d="M10 38c0-15 10-26 28-28-1 18-12 28-27 28"
          stroke="#FFFFFF"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d="M10 38c6-9 13-15 22-20" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
