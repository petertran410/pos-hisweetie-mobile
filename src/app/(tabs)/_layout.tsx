import { Tabs } from 'expo-router/tabs';
import { TabBar } from '@/features/shell/TabBar';
import { setActiveTab } from '@/features/shell/TabStack';
import { TAB_DEFS, useTabs } from '@/features/shell/tabs';
import { tabTransition } from '@/features/shell/tabTransition';

/**
 * Thanh tab tự vẽ (chỉ vẽ tối đa 4 tab + "Thêm"). Chỉ ẩn hẳn (href: null) tab
 * không có quyền: expo-router chuyển tab bị ẩn về tab đầu tiên, nên tab có
 * quyền nhưng dồn vào "Thêm" (vd Báo đơn) phải để mở được.
 */
export default function TabsLayout() {
  const { visible, overflow } = useTabs();
  const shown = new Set([...visible, ...overflow].map((t) => t.key));
  return (
    <Tabs
      screenOptions={{ headerShown: false, ...tabTransition }}
      screenListeners={({ route }) => ({ focus: () => setActiveTab(route.name) })}
      tabBar={(props) => <TabBar {...props} />}>
      {TAB_DEFS.map((tab) => (
        <Tabs.Screen
          key={tab.key}
          name={tab.key}
          options={{ title: tab.label, href: shown.has(tab.key) ? undefined : null }}
        />
      ))}
      <Tabs.Screen name="them" options={{ title: 'Thêm' }} />
    </Tabs>
  );
}
