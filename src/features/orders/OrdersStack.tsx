import { Stack } from 'expo-router';
import { TabStack } from '@/features/shell/TabStack';
import { C } from '@/ui';

const sheet = { presentation: 'modal', contentStyle: { backgroundColor: C.bg } } as const;

/**
 * Tab Đơn hàng: danh sách (bộ lọc mở dạng sheet) → chi tiết → xử lý đơn (sửa
 * đơn, thêm hàng) / tạo hóa đơn từ đơn. Các màn phụ khi xử lý đơn mở dạng sheet giống Bán hàng.
 */
export function OrdersStack() {
  return (
    <TabStack name="don-hang">
      <Stack.Screen name="index" />
      <Stack.Screen name="loc" options={sheet} />
      <Stack.Screen name="[kind]/[id]" />
      <Stack.Screen name="tao-hoa-don" />
      <Stack.Screen name="xu-ly/index" />
      <Stack.Screen name="xu-ly/them-hang" />
      <Stack.Screen name="xu-ly/khach-hang" options={sheet} />
      <Stack.Screen name="xu-ly/dong/[rowId]" options={sheet} />
      <Stack.Screen name="xu-ly/san-pham/[id]" options={sheet} />
      <Stack.Screen name="xu-ly/giao-hang" options={sheet} />
      <Stack.Screen name="xu-ly/giam-gia" options={sheet} />
      <Stack.Screen name="xu-ly/bang-gia" options={sheet} />
      <Stack.Screen name="xu-ly/quet-ma" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="phieu-in" options={sheet} />
    </TabStack>
  );
}
