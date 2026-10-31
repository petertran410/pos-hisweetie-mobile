import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';
import { TAB_DEFS, useTabs } from '@/features/shell/tabs';

/** Thanh tab UIKit thật; tab hiện theo quyền ở chi nhánh đang chọn. */
export default function TabsLayout() {
  const { visible } = useTabs();
  const shown = new Set(visible.map((t) => t.key));
  const tint = useColorScheme() === 'dark' ? '#5CC8D5' : '#1A5F6A';
  return (
    <NativeTabs tintColor={tint}>
      {TAB_DEFS.map((tab) => (
        <NativeTabs.Trigger key={tab.key} name={tab.key} hidden={!shown.has(tab.key)}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: tab.icon, selected: tab.iconSelected }} />
        </NativeTabs.Trigger>
      ))}
      <NativeTabs.Trigger name="them">
        <NativeTabs.Trigger.Label>Thêm</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
