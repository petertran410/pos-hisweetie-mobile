import { Stack } from 'expo-router';
import { C } from '@/ui';

const sheet = { presentation: 'modal', contentStyle: { backgroundColor: C.bg } } as const;

/**
 * Mục Hàng hóa (mở từ Tổng quan hoặc tab Thêm, phủ lên trên các tab):
 * danh sách → chi tiết → thêm / sửa. Bộ lọc và các màn chọn mở dạng sheet.
 */
export function ProductsStack() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="loc" options={sheet} />
      <Stack.Screen name="chung-tu/[kind]/[id]" />
      <Stack.Screen name="them" />
      <Stack.Screen name="sua/[id]" />
      <Stack.Screen name="chon-nhom" options={sheet} />
      <Stack.Screen name="chon-thuong-hieu" options={sheet} />
      <Stack.Screen name="chon-don-vi" options={sheet} />
      <Stack.Screen name="chon-thanh-phan" options={sheet} />
    </Stack>
  );
}
