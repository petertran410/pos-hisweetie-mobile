import { canDo, type PermissionHolder } from '@/core/can';
import { useSession } from '@/core/session';
import type { IconName } from '@/ui/icons';

export type TabKey = 'tong-quan' | 'ban-hang' | 'don-hang' | 'khach-hang' | 'bao-don' | 'phieu-kho';

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
  {
    // Quyền tài chính theo chi nhánh: trang Phiếu kho tự kiểm tra lại từng kho.
    key: 'phieu-kho',
    label: 'Phiếu kho',
    icon: 'warehouse',
    permissions: ['warehouse_cash:create', 'warehouse_expense:create', 'vehicles:create'],
  },
];

/** Mục mở được trong app: các tab + Hàng hóa (mở từ Tổng quan / Thêm). */
export type AreaKey = TabKey | 'hang-hoa';

const AREA_EXTRA: Record<Exclude<AreaKey, TabKey>, { label: string; permissions: string[] }> = {
  'hang-hoa': { label: 'Hàng hóa', permissions: ['products:view'] },
};

export function areaDef(area: AreaKey): { label: string; permissions: string[] } {
  return TAB_DEFS.find((t) => t.key === area) ?? AREA_EXTRA[area as Exclude<AreaKey, TabKey>];
}

/** Được vào mục này không (cần 1 trong các quyền, giống thanh tab). */
export function canEnterArea(user: PermissionHolder | null | undefined, area: AreaKey): boolean {
  return areaDef(area).permissions.some((p) => canDo(user, p));
}

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
