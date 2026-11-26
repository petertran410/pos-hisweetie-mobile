import { Stack } from 'expo-router';
import { DocBaseProvider } from '@/features/orders/editScope';
import { C } from '@/ui';
import { CustomerFormBaseProvider } from './formPaths';

const sheet = { presentation: 'modal', contentStyle: { backgroundColor: C.bg } } as const;

/**
 * Xem chi tiết khách đang chọn ở giỏ hàng: màn chi tiết phủ lên trên giỏ
 * (không chuyển sang tab Khách hàng), bấm quay lại là về giỏ. Có đủ thao tác
 * như tab Khách hàng (sửa, địa chỉ, thu nợ, mở hóa đơn / đơn đặt hàng trong
 * lịch sử) và các màn đó mở ngay trong ngăn này.
 */
export function CustomerViewStack() {
  return (
    <DocBaseProvider value="/xem-khach">
      <CustomerFormBaseProvider value="/xem-khach">
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
          <Stack.Screen name="[id]" />
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
          <Stack.Screen name="xu-ly/san-pham/[id]" options={sheet} />
          <Stack.Screen name="xu-ly/giao-hang" options={sheet} />
          <Stack.Screen name="xu-ly/giam-gia" options={sheet} />
          <Stack.Screen name="xu-ly/bang-gia" options={sheet} />
          <Stack.Screen name="xu-ly/quet-ma" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="phieu-in" options={sheet} />
        </Stack>
      </CustomerFormBaseProvider>
    </DocBaseProvider>
  );
}
