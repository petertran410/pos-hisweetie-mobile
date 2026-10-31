import { Tabs } from 'expo-router/tabs';
import { TabBar } from '@/features/shell/TabBar';
import { setActiveTab } from '@/features/shell/TabStack';
import { TAB_DEFS, useTabs } from '@/features/shell/tabs';
import { tabTransition } from '@/features/shell/tabTransition';

/** Thanh tab tự vẽ; tab không có quyền thì ẩn (href: null). */
export default function TabsLayout() {
  const { visible } = useTabs();
  const shown = new Set(visible.map((t) => t.key));
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
