import { Stack } from 'expo-router';
import { create } from 'zustand';
import { MotionScope } from '@/ui';

/** Tab đang chọn (theo thanh tab, không tính sheet/màn phủ lên trên). */
export const useActiveTab = create<{ name: string | null }>(() => ({ name: null }));

export const setActiveTab = (name: string) => useActiveTab.setState({ name });

/**
 * Ngăn xếp màn của một tab. Đầu trang tự vẽ trong từng màn (vẫn vuốt cạnh để
 * quay lại). Rời tab rồi quay lại thì dữ liệu hiện dần lại.
 */
export function TabStack({ name }: { name: string }) {
  const active = useActiveTab((s) => s.name === null || s.name === name);
  return (
    <MotionScope active={active}>
      <Stack screenOptions={{ headerShown: false }} />
    </MotionScope>
  );
}
