import { canDo, type PermissionHolder } from '@/core/can';

/** In / xem trước phiếu in: quyền in chứng từ + xem mẫu in (giống nút In ở chi tiết). */
export function canPrintDoc(user: PermissionHolder | null | undefined, kind: 'invoice' | 'order'): boolean {
  return canDo(user, kind === 'invoice' ? 'invoices:print' : 'orders:print') && canDo(user, 'print_templates:view');
}
