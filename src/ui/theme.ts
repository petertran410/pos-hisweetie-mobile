import { DynamicColorIOS, PlatformColor, Platform, type ColorValue } from 'react-native';

const dyn = (light: string, dark: string): ColorValue =>
  Platform.OS === 'ios' ? DynamicColorIOS({ light, dark }) : light;
const sys = (name: string, fallback: string): ColorValue =>
  Platform.OS === 'ios' ? PlatformColor(name) : fallback;

/**
 * Màu theo chuẩn iOS: màu hệ thống (tự đổi khi bật chế độ tối) + màu
 * thương hiệu HiSweetie làm tint.
 */
export const C = {
  bg: sys('systemGroupedBackground', '#F2F2F7'),
  card: sys('secondarySystemGroupedBackground', '#FFFFFF'),
  plainBg: sys('systemBackground', '#FFFFFF'),
  label: sys('label', '#000000'),
  secondary: sys('secondaryLabel', '#636366'),
  tertiary: sys('tertiaryLabel', '#AEAEB2'),
  separator: sys('separator', '#C6C6C8'),
  fill: sys('tertiarySystemFill', '#E3E3E8'),
  fillStrong: sys('secondarySystemFill', '#D1D1D6'),
  /** Nút, liên kết, phần đang chọn. */
  tint: dyn('#1A5F6A', '#5CC8D5'),
  tintSoft: dyn('#E0F2F4', '#12363B'),
  onTint: dyn('#FFFFFF', '#06262A'),
  accent: '#00B7CC' as ColorValue,
  warning: dyn('#975A16', '#F2B860'),
  warningSoft: dyn('#FDF3E1', '#3A2A12'),
  danger: dyn('#C53030', '#FF6961'),
  dangerSoft: dyn('#FBE9E9', '#3B1616'),
  success: dyn('#2F7A4F', '#5DD38C'),
  successSoft: dyn('#E6F4EC', '#123222'),
  info: dyn('#1F5AA6', '#7FB2FF'),
  infoSoft: dyn('#E8F0FB', '#16263D'),
  neutralSoft: dyn('#EFEFF4', '#2C2C2E'),
};

/** Màu dạng chuỗi cho thư viện biểu đồ (không nhận PlatformColor). */
export const chartColors = (dark: boolean) => ({
  line: dark ? '#5CC8D5' : '#1A5F6A',
  fillStart: dark ? 'rgba(92,200,213,0.35)' : 'rgba(26,95,106,0.22)',
  fillEnd: dark ? 'rgba(92,200,213,0.02)' : 'rgba(26,95,106,0.02)',
  secondLine: dark ? '#F2B860' : '#975A16',
  axis: dark ? '#8E8E93' : '#8E8E93',
  bar: dark ? '#5CC8D5' : '#1A5F6A',
});

export type Tone = 'info' | 'warning' | 'success' | 'danger' | 'neutral' | 'tint';

export const toneColors: Record<Tone, { fg: ColorValue; bg: ColorValue }> = {
  info: { fg: C.info, bg: C.infoSoft },
  warning: { fg: C.warning, bg: C.warningSoft },
  success: { fg: C.success, bg: C.successSoft },
  danger: { fg: C.danger, bg: C.dangerSoft },
  neutral: { fg: C.secondary, bg: C.neutralSoft },
  tint: { fg: C.tint, bg: C.tintSoft },
};

export const radius = { card: 14, sheet: 20, control: 10, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
