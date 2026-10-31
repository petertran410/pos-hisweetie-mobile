import { Stack } from 'expo-router';
import { TabStack } from '@/features/shell/TabStack';
import { C } from '@/ui';
import { useCartPersistence } from './persist';
import { useSalePerms } from './perms';

const sheet = { presentation: 'modal', contentStyle: { backgroundColor: C.bg } } as const;

/**
 * Ngăn xếp màn của tab Bán hàng: chọn hàng → giỏ hàng → hoàn tất; các màn
 * chọn khách, sửa hàng, giao hàng, giảm giá, bảng giá mở dạng sheet; quét mã
 * mở toàn màn hình. Giỏ hàng nháp được lưu lại theo chi nhánh.
 */
export function SalesStack() {
  const perms = useSalePerms();
  useCartPersistence(perms.order ? 'order' : 'invoice');
  return (
    <TabStack name="ban-hang">
      <Stack.Screen name="index" />
      <Stack.Screen name="gio-hang" />
      <Stack.Screen name="xong" options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="khach-hang" options={sheet} />
      <Stack.Screen name="dong/[rowId]" options={sheet} />
      <Stack.Screen name="giao-hang" options={sheet} />
      <Stack.Screen name="giam-gia" options={sheet} />
      <Stack.Screen
        name="bang-gia"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
          contentStyle: { backgroundColor: C.bg },
        }}
      />
      <Stack.Screen name="quet-ma" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
    </TabStack>
  );
}
