import { Stack, useNavigation } from 'expo-router';
import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import { create } from 'zustand';
import { MotionScope } from '@/ui';
import { prevTabName } from './backSwipe';
import { EdgeBack, useSwipePeek } from './EdgeBack';

/** Tab đang chọn (theo thanh tab, không tính sheet/màn phủ lên trên). */
export const useActiveTab = create<{ name: string | null }>(() => ({ name: null }));

export const setActiveTab = (name: string) => useActiveTab.setState({ name });

/**
 * Ngăn xếp màn của một tab. Đầu trang tự vẽ trong từng màn (vẫn vuốt cạnh để
 * quay lại). Ở trang đầu của tab, vuốt từ mép trái để về tab vừa mở trước đó.
 * Rời tab rồi quay lại thì dữ liệu hiện dần lại (trừ khi quay lại bằng cách vuốt:
 * tab đã hiện sẵn bên dưới).
 */
export function TabStack({ name, children }: { name: string; children?: ReactNode }) {
  const active = useActiveTab((s) => s.name === null || s.name === name);
  const peek = useSwipePeek((s) => s.name === name);
  // Điều hướng của chính tab này trên thanh tab (nhớ các tab đã mở, xem `backBehavior`).
  const tabs = useNavigation();
  const subscribe = useCallback((onChange: () => void) => tabs.addListener('state', onChange), [tabs]);
  const prevName = useSyncExternalStore(subscribe, () => prevTabName(tabs.getState()));
  const goBack = useCallback(() => {
    if (prevTabName(tabs.getState())) tabs.goBack();
  }, [tabs]);

  return (
    <MotionScope active={active} peek={peek}>
      <Stack
        screenOptions={{ headerShown: false }}
        // Chỉ bật ở trang đầu: trang con / sheet đã có cử chỉ vuốt của iOS.
        layout={({ state, children: content }) => (
          <EdgeBack name={name} prevName={prevName} enabled={!!prevName && state.index === 0} onBack={goBack}>
            {content}
          </EdgeBack>
        )}>
        {children}
      </Stack>
    </MotionScope>
  );
}
