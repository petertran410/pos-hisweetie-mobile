import { canDo, type PermissionHolder } from '@/core/can';
import { useSession } from '@/core/session';
import type { IconName } from '@/ui/icons';

export type TabKey = 'tong-quan' | 'ban-hang' | 'don-hang' | 'khach-hang' | 'bao-don';

export interface TabDef {
  key: TabKey;
  label: string;
  icon: IconName;
  /** Chỉ cần 1 trong các quyền (giống `ROUTE_PERMISSIONS` của web). */
  permissions: string[];
}

/** Thứ tự ưu tiên của tab. Tab "Thêm" luôn có. */
export const TAB_DEFS: TabDef[] = [
  {
    key: 'tong-quan',
    label: 'Tổng quan',
    icon: 'layout-dashboard',
    permissions: ['dashboard:view'],
  },
  {
    key: 'ban-hang',
    label: 'Bán hàng',
    icon: 'shopping-cart',
    permissions: ['orders:create', 'invoices:create'],
  },
  {
    key: 'don-hang',
    label: 'Đơn hàng',
    icon: 'receipt-text',
    permissions: ['invoices:view', 'orders:view'],
  },
  {
    key: 'khach-hang',
    label: 'Khách hàng',
    icon: 'users',
    permissions: ['customers:view'],
  },
  {
    key: 'bao-don',
    label: 'Báo đơn',
    icon: 'truck',
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
