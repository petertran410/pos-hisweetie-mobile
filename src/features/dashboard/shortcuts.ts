import { canDo, type PermissionHolder } from '@/core/can';
import type { AccentName, IconName } from '@/ui';

export interface ShortcutDef {
  key: string;
  label: string;
  icon: IconName;
  color: AccentName;
  /** Chỉ cần 1 trong các quyền (giống web). */
  permissions: string[];
  /** Đường dẫn khi chức năng đã có; chưa có thì `undefined` (hiện "Sắp có"). */
  href?: string;
}

/** Lối tắt chức năng trên Tổng quan, theo thứ tự hay dùng khi bán hàng. */
export const SHORTCUTS: ShortcutDef[] = [
  { key: 'ban-hang', label: 'Bán hàng', icon: 'shopping-cart', color: 'teal', permissions: ['orders:create', 'invoices:create'], href: '/ban-hang' },
  { key: 'hoa-don', label: 'Hóa đơn', icon: 'receipt-text', color: 'blue', permissions: ['invoices:view'], href: '/don-hang?kind=hoa-don' },
  { key: 'dat-hang', label: 'Đặt hàng', icon: 'clipboard-list', color: 'violet', permissions: ['orders:view'], href: '/don-hang?kind=dat-hang' },
  { key: 'khach-hang', label: 'Khách hàng', icon: 'users', color: 'green', permissions: ['customers:view'], href: '/khach-hang' },
  {
    key: 'bao-don',
    label: 'Báo đơn',
    icon: 'truck',
    color: 'orange',
    permissions: ['packing_slips:view', 'packing_slips:create', 'packing_hangs:create', 'packing_loadings:create'],
    href: '/bao-don',
  },
  { key: 'hang-hoa', label: 'Hàng hóa', icon: 'boxes', color: 'pink', permissions: ['products:view'], href: '/hang-hoa' },
  { key: 'so-quy', label: 'Sổ quỹ', icon: 'book-open', color: 'teal', permissions: ['cash_flows:view'] },
  { key: 'bien-dong', label: 'Biến động\nsố dư', icon: 'landmark', color: 'blue', permissions: ['sepay:view'] },
  { key: 'bao-cao', label: 'Báo cáo', icon: 'chart-pie', color: 'violet', permissions: ['reports:*'] },
  {
    key: 'quan-tri',
    label: 'Quản trị',
    icon: 'shield-check',
    color: 'slate',
    permissions: ['users:view', 'roles:view', 'branches:view'],
  },
];

/** "reports:*" = có ít nhất 1 quyền báo cáo bất kỳ. */
function hasPermission(user: PermissionHolder | null, permission: string): boolean {
  if (permission.endsWith(':*')) {
    const prefix = permission.slice(0, -1);
    return !!user && (canDo(user, permission) || (user.permissions ?? []).some((p) => p.startsWith(prefix)));
  }
  return canDo(user, permission);
}

export function allowedShortcuts(user: PermissionHolder | null): ShortcutDef[] {
  return SHORTCUTS.filter((s) => s.permissions.some((p) => hasPermission(user, p)));
}
