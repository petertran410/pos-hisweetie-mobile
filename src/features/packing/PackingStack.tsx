import { Stack } from 'expo-router';
import { DocBaseProvider } from '@/features/orders/editScope';
import { TabStack } from '@/features/shell/TabStack';
import { C } from '@/ui';

const sheet = { presentation: 'modal', contentStyle: { backgroundColor: C.bg } } as const;

/**
 * Tab Báo đơn: danh sách → chi tiết phiếu → tạo / sửa phiếu. Chọn chứng từ,
 * bộ lọc mở dạng sheet; quét QR mở toàn màn hình. Hóa đơn mở từ phiếu có đủ
 * thao tác như tab Đơn hàng và mở ngay trong tab này.
 */
export function PackingStack() {
  return (
    <DocBaseProvider value="/bao-don">
      <TabStack name="bao-don">
        <Stack.Screen name="index" />
        <Stack.Screen name="[type]/[id]" />
        <Stack.Screen name="phieu" />
        <Stack.Screen name="cho-giao" />
        <Stack.Screen name="loc" options={sheet} />
        <Stack.Screen name="chon-chung-tu" options={sheet} />
        <Stack.Screen name="quet-qr" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        {/* Hóa đơn mở từ phiếu (giống tab Đơn hàng). */}
        <Stack.Screen name="chung-tu/[kind]/[id]" />
        <Stack.Screen name="tao-hoa-don" />
        <Stack.Screen name="xu-ly/index" />
        <Stack.Screen name="xu-ly/them-hang" />
        <Stack.Screen name="xu-ly/khach-hang" options={sheet} />
        <Stack.Screen name="xu-ly/dong/[rowId]" options={sheet} />
        <Stack.Screen name="xu-ly/giao-hang" options={sheet} />
        <Stack.Screen name="xu-ly/giam-gia" options={sheet} />
        <Stack.Screen
          name="xu-ly/bang-gia"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.5, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            contentStyle: { backgroundColor: C.bg },
          }}
        />
        <Stack.Screen name="xu-ly/quet-ma" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="phieu-in" options={sheet} />
      </TabStack>
    </DocBaseProvider>
  );
}
