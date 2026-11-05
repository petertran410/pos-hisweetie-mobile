import { Stack } from 'expo-router';
import { TabStack } from '@/features/shell/TabStack';
import { C } from '@/ui';

const sheet = { presentation: 'modal', contentStyle: { backgroundColor: C.bg } } as const;

/** Tab Phiếu kho: chọn loại phiếu → form tạo phiếu; chọn khách hàng mở dạng sheet. */
export function KhoStack() {
  return (
    <TabStack name="phieu-kho">
      <Stack.Screen name="index" />
      <Stack.Screen name="phieu" />
      <Stack.Screen name="chon-khach" options={sheet} />
    </TabStack>
  );
}
