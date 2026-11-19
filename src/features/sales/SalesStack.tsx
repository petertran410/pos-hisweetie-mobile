import { Stack } from 'expo-router';
import { TabStack } from '@/features/shell/TabStack';
import { C } from '@/ui';

const sheet = { presentation: 'modal', contentStyle: { backgroundColor: C.bg } } as const;

/**
 * Ngăn xếp màn của tab Bán hàng: chọn hàng → giỏ hàng → hoàn tất; các màn
 * chọn khách, sửa hàng, giao hàng, giảm giá, bảng giá mở dạng sheet; quét mã
 * mở toàn màn hình. Đơn nháp được đọc/lưu ở cấp tab (`useCartPersistence`).
 */
export function SalesStack() {
  return (
    <TabStack name="ban-hang">
      <Stack.Screen name="index" />
      <Stack.Screen name="gio-hang" />
      <Stack.Screen name="xong" options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="khach-hang" options={sheet} />
      <Stack.Screen name="dong/[rowId]" options={sheet} />
      <Stack.Screen name="giao-hang" options={sheet} />
      <Stack.Screen name="giam-gia" options={sheet} />
      <Stack.Screen name="phieu-in" options={sheet} />
      <Stack.Screen name="bang-gia" options={sheet} />
      <Stack.Screen name="quet-ma" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
    </TabStack>
  );
}
