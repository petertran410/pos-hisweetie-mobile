import { Stack } from 'expo-router';
import { C } from '@/ui';
import { CustomerFormBaseProvider } from './formPaths';

const sheet = { presentation: 'modal', contentStyle: { backgroundColor: C.bg } } as const;

/**
 * Sửa hồ sơ khách từ giỏ hàng / xử lý đơn / chi tiết đơn: form phủ lên trên
 * màn đang làm (không chuyển sang tab Khách hàng), lưu hoặc quay lại là về
 * đúng màn cũ. Sửa địa chỉ và các màn chọn mở dạng sheet như trong tab
 * Khách hàng.
 */
export function CustomerEditStack() {
  return (
    <CustomerFormBaseProvider value="/sua-khach">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="[id]" />
        <Stack.Screen name="dia-chi" options={sheet} />
        <Stack.Screen name="chon-tinh" options={sheet} />
        <Stack.Screen name="chon-xa" options={sheet} />
        <Stack.Screen name="chon-tinh-cu" options={sheet} />
        <Stack.Screen name="chon-huyen" options={sheet} />
        <Stack.Screen name="chon-xa-cu" options={sheet} />
        <Stack.Screen name="chon-nhom" options={sheet} />
        <Stack.Screen name="chon-cha" options={sheet} />
        <Stack.Screen name="chon-sale" options={sheet} />
      </Stack>
    </CustomerFormBaseProvider>
  );
}
