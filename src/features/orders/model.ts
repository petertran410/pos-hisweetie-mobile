import type { PeriodKey } from '@/core/format';
import { RANGE_PRESETS, type RangeChoice, type RangePreset } from '@/core/period';
import type { IconName, Tone } from '@/ui';

/** Loại chứng từ; trên đường dẫn dùng tên tiếng Việt cho dễ đọc. */
export type DocKind = 'invoice' | 'order';
/**
 * Tài khoản "chỉ xem dữ liệu của mình" (cờ canViewOtherStaffData tắt): backend
 * chỉ lọc danh sách theo người tạo, nên app tự chặn khi mở chứng từ theo id
 * (link, thẻ kho, công nợ, báo đơn) mà người khác tạo.
 */
export function ownsDoc(user: { id?: number; canViewOtherStaffData?: boolean } | null | undefined, createdBy: number | null): boolean {
  if (!user) return false;
  if (user.canViewOtherStaffData !== false) return true;
  return createdBy !== null && createdBy === user.id;
}

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

export { dayBoundsIso } from '@/core/period';

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
export function invoiceActions(
  doc: { status: number },
  perms: { update: boolean; cancel: boolean; updateFinalized?: boolean },
  cashLocked: boolean,
) {
  // 1 = Hoàn thành, 2 = Đã hủy: không đổi trạng thái nữa.
  const final = doc.status === 1 || doc.status === 2;
  // Giao thành công / Hoàn thành: sửa nội dung cần thêm quyền "sửa hóa đơn đã hoàn tất".
  const finalized = doc.status === 7 || doc.status === 1;
  return {
    /** "Xử lý hóa đơn" (giống web): sửa hàng, khách, giao hàng, giảm giá rồi lưu. */
    process: perms.update && doc.status !== 2 && (!finalized || !!perms.updateFinalized) && !cashLocked,
    changeStatus: perms.update && !final && !cashLocked,
    complete: perms.update && !final,
    cancel: perms.cancel && doc.status !== 2 && !cashLocked,
  };
}

// ---------- Bộ lọc danh sách (theo sidebar lọc của web) ----------

/** Mốc thời gian của danh sách: các mốc của web (`TimeRangeFilter`) và "Toàn thời gian". */
export const DOC_PERIODS: { value: RangePreset | 'all'; label: string; group: string }[] = [
  { value: 'all', label: 'Toàn thời gian', group: 'Tất cả' },
  ...RANGE_PRESETS,
];

export type DocPeriod = RangeChoice;

/**
 * Loại cảnh báo: cùng nhóm "Cảnh báo đơn hàng / hóa đơn" ở sidebar web và cùng icon,
 * màu với cột cảnh báo ở bảng web (`InvoiceAlertIcons`, `InvoiceWarningIcon`).
 */
export type DocAlert = 'price' | 'quantity' | 'orphanedPacking' | 'shippingFee' | 'cold';

export interface AlertDef {
  value: DocAlert;
  /** Tên ở bộ lọc (web: "Chỉ HĐ lệch giá bán với bảng giá"…). */
  label: string;
  /** Ý nghĩa icon trên danh sách (web: chữ hiện khi rê chuột vào icon). */
  meaning: string;
  icon: IconName;
  color: string;
  fill?: string;
  /** Loại chứng từ có cảnh báo này (đặt hàng chỉ có lệch giá, phí ship, hàng lạnh). */
  kinds: DocKind[];
  /** Tham số lọc gửi API (giống web). */
  param: 'priceWarning' | 'quantityWarning' | 'orphanedPacking' | 'hasShippingFee' | 'hasColdItems';
}

/** Thứ tự giống web (cả ở bộ lọc và ở cột icon). Màu: yellow-500, orange-500, red-500 của web. */
export const DOC_ALERTS: AlertDef[] = [
  {
    value: 'price',
    label: 'Lệch giá bán với bảng giá',
    meaning: 'Bán thấp hơn giá bảng giá',
    icon: 'triangle-alert',
    color: '#EAB308',
    fill: '#FEF9C3',
    kinds: ['order', 'invoice'],
    param: 'priceWarning',
  },
  {
    value: 'quantity',
    label: 'Lệch số lượng với đặt hàng',
    meaning: 'Số lượng khác đơn đặt hàng',
    icon: 'boxes',
    color: '#F97316',
    kinds: ['invoice'],
    param: 'quantityWarning',
  },
  {
    value: 'orphanedPacking',
    label: 'Hủy còn giao hàng',
    meaning: 'Hóa đơn đã hủy nhưng còn phiếu giao hàng',
    icon: 'package-x',
    color: '#EF4444',
    kinds: ['invoice'],
    param: 'orphanedPacking',
  },
  {
    value: 'shippingFee',
    label: 'Có phí ship',
    meaning: 'Có phí ship',
    icon: 'truck',
    color: '#EF4444',
    kinds: ['order', 'invoice'],
    param: 'hasShippingFee',
  },
  {
    value: 'cold',
    label: 'Hàng lạnh',
    meaning: 'Có sản phẩm hàng lạnh',
    icon: 'snowflake',
    color: '#EF4444',
    kinds: ['order', 'invoice'],
    param: 'hasColdItems',
  },
];

