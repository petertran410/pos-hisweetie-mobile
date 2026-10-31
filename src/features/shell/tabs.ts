import type { SFSymbol } from 'expo-symbols';
import { canDo, type PermissionHolder } from '@/core/can';
import { useSession } from '@/core/session';

export type TabKey = 'tong-quan' | 'ban-hang' | 'don-hang' | 'khach-hang' | 'bao-don';

export interface TabDef {
  key: TabKey;
  label: string;
  icon: SFSymbol;
  iconSelected: SFSymbol;
  /** Chỉ cần 1 trong các quyền (giống `ROUTE_PERMISSIONS` của web). */
  permissions: string[];
}

/** Thứ tự ưu tiên của tab. Tab "Thêm" luôn có. */
export const TAB_DEFS: TabDef[] = [
  {
    key: 'tong-quan',
    label: 'Tổng quan',
    icon: 'chart.bar',
    iconSelected: 'chart.bar.fill',
    permissions: ['dashboard:view'],
  },
  {
    key: 'ban-hang',
    label: 'Bán hàng',
    icon: 'bag',
    iconSelected: 'bag.fill',
    permissions: ['orders:create', 'invoices:create'],
  },
  {
    key: 'don-hang',
    label: 'Đơn hàng',
    icon: 'doc.text',
    iconSelected: 'doc.text.fill',
    permissions: ['invoices:view', 'orders:view'],
  },
  {
    key: 'khach-hang',
    label: 'Khách hàng',
    icon: 'person.2',
    iconSelected: 'person.2.fill',
    permissions: ['customers:view'],
  },
  {
    key: 'bao-don',
    label: 'Báo đơn',
    icon: 'shippingbox',
    iconSelected: 'shippingbox.fill',
    permissions: [
      'packing_slips:view',
      'packing_slips:create',
      'packing_hangs:create',
      'packing_loadings:create',
    ],
  },
];

/** iPhone hiện tối đa 5 tab: 4 tab theo quyền + "Thêm". */
const MAX_TABS = 4;

export function allowedTabs(user: PermissionHolder | null): TabDef[] {
  return TAB_DEFS.filter((t) => t.permissions.some((p) => canDo(user, p)));
}

/** Tab hiện trên thanh tab và tab bị dồn vào màn "Thêm". */
export function splitTabs(user: PermissionHolder | null): { visible: TabDef[]; overflow: TabDef[] } {
  const allowed = allowedTabs(user);
  return { visible: allowed.slice(0, MAX_TABS), overflow: allowed.slice(MAX_TABS) };
}

export function useTabs() {
  const user = useSession((s) => s.user);
  return splitTabs(user);
}
