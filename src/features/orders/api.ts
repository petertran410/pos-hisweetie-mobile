import { keepPreviousData, useInfiniteQuery, useQuery, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { resolveRange } from '@/core/period';
import { http, type Query } from '@/core/http';
import { useSession } from '@/core/session';
import type { RawInvoiceForEdit, RawOrderForEdit } from './editOrder';
import { toInvoiceDraft, type RawOrderForInvoice } from './fromOrder';
import {
  activeAlerts,
  alertsFor,
  dayBoundsIso,
  type DocAlert,
  type DocKind,
  type DocListFilters,
  type DocPeriod,
  type DocWarnings,
  type StatusFilter,
} from './model';

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const PAGE_SIZE = 20;

/**
 * Sau khi đổi chứng từ: làm mới chi tiết, danh sách, tổng quan, số liệu khách
 * (nợ, lịch sử mua) và tồn kho / thẻ kho của hàng (tạo, hủy hóa đơn làm đổi tồn).
 */
export function refreshAfterDocChange(qc: QueryClient, extra: QueryKey[] = []) {
  const keys: QueryKey[] = [
    ['doc'],
    ['docs'],
    ['dashboard'],
    ['customer'],
    ['customers'],
    ['customer-docs'],
    ['customer-debt'],
    ['product'],
    ['products'],
    ['product-logs'],
    ['product-condition'],
    ['product-condition-logs'],
    ['sales', 'products'],
    // Báo đơn hiện mã / trạng thái hóa đơn.
    ['packings'],
    ['packing'],
    ['delivery-overview'],
    ...extra,
  ];
  return Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

// ---------- Danh sách ----------

export interface DocRow {
  id: number;
  code: string;
  /** Ngày bán (hóa đơn) / ngày đặt (đơn đặt hàng). */
  date: string | null;
  status: number;
  customerName: string;
  customerPhone: string | null;
  sellerName: string | null;
  grandTotal: number;
  paidAmount: number;
  debtAmount: number;
  shippingFee: number;
  /** Icon cảnh báo (cùng điều kiện, thứ tự với web). */
  alerts: DocAlert[];
  /** Chi tiết lệch giá / lệch số lượng để xem khi bấm icon. */
  warnings: DocWarnings | null;
}

interface RawWarnings {
  price?: { productCode?: string | null; productName?: string | null; price?: unknown; listPrice?: unknown }[] | null;
  quantity?:
    | {
        productCode?: string | null;
        productName?: string | null;
        unit?: string | null;
        orderQuantity?: unknown;
        previousQuantity?: unknown;
        expectedQuantity?: unknown;
        invoiceQuantity?: unknown;
      }[]
    | null;
  orderCode?: string | null;
  previousInvoiceCodes?: string[] | null;
}

function toWarnings(w: RawWarnings | null | undefined): DocWarnings | null {
  if (!w) return null;
  const price = (w.price ?? []).map((p) => ({
    productCode: p.productCode ?? '',
    productName: p.productName ?? '',
    price: num(p.price),
    listPrice: num(p.listPrice),
  }));
  const quantity = (w.quantity ?? []).map((q) => ({
    productCode: q.productCode ?? '',
    productName: q.productName ?? '',
    unit: q.unit ?? null,
    orderQuantity: num(q.orderQuantity),
    previousQuantity: num(q.previousQuantity),
    expectedQuantity: num(q.expectedQuantity),
    invoiceQuantity: num(q.invoiceQuantity),
  }));
  if (!price.length && !quantity.length) return null;
  return { price, quantity, orderCode: w.orderCode ?? null, previousInvoiceCodes: w.previousInvoiceCodes ?? [] };
}

interface RawRow {
  id: number;
  code: string;
  purchaseDate?: string | null;
  orderDate?: string | null;
  createdAt?: string | null;
  status?: number | null;
  grandTotal?: string | number | null;
  paidAmount?: string | number | null;
  debtAmount?: string | number | null;
  customer?: { name?: string | null; contactNumber?: string | null; phone?: string | null } | null;
  soldBy?: { name?: string | null } | null;
  shippingFee?: string | number | null;
  // Cờ cảnh báo backend gắn vào danh sách (hóa đơn: attachPriceBookWarnings; đặt hàng: findAll).
  hasPriceBookWarning?: boolean | null;
  hasOrphanedPacking?: boolean | null;
  hasShippingFee?: boolean | null;
  hasColdItems?: boolean | null;
  warnings?: RawWarnings | null;
}

export function toDocRow(kind: DocKind, r: RawRow): DocRow {
  const warnings = toWarnings(r.warnings);
  return {
    id: r.id,
    code: r.code,
    date: (kind === 'invoice' ? r.purchaseDate : r.orderDate) ?? r.createdAt ?? null,
    status: num(r.status),
    customerName: r.customer?.name || 'Khách vãng lai',
    customerPhone: r.customer?.contactNumber || r.customer?.phone || null,
    sellerName: r.soldBy?.name ?? null,
    grandTotal: num(r.grandTotal),
    paidAmount: num(r.paidAmount),
    debtAmount: Math.max(0, num(r.debtAmount)),
    shippingFee: num(r.shippingFee),
    alerts: activeAlerts({ ...r, warnings }),
    warnings,
  };
}

export interface DocFilters extends Partial<Omit<DocListFilters, 'period'>> {
  search: string;
  status: StatusFilter;
  /** Thời gian chính: mốc có sẵn (như web), "all" hoặc khoảng ngày tự chọn. */
  period: DocPeriod;
}

const isoBounds = (p: DocPeriod | undefined, now: Date) => {
  const range = p ? resolveRange(p, now) : null;
  return range ? dayBoundsIso(range.from, range.to) : null;
};

/**
 * Tham số lọc đúng với DTO của backend (tham số lạ bị trả lỗi 400) và cùng tên
 * với sidebar lọc của web (`OrdersSidebar`, `InvoicesSidebar`):
 * - Thời gian: đặt hàng gửi fromCreatedDate/toCreatedDate; hóa đơn gửi
 *   fromPurchaseDate/toPurchaseDate (thời gian mua hàng) và fromCreatedDate/toCreatedDate (thời gian tạo).
 * - Người bán `soldByIds`, người tạo `createdByIds`.
 * - Cảnh báo: priceWarning, quantityWarning, orphanedPacking, hasShippingFee, hasColdItems.
 * Chỉ dùng `page` + `limit` (không trộn với `pageSize`/`currentItem`).
 */
export function listQuery(kind: DocKind, f: DocFilters, branchId: number | null, page: number, now = new Date()): Query {
  const q: Query = { page, limit: PAGE_SIZE, includeStatusCounts: true, search: f.search || undefined };
  const main = isoBounds(f.period, now);
  if (kind === 'invoice') {
    q.branchIds = branchId ? [branchId] : undefined;
    if (f.status !== 'all') q.statusIds = [Number(f.status)];
    if (main) {
      q.fromPurchaseDate = main.fromIso;
      q.toPurchaseDate = main.toIso;
    }
    const created = isoBounds(f.createdPeriod, now);
    if (created) {
      q.fromCreatedDate = created.fromIso;
      q.toCreatedDate = created.toIso;
    }
    q.orderBy = 'purchaseDate';
  } else {
    q.branchId = branchId ?? undefined;
    if (f.status !== 'all') q.statuses = [f.status];
    if (main) {
      q.fromCreatedDate = main.fromIso;
      q.toCreatedDate = main.toIso;
    }
    q.orderBy = 'orderDate';
  }
  if (f.sellerIds?.length) q.soldByIds = f.sellerIds;
  if (f.creatorIds?.length) q.createdByIds = f.creatorIds;
  for (const a of alertsFor(kind)) {
    if (f.alerts?.includes(a.value)) q[a.param] = true;
  }
  q.orderDirection = 'desc';
  return q;
}

/**
 * Số chứng từ theo từng trạng thái (đếm với mọi bộ lọc trừ trạng thái).
 * Hóa đơn: khóa là số ("3"); đặt hàng: khóa là tên ("pending").
 */
export type StatusCounts = Partial<Record<string, number>> & { all?: number };

interface RawPage {
  data: RawRow[];
  total: number;
  statusCounts?: Record<string, number>;
}

export function useDocList(kind: DocKind, filters: DocFilters, enabled: boolean) {
  const branchId = useSession((s) => s.branchId);
  return useInfiniteQuery({
    queryKey: ['docs', kind, branchId, filters],
    enabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await http.get<RawPage>(kind === 'invoice' ? '/invoices' : '/orders', listQuery(kind, filters, branchId, pageParam));
      return {
        page: pageParam,
        total: num(res.total),
        rows: res.data.map((r) => toDocRow(kind, r)),
        counts: (res.statusCounts ?? {}) as StatusCounts,
      };
    },
    getNextPageParam: (last) => (last.page * PAGE_SIZE < last.total ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

// ---------- Chi tiết ----------

export interface DocLine {
  key: string;
  productId: number;
  code: string;
  name: string;
  unit: string | null;
  quantity: number;
  price: number;
  discount: number;
  total: number;
  note: string | null;
  gift: boolean;
  condition: 'normal' | 'damaged' | 'near_expiry';
  /** Đặt hàng: số đã ra hóa đơn. */
  invoicedQty?: number;
}

export interface DocPayment {
  key: string;
  code: string | null;
  amount: number;
  method: string | null;
  date: string | null;
  cancelled: boolean;
}

export interface DocDetail {
  kind: DocKind;
  id: number;
  code: string;
  date: string | null;
  status: number;
  branchId: number | null;
  branchName: string | null;
  sellerName: string | null;
  creatorName: string | null;
  /** Id người tạo: tài khoản chỉ xem dữ liệu của mình chỉ mở được chứng từ mình tạo. */
  createdBy: number | null;
  priceBookName: string | null;
  /** `id`: để mở form sửa hồ sơ khách. */
  customer: { id?: number; name: string; code: string | null; phone: string | null } | null;
  delivery: { receiver: string; phone: string; address: string; note: string | null } | null;
  note: string | null;
  lines: DocLine[];
  totalAmount: number;
  discount: number;
  discountRatio: number;
  shippingFee: number;
  grandTotal: number;
  paidAmount: number;
  debtAmount: number;
  payments: DocPayment[];
  /** Hóa đơn: đơn đặt hàng gốc. Đặt hàng: các hóa đơn đã ra. */
  sourceOrderId: number | null;
  invoices: { id: number; code: string; status: number }[];
}

interface RawLine {
  id: number;
  productId: number;
  productCode?: string | null;
  productName?: string | null;
  quantity?: string | number;
  price?: string | number;
  discount?: string | number;
  totalPrice?: string | number;
  note?: string | null;
  isGift?: boolean | null;
  lineType?: string | null;
  conditionType?: string | null;
  // `product.inventories` có giá vốn: cố ý không đọc.
  product?: { code?: string | null; name?: string | null; unit?: string | null } | null;
}

interface RawDetail {
  id: number;
  code: string;
  purchaseDate?: string | null;
  orderDate?: string | null;
  createdAt?: string | null;
  status?: number;
  orderId?: number | null;
  branchId?: number | null;
  priceBookName?: string | null;
  description?: string | null;
  totalAmount?: string | number;
  discount?: string | number;
  discountRatio?: string | number;
  shippingFee?: string | number;
  grandTotal?: string | number;
  paidAmount?: string | number;
  debtAmount?: string | number;
  branch?: { name?: string | null } | null;
  soldBy?: { name?: string | null } | null;
  creator?: { name?: string | null } | null;
  createdBy?: number | null;
  customer?: { id?: number; name?: string | null; code?: string | null; contactNumber?: string | null; phone?: string | null } | null;
  delivery?: {
    receiver?: string | null;
    contactNumber?: string | null;
    address?: string | null;
    wardName?: string | null;
    locationName?: string | null;
    noteForDriver?: string | null;
  } | null;
  details?: RawLine[];
  items?: RawLine[];
  payments?: {
    id: number;
    code?: string | null;
    amount?: string | number;
    paymentMethod?: string | null;
    paymentDate?: string | null;
    createdAt?: string | null;
    status?: number | null;
  }[];
  invoices?: { id: number; code: string; status: number; details?: { productId: number; quantity?: string | number }[] }[];
}

export function toDocDetail(kind: DocKind, r: RawDetail): DocDetail {
  // Đặt hàng: cộng số lượng đã ra hóa đơn theo sản phẩm.
  const invoiced = new Map<number, number>();
  for (const inv of r.invoices ?? []) {
    if (inv.status === 2) continue;
    for (const d of inv.details ?? []) invoiced.set(d.productId, (invoiced.get(d.productId) ?? 0) + num(d.quantity));
  }
  const rawLines = (kind === 'invoice' ? r.details : r.items) ?? [];
  const d = r.delivery;
  const address = d ? [d.address, d.wardName, d.locationName].filter(Boolean).join(', ') : '';
  return {
    kind,
    id: r.id,
    code: r.code,
    date: (kind === 'invoice' ? r.purchaseDate : r.orderDate) ?? r.createdAt ?? null,
    status: num(r.status),
    branchId: r.branchId ?? null,
    branchName: r.branch?.name ?? null,
    sellerName: r.soldBy?.name ?? null,
    creatorName: r.creator?.name ?? null,
    createdBy: r.createdBy ?? null,
    priceBookName: r.priceBookName || null,
    customer: r.customer
      ? {
          id: r.customer.id,
          name: r.customer.name || 'Khách vãng lai',
          code: r.customer.code ?? null,
          phone: r.customer.contactNumber || r.customer.phone || null,
        }
      : null,
    delivery:
      d && (d.receiver || d.contactNumber || address)
        ? { receiver: d.receiver ?? '', phone: d.contactNumber ?? '', address, note: d.noteForDriver || null }
        : null,
    note: r.description || null,
    lines: rawLines.map((l) => ({
      key: String(l.id),
      productId: l.productId,
      code: l.productCode || l.product?.code || '',
      name: l.productName || l.product?.name || '',
      unit: l.product?.unit ?? null,
      quantity: num(l.quantity),
      price: num(l.price),
      discount: num(l.discount),
      total: num(l.totalPrice),
      note: l.note || null,
      gift: !!l.isGift || l.lineType === 'gift',
      condition: l.conditionType === 'damaged' || l.conditionType === 'near_expiry' ? l.conditionType : 'normal',
      invoicedQty: kind === 'order' ? (invoiced.get(l.productId) ?? 0) : undefined,
    })),
    totalAmount: num(r.totalAmount),
    discount: num(r.discount),
    discountRatio: num(r.discountRatio),
    shippingFee: num(r.shippingFee),
    grandTotal: num(r.grandTotal),
    paidAmount: num(r.paidAmount),
    debtAmount: Math.max(0, num(r.debtAmount)),
    payments: (r.payments ?? []).map((p) => ({
      key: String(p.id),
      code: p.code ?? null,
      amount: num(p.amount),
      method: p.paymentMethod ?? null,
      date: p.paymentDate ?? p.createdAt ?? null,
      cancelled: p.status === 2,
    })),
    sourceOrderId: kind === 'invoice' ? (r.orderId ?? null) : null,
    invoices: (r.invoices ?? []).map((i) => ({ id: i.id, code: i.code, status: i.status })),
  };
}

export function useDocDetail(kind: DocKind, id: number, enabled = true) {
  return useQuery({
    queryKey: ['doc', kind, id],
    enabled: enabled && Number.isFinite(id) && id > 0,
    queryFn: async () => {
      const raw = await http.get<RawDetail | null>(`/${kind === 'invoice' ? 'invoices' : 'orders'}/${id}`);
      if (!raw) throw new Error(kind === 'invoice' ? 'Không tìm thấy hóa đơn' : 'Không tìm thấy đơn đặt hàng');
      return toDocDetail(kind, raw);
    },
    staleTime: 15_000,
  });
}

export const PAYMENT_METHOD: Record<string, string> = {
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản',
  card: 'Thẻ',
  ewallet: 'Ví điện tử',
  voucher: 'Voucher',
};

// ---------- Thao tác với đơn đặt hàng ----------

/** Đổi trạng thái đơn đặt hàng (chỉ gửi trạng thái; hàng hóa, bảng giá giữ nguyên). */
export const updateOrderStatus = (id: number, orderStatus: 'pending' | 'confirmed' | 'completed') =>
  http.put<unknown>(`/orders/${id}`, { orderStatus });

/** Hủy đơn đặt hàng; `cancelPayments` = hủy kèm phiếu thu. */
export const cancelOrder = (id: number, cancelPayments: boolean) => http.put<unknown>(`/orders/${id}/cancel`, { cancelPayments });

// ---------- Thao tác với hóa đơn ----------

/** Đổi trạng thái hóa đơn (chỉ gửi trạng thái). Hủy phải dùng `cancelInvoice`. */
export const updateInvoiceStatus = (id: number, status: number) => http.put<unknown>(`/invoices/${id}`, { status });

/** Hủy hóa đơn; `cancelPayments` = hủy kèm phiếu thu. */
export const cancelInvoice = (id: number, cancelPayments: boolean) => http.put<unknown>(`/invoices/${id}/cancel`, { cancelPayments });

interface RawSlip {
  cancelledAt?: string | null;
  paymentMethod?: string | null;
}

/** Có phiếu đóng hàng (chưa hủy) thu tiền mặt. */
export function hasActiveCashSlip(res: unknown): boolean {
  const list = Array.isArray(res) ? res : ((res as { data?: unknown } | null)?.data ?? []);
  return Array.isArray(list) && (list as RawSlip[]).some((s) => !!s && !s.cancelledAt && s.paymentMethod === 'cash');
}

/**
 * Khóa thao tác hóa đơn khi đã có phiếu đóng hàng thu tiền mặt (giống web).
 * Đang kiểm tra hoặc kiểm tra lỗi cũng tính là khóa. Admin không bị khóa.
 */
export function useCashPackingLock(invoiceId: number, enabled: boolean): boolean {
  const q = useQuery({
    queryKey: ['packing-slips', 'invoice', invoiceId],
    enabled: enabled && invoiceId > 0,
    queryFn: () => http.get<unknown>('/packing-slips', { invoiceId, limit: 100 }),
    select: hasActiveCashSlip,
    staleTime: 30_000,
  });
  if (!enabled) return false;
  return q.isPending || q.isError || q.data === true;
}

// ---------- Tạo hóa đơn từ đơn đặt hàng ----------

/** Đơn đặt hàng mới nhất để tạo hóa đơn (luôn tải lại khi mở). */
export function useInvoiceDraft(orderId: number, enabled = true) {
  return useQuery({
    queryKey: ['invoice-draft', orderId],
    enabled: enabled && Number.isFinite(orderId) && orderId > 0,
    queryFn: async () => {
      const raw = await http.get<RawOrderForInvoice | null>(`/orders/${orderId}`);
      if (!raw) throw new Error('Không tìm thấy đơn đặt hàng');
      return toInvoiceDraft(raw);
    },
    staleTime: 0,
    gcTime: 0,
  });
}

export const createInvoiceFromOrder = (orderId: number, body: object) =>
  http.post<{ id: number; code: string }>(`/invoices/pos/from-order/${orderId}`, body);

// ---------- Xử lý đơn hàng (sửa đơn) ----------

/** Đơn đặt hàng mới nhất để mở ra sửa. */
export async function fetchOrderForEdit(orderId: number): Promise<RawOrderForEdit> {
  const raw = await http.get<RawOrderForEdit | null>(`/orders/${orderId}`);
  if (!raw) throw new Error('Không tìm thấy đơn đặt hàng');
  return raw;
}

export const updateOrder = (id: number, body: object) => http.put<unknown>(`/orders/${id}`, body);

// ---------- Xử lý hóa đơn (sửa hóa đơn) ----------

/** Hóa đơn mới nhất để mở ra sửa. */
export async function fetchInvoiceForEdit(invoiceId: number): Promise<RawInvoiceForEdit> {
  const raw = await http.get<RawInvoiceForEdit | null>(`/invoices/${invoiceId}`);
  if (!raw) throw new Error('Không tìm thấy hóa đơn');
  return raw;
}

/**
 * Sửa hóa đơn. Đổi hàng / giảm giá / bảng giá thì backend hủy hóa đơn này
 * và trả về hóa đơn mới (khác `id`, mã thêm đuôi .01…).
 */
export const updateInvoice = (id: number, body: object) => http.put<{ id: number; code: string } | null>(`/invoices/${id}`, body);

/** Ghi tiền khách trả thêm cho hóa đơn. */
export const addInvoicePayment = (body: { invoiceId: number; amount: number; paymentMethod: string; accountId?: number }) =>
  http.post<unknown>('/invoice-payments', body);
