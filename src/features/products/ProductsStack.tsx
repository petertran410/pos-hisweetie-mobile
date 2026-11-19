import { Stack } from 'expo-router';
import { DocBaseProvider } from '@/features/orders/editScope';
import { C } from '@/ui';

const sheet = { presentation: 'modal', contentStyle: { backgroundColor: C.bg } } as const;

/**
 * Mục Hàng hóa (mở từ Tổng quan hoặc tab Thêm, phủ lên trên các tab):
 * danh sách → chi tiết → thêm / sửa. Bộ lọc và các màn chọn mở dạng sheet.
 * Hóa đơn / đơn đặt hàng mở từ thẻ kho có đủ thao tác như tab Đơn hàng (xử
 * lý, tạo hóa đơn, in) và các màn đó mở ngay trong mục này.
 */
export function ProductsStack() {
  return (
    <DocBaseProvider value="/hang-hoa">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="[id]" />
        <Stack.Screen name="loc" options={sheet} />
        <Stack.Screen name="them" />
        <Stack.Screen name="sua/[id]" />
        <Stack.Screen name="chon-nhom" options={sheet} />
        <Stack.Screen name="chon-thuong-hieu" options={sheet} />
        <Stack.Screen name="chon-don-vi" options={sheet} />
        <Stack.Screen name="chon-thanh-phan" options={sheet} />
        {/* Chứng từ mở từ thẻ kho (giống tab Đơn hàng). */}
        <Stack.Screen name="chung-tu/[kind]/[id]" />
        <Stack.Screen name="tao-hoa-don" />
        <Stack.Screen name="xu-ly/index" />
        <Stack.Screen name="xu-ly/them-hang" />
        <Stack.Screen name="xu-ly/khach-hang" options={sheet} />
        <Stack.Screen name="xu-ly/dong/[rowId]" options={sheet} />
        <Stack.Screen name="xu-ly/giao-hang" options={sheet} />
        <Stack.Screen name="xu-ly/giam-gia" options={sheet} />
        <Stack.Screen name="xu-ly/bang-gia" options={sheet} />
        <Stack.Screen name="xu-ly/quet-ma" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="phieu-in" options={sheet} />
      </Stack>
    </DocBaseProvider>
  );
}
