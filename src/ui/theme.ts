import type { ViewStyle } from 'react-native';

/**
 * Bảng màu cố định (app chỉ dùng giao diện sáng). Màu chữ và màu nhấn
 * đã chọn để đủ tương phản trên nền trắng.
 */
export const C = {
  /** Nền trang: gradient từ trên xuống. */
  bgTop: '#DDF1F4',
  bgMid: '#EEF7F8',
  bg: '#F4F7FA',
  card: '#FFFFFF',
  border: '#E6ECF1',
  divider: '#EEF2F6',
  text: '#1D2433',
  muted: '#5F6B7A',
  faint: '#9AA4B2',
  /** Màu thương hiệu dùng cho chữ/viền (đủ tương phản trên nền trắng). */
  brand: '#0B7A87',
  brandDark: '#164E58',
  brandSoft: '#E1F4F6',
  white: '#FFFFFF',
  overlay: 'rgba(16, 33, 40, 0.35)',
} as const;

/** Gradient nút chính / thẻ nổi bật (chữ trắng đủ tương phản). */
export const gradients = {
  brand: ['#08808E', '#164E58'] as const,
  page: [C.bgTop, C.bgMid, C.bg] as const,
};

/** Màu nhấn cho biểu tượng từng chức năng. */
export const accents = {
  teal: '#0B8A9A',
  blue: '#2563EB',
  violet: '#6D4AFF',
  green: '#16A34A',
  orange: '#D97706',
  red: '#DC2626',
  pink: '#DB2777',
  slate: '#475569',
} as const;

export type AccentName = keyof typeof accents;

/** Nền nhạt tương ứng cho ô biểu tượng. */
export const accentSoft: Record<AccentName, string> = {
  teal: '#E0F4F6',
  blue: '#E5EDFE',
  violet: '#EEEAFF',
  green: '#E3F6EA',
  orange: '#FDF1E1',
  red: '#FDE8E8',
  pink: '#FCE7F1',
  slate: '#EEF1F5',
};

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  success: { fg: '#15803D', bg: '#DCFCE7' },
  warning: { fg: '#B45309', bg: '#FEF3C7' },
  danger: { fg: '#B91C1C', bg: '#FEE2E2' },
  info: { fg: '#1D4ED8', bg: '#DBEAFE' },
  neutral: { fg: '#4B5563', bg: '#F1F3F6' },
  brand: { fg: C.brand, bg: C.brandSoft },
};

export const radius = { card: 16, control: 12, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Bóng rất nhẹ cho thẻ. */
export const shadow: ViewStyle = {
  shadowColor: '#0F3A42',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

/** Font Be Vietnam Pro theo độ đậm (không dùng fontWeight để iOS khỏi tự làm đậm). */
export const fonts = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
} as const;

export type FontWeight = keyof typeof fonts;

/** Màu cho thư viện biểu đồ. */
export const chartColors = {
  bar: '#0B8A9A',
  barActive: '#164E58',
  axis: '#9AA4B2',
};
