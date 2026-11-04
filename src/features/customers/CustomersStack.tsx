import { Stack } from 'expo-router';
import { DocBaseProvider } from '@/features/orders/editScope';
import { TabStack } from '@/features/shell/TabStack';
import { C } from '@/ui';

const sheet = { presentation: 'modal', contentStyle: { backgroundColor: C.bg } } as const;

/**
 * Tab Khách hàng: danh sách → chi tiết → thêm / sửa, thu nợ. Bộ lọc, sửa
 * địa chỉ và các màn chọn mở dạng sheet. Hóa đơn / đơn đặt hàng mở từ lịch sử
 * của khách có đủ thao tác như tab Đơn hàng (xử lý, tạo hóa đơn, in) và các
 * màn đó mở ngay trong tab này.
 */
export function CustomersStack() {
  return (
    <DocBaseProvider value="/khach-hang">
      <TabStack name="khach-hang">
        <Stack.Screen name="index" />
        <Stack.Screen name="[id]" />
        <Stack.Screen name="loc" options={sheet} />
        <Stack.Screen name="them" />
        <Stack.Screen name="sua/[id]" />
        <Stack.Screen name="dia-chi" options={sheet} />
        <Stack.Screen name="chon-tinh" options={sheet} />
        <Stack.Screen name="chon-xa" options={sheet} />
        <Stack.Screen name="chon-tinh-cu" options={sheet} />
        <Stack.Screen name="chon-huyen" options={sheet} />
        <Stack.Screen name="chon-xa-cu" options={sheet} />
        <Stack.Screen name="chon-nhom" options={sheet} />
        <Stack.Screen name="chon-cha" options={sheet} />
        <Stack.Screen name="chon-sale" options={sheet} />
        <Stack.Screen name="thu-no/[id]" options={sheet} />
        {/* Chứng từ mở từ lịch sử của khách (giống tab Đơn hàng). */}
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
