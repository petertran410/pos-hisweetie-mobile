import { useTabs, type TabDef } from './tabs';

/** Customer management stays in More; the remaining areas fill the bottom bar. */
export function arrangeTabNavigation(tabs: TabDef[]): { visible: TabDef[]; overflow: TabDef[] } {
  const primary = tabs.filter((tab) => tab.key !== 'khach-hang');
  const visible = primary.slice(0, 4);
  const visibleKeys = new Set(visible.map((tab) => tab.key));
  return { visible, overflow: tabs.filter((tab) => !visibleKeys.has(tab.key)) };
}

export function useTabNavigation() {
  const { visible, overflow } = useTabs();
  return arrangeTabNavigation([...visible, ...overflow]);
}
