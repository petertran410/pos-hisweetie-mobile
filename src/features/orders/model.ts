import type { PeriodKey } from '@/core/format';
import type { Tone } from '@/ui';

/** Loại chứng từ; trên đường dẫn dùng tên tiếng Việt cho dễ đọc. */
export type DocKind = 'invoice' | 'order';
export const KIND_SLUG: Record<DocKind, string> = { invoice: 'hoa-don', order: 'dat-hang' };
export const kindFromSlug = (slug: string | undefined): DocKind => (slug === 'hoa-don' ? 'invoice' : 'order');
export const KIND_LABEL: Record<DocKind, string> = { invoice: 'Hóa đơn', order: 'Đặt hàng' };
export const KIND_ORDER: DocKind[] = ['order', 'invoice'];

interface StatusDef {
  label: string;
  tone: Tone;
}

/** Trạng thái hóa đơn (số), nhãn theo web (6 = "Đang giao hàng"). */
export const INVOICE_STATUS: Record<number, StatusDef> = {
  1: { label: 'Hoàn thành', tone: 'success' },
  2: { label: 'Đã hủy', tone: 'danger' },
  3: { label: 'Đang xử lý', tone: 'info' },
  4: { label: 'Không giao được', tone: 'warning' },
  5: { label: 'Đóng hàng', tone: 'brand' },
  6: { label: 'Đang giao hàng', tone: 'brand' },
  7: { label: 'Giao thành công', tone: 'success' },
  8: { label: 'Trả hàng', tone: 'danger' },
};

/** Thứ tự chip lọc hóa đơn (giống web). */
export const INVOICE_FILTERS = [3, 5, 6, 7, 1, 4, 8, 2] as const;

/** Trạng thái đơn đặt hàng: API lọc bằng chuỗi, dữ liệu trả về số. */
export type OrderStatusKey = 'pending' | 'confirmed' | 'partially_invoiced' | 'completed' | 'cancelled';

export const ORDER_STATUS: Record<OrderStatusKey, StatusDef & { code: number }> = {
  pending: { code: 1, label: 'Phiếu tạm', tone: 'neutral' },
  confirmed: { code: 5, label: 'Đã xác nhận', tone: 'info' },
  partially_invoiced: { code: 6, label: 'Ra 1 phần HĐ', tone: 'brand' },
  completed: { code: 3, label: 'Hoàn thành', tone: 'success' },
  cancelled: { code: 4, label: 'Đã hủy', tone: 'danger' },
};

export const ORDER_FILTERS: OrderStatusKey[] = ['pending', 'confirmed', 'partially_invoiced', 'completed', 'cancelled'];

/** Nhãn + màu trạng thái của 1 chứng từ. */
export function statusOf(kind: DocKind, status: number | null | undefined): StatusDef {
  if (kind === 'invoice') return INVOICE_STATUS[status ?? 0] ?? { label: 'Không rõ', tone: 'neutral' };
  const hit = Object.values(ORDER_STATUS).find((s) => s.code === status);
  return hit ?? { label: 'Không rõ', tone: 'neutral' };
}

export const isCancelled = (kind: DocKind, status: number | null | undefined) =>
  kind === 'invoice' ? status === 2 : status === ORDER_STATUS.cancelled.code;

/** "all" hoặc mã trạng thái (số với hóa đơn, chuỗi với đặt hàng). */
export type StatusFilter = 'all' | string;

export const PERIOD_FILTERS: { value: PeriodKey | 'all'; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'yesterday', label: 'Hôm qua' },
  { value: 'last7', label: '7 ngày' },
  { value: 'thisMonth', label: 'Tháng này' },
  { value: 'lastMonth', label: 'Tháng trước' },
  { value: 'all', label: 'Toàn thời gian' },
];

/** yyyy-mm-dd (giờ máy) → ISO đầu ngày / cuối ngày (giống web gửi). */
export function dayBoundsIso(from: string, to: string): { fromIso: string; toIso: string } {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return {
    fromIso: new Date(fy, fm - 1, fd, 0, 0, 0, 0).toISOString(),
    toIso: new Date(ty, tm - 1, td, 23, 59, 59, 999).toISOString(),
  };
}

/** Tình trạng thanh toán suy ra từ số tiền (hóa đơn không có trường riêng). */
export function payState(paid: number, debt: number): { label: string; tone: Tone } {
  if (debt <= 0) return { label: 'Đã thu đủ', tone: 'success' };
  if (paid > 0) return { label: 'Thu 1 phần', tone: 'warning' };
  return { label: 'Chưa thu', tone: 'warning' };
}

/** Thao tác được phép trên 1 đơn đặt hàng (giống web). */
export function orderActions(doc: { status: number; invoices: { status: number }[] }, perms: { update: boolean; cancel: boolean }) {
  const final = doc.status === ORDER_STATUS.completed.code || doc.status === ORDER_STATUS.cancelled.code;
  // Có hóa đơn đang giao (6) thì không đổi trạng thái đơn.
  const delivering = doc.invoices.some((i) => i.status === 6);
  const cancellable = [1, 5, 6, 3].includes(doc.status);
  const liveInvoices = doc.invoices.filter((i) => i.status !== 2).length;
  return {
    /** "Xử lý đơn hàng" (giống web): sửa đơn rồi lưu, hoặc chuyển sang tạo hóa đơn. */
    process: perms.update && [1, 5, 6].includes(doc.status),
    changeStatus: perms.update && !final && !delivering,
    complete: perms.update && !final,
    // Backend yêu cầu quyền sửa đơn; web còn kiểm thêm quyền hủy đơn.
    cancel: perms.update && perms.cancel && cancellable,
    /** Còn hóa đơn chưa hủy: phải hủy hóa đơn trước. */
    cancelBlocked: liveInvoices > 0,
  };
}

/** Trạng thái chọn được khi đổi trạng thái hóa đơn (thứ tự giống web). */
export const INVOICE_STEPS = [3, 5, 6, 7, 4, 8, 1] as const;

/**
 * Thao tác được phép trên 1 hóa đơn (giống web).
 * `cashLocked`: hóa đơn đã có phiếu đóng hàng thu tiền mặt (admin không bị khóa).
 */
export function invoiceActions(doc: { status: number }, perms: { update: boolean; cancel: boolean }, cashLocked: boolean) {
  // 1 = Hoàn thành, 2 = Đã hủy: không đổi trạng thái nữa.
  const final = doc.status === 1 || doc.status === 2;
  return {
    changeStatus: perms.update && !final && !cashLocked,
    complete: perms.update && !final,
    cancel: perms.cancel && doc.status !== 2 && !cashLocked,
  };
}