export const ALERT_DEF = Object.fromEntries(DOC_ALERTS.map((a) => [a.value, a])) as Record<DocAlert, AlertDef>;

/** Các cảnh báo lọc được với loại chứng từ này. */
export const alertsFor = (kind: DocKind) => DOC_ALERTS.filter((a) => a.kinds.includes(kind));

/** Chi tiết lệch giá / lệch số lượng backend trả kèm mỗi dòng (cùng cấu trúc với web). */
export interface DocWarnings {
  price: { productCode: string; productName: string; price: number; listPrice: number }[];
  quantity: {
    productCode: string;
    productName: string;
    unit: string | null;
    /** Tổng SL đặt hàng. */
    orderQuantity: number;
    /** SL đã xuất ở các hóa đơn trước của cùng đơn (đơn tách giao). */
    previousQuantity: number;
    /** SL cần giao ở hóa đơn này. */
    expectedQuantity: number;
    invoiceQuantity: number;
  }[];
  orderCode: string | null;
  /** Hóa đơn trước của cùng đơn đặt; có → so với SL đặt còn lại. */
  previousInvoiceCodes: string[];
}

/**
 * Icon cảnh báo của 1 dòng, cùng điều kiện với web: lệch giá khi có chi tiết lệch giá
 * hoặc cờ `hasPriceBookWarning`; lệch SL khi có chi tiết lệch SL; còn lại theo cờ backend.
 */
export function activeAlerts(src: {
  hasPriceBookWarning?: boolean | null;
  hasOrphanedPacking?: boolean | null;
  hasShippingFee?: boolean | null;
  hasColdItems?: boolean | null;
  warnings?: Pick<DocWarnings, 'price' | 'quantity'> | null;
}): DocAlert[] {
  const on: Record<DocAlert, boolean> = {
    price: (src.warnings?.price?.length ?? 0) > 0 || !!src.hasPriceBookWarning,
    quantity: (src.warnings?.quantity?.length ?? 0) > 0,
    orphanedPacking: !!src.hasOrphanedPacking,
    shippingFee: !!src.hasShippingFee,
    cold: !!src.hasColdItems,
  };
  return DOC_ALERTS.filter((a) => on[a.value]).map((a) => a.value);
}

/** Bộ lọc của sheet "Bộ lọc" (trạng thái và ô tìm nằm ngay trên danh sách). */
export interface DocListFilters {
  /** Thời gian chính. Đặt hàng: thời gian tạo (web gửi fromCreatedDate). Hóa đơn: thời gian mua hàng. */
  period: DocPeriod;
  /** Hóa đơn: thời gian tạo (trang hóa đơn web có 2 bộ lọc thời gian). */
  createdPeriod: DocPeriod;
  /** Người bán (soldByIds). */
  sellerIds: number[];
  /** Người tạo (createdByIds). */
  creatorIds: number[];
  /** Chọn nhiều: hiện chứng từ có ít nhất 1 cảnh báo đã chọn (backend gộp kiểu "hoặc"). */
  alerts: DocAlert[];
}

export const DEFAULT_DOC_FILTERS: DocListFilters = {
  period: 'last_7_days',
  createdPeriod: 'all',
  sellerIds: [],
  creatorIds: [],
  alerts: [],
};

/**
 * Bộ lọc áp cho 1 loại chứng từ: bỏ cảnh báo / thời gian tạo không có ở loại đó, xếp cảnh
 * báo theo thứ tự cố định (khóa truy vấn không đổi khi sửa bộ lọc chỉ dành cho loại kia).
 */
export function filtersFor(kind: DocKind, f: DocListFilters): DocListFilters {
  return {
    ...f,
    createdPeriod: kind === 'invoice' ? f.createdPeriod : 'all',
    alerts: alertsFor(kind)
      .filter((a) => f.alerts.includes(a.value))
      .map((a) => a.value),
  };
}

/** Số bộ lọc đang bật trong sheet (thời gian chính có nút riêng trên danh sách nên không tính). */
export function docFilterCount(kind: DocKind, f: DocListFilters): number {
  const g = filtersFor(kind, f);
  return g.alerts.length + (g.sellerIds.length ? 1 : 0) + (g.creatorIds.length ? 1 : 0) + (g.createdPeriod !== 'all' ? 1 : 0);
}
