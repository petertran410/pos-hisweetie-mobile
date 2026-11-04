import { canDo, type PermissionHolder } from '@/core/can';
import { dayBoundsIso, resolvePeriod, type PeriodChoice } from '@/core/period';
import type { Query } from '@/core/http';

/** Số Decimal của backend trả về dạng chuỗi. */
export const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const text = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t ? t : null;
};

/** Danh sách khách: backend phân trang bằng `pageSize` + `currentItem` (không có `page`). */
export const PAGE_SIZE = 20;
/** Lịch sử hóa đơn / đặt hàng trong chi tiết khách. */
export const HISTORY_PAGE_SIZE = 15;

// ---------- Dữ liệu từ API ----------

export interface RawAddress {
  id?: number | null;
  label?: string | null;
  receiver?: string | null;
  contactNumber?: string | null;
  address?: string | null;
  cityCode?: string | null;
  cityName?: string | null;
  districtCode?: string | null;
  districtName?: string | null;
  wardCode?: string | null;
  wardName?: string | null;
  newCityCode?: string | null;
  newCityName?: string | null;
  newWardCode?: string | null;
  newWardName?: string | null;
  locationName?: string | null;
  isDefault?: boolean | null;
}

export interface RawCustomer {
  id: number;
  code?: string | null;
  name?: string | null;
  contactNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  type?: number | null;
  organization?: string | null;
  taxCode?: string | null;
  comments?: string | null;
  totalPurchased?: string | number | null;
  totalDebt?: string | number | null;
  totalRevenue?: string | number | null;
  totalInvoiced?: string | number | null;
  isActive?: boolean | null;
  createdAt?: string | null;
  invoiceBuyerName?: string | null;
  invoiceAddress?: string | null;
  invoiceCityName?: string | null;
  invoiceWardName?: string | null;
  invoiceCccdCmnd?: string | null;
  invoiceBankAccount?: string | null;
  invoiceEmail?: string | null;
  invoicePhone?: string | null;
  invoiceDvqhnsCode?: string | null;
  branch?: { id?: number; name?: string | null } | null;
  parentId?: number | null;
  parent?: { id: number; code?: string | null; name?: string | null } | null;
  children?: {
    id: number;
    code?: string | null;
    name?: string | null;
    contactNumber?: string | null;
    totalDebt?: string | number | null;
    isActive?: boolean | null;
  }[];
  addresses?: RawAddress[] | null;
  customerGroupDetails?: { groupId?: number | null; customerGroup?: { id: number; name?: string | null } | null }[] | null;
}

// ---------- Địa chỉ ----------

/** "12 Lê Lợi, Phường Bến Thành, TP Hồ Chí Minh" (ưu tiên địa chỉ mới sau sáp nhập). */
export function addressLine(a: RawAddress | null | undefined): string {
  if (!a) return '';
  const isNew = !!(a.newCityName || a.newWardName);
  const parts = isNew
    ? [a.address, a.newWardName, a.newCityName]
    : [a.address, a.wardName, a.districtName, a.cityName || a.locationName];
  return parts.map((p) => (p ?? '').trim()).filter(Boolean).join(', ');
}

/** Địa chỉ cũ (3 cấp) khi địa chỉ đã có cả địa chỉ mới; rỗng nếu không có. */
export function oldAddressLine(a: RawAddress | null | undefined): string {
  if (!a || !(a.newCityName || a.newWardName)) return '';
  return [a.wardName, a.districtName, a.cityName || a.locationName].map((p) => (p ?? '').trim()).filter(Boolean).join(', ');
}

/** Tên gọi 1 địa chỉ trong danh sách. */
export const addressTitle = (a: RawAddress, index: number) => text(a.label) ?? text(a.receiver) ?? `Địa chỉ ${index + 1}`;

/** Đủ tỉnh / thành để lưu (backend cần mã tỉnh cũ hoặc mới). */
export const hasProvince = (a: RawAddress) => !!(text(a.newCityCode) || text(a.cityCode));

// ---------- Danh sách ----------

export interface CustomerRow {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  isCompany: boolean;
  organization: string | null;
  totalDebt: number;
  totalPurchased: number;
  totalRevenue: number;
  isActive: boolean;
  address: string | null;
  isChild: boolean;
}

export function toCustomerRow(r: RawCustomer): CustomerRow {
  const def = r.addresses?.find((a) => a.isDefault) ?? r.addresses?.[0];
  return {
    id: r.id,
    code: r.code ?? '',
    name: text(r.name) ?? 'Không tên',
    phone: text(r.contactNumber) ?? text(r.phone),
    isCompany: r.type === 1,
    organization: text(r.organization),
    totalDebt: num(r.totalDebt),
    totalPurchased: num(r.totalPurchased),
    totalRevenue: num(r.totalRevenue),
    isActive: r.isActive !== false,
    address: text(addressLine(def)),
    isChild: !!r.parentId,
  };
}

export type StatusFilter = 'active' | 'inactive' | 'all';
export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Đã ngừng' },
  { value: 'all', label: 'Tất cả' },
];

export type SortKey = 'newest' | 'oldest' | 'name' | 'buyMost' | 'buyLeast' | 'debtMost' | 'debtLeast';
export const SORTS: { value: SortKey; label: string; orderBy: string; dir: 'asc' | 'desc'; debt?: boolean }[] = [
  { value: 'newest', label: 'Mới tạo nhất', orderBy: 'createdAt', dir: 'desc' },
  { value: 'oldest', label: 'Cũ nhất', orderBy: 'createdAt', dir: 'asc' },
  { value: 'name', label: 'Tên A → Z', orderBy: 'name', dir: 'asc' },
  { value: 'buyMost', label: 'Mua nhiều nhất', orderBy: 'totalPurchased', dir: 'desc' },
  { value: 'buyLeast', label: 'Mua ít nhất', orderBy: 'totalPurchased', dir: 'asc' },
  { value: 'debtMost', label: 'Nợ nhiều nhất', orderBy: 'totalDebt', dir: 'desc', debt: true },
  { value: 'debtLeast', label: 'Nợ ít nhất', orderBy: 'totalDebt', dir: 'asc', debt: true },
];

/** Kỳ có sẵn, "all" hoặc khoảng ngày tự chọn. */
export type PeriodFilter = PeriodChoice;
export const PERIOD_OPTIONS: { value: Exclude<PeriodFilter, object>; label: string }[] = [
  { value: 'all', label: 'Toàn thời gian' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'yesterday', label: 'Hôm qua' },
  { value: 'last7', label: '7 ngày qua' },
  { value: 'thisMonth', label: 'Tháng này' },
  { value: 'lastMonth', label: 'Tháng trước' },
];

export interface CustomerFilters {
  status: StatusFilter;
  sort: SortKey;
  groupIds: number[];
  /** Ngày tạo khách. */
  created: PeriodFilter;
  /** Có hóa đơn trong khoảng (giao dịch cuối). */
  lastTx: PeriodFilter;
  purchasedFrom: number | null;
  purchasedTo: number | null;
  debtFrom: number | null;
  debtTo: number | null;
}

export const DEFAULT_FILTERS: CustomerFilters = {
  status: 'active',
  sort: 'newest',
  groupIds: [],
  created: 'all',
  lastTx: 'all',
  purchasedFrom: null,
  purchasedTo: null,
  debtFrom: null,
  debtTo: null,
};

/** Số bộ lọc đang bật trong sheet lọc (không tính trạng thái, sắp xếp). */
export function activeFilterCount(f: CustomerFilters, canViewDebt: boolean): number {
  let n = 0;
  if (f.groupIds.length) n++;
  if (f.created !== 'all') n++;
  if (f.lastTx !== 'all') n++;
  if (f.purchasedFrom !== null || f.purchasedTo !== null) n++;
  if (canViewDebt && (f.debtFrom !== null || f.debtTo !== null)) n++;
  return n;
}

function bounds(p: PeriodFilter, now: Date) {
  const r = resolvePeriod(p, now);
  return r ? dayBoundsIso(r.from, r.to) : null;
}

/**
 * Tham số `GET /customers` đúng với `CustomerQueryDto` (tham số lạ bị lỗi 400).
 * Ô tìm kiếm gửi bằng `name`: backend tìm theo tên, mã và số điện thoại.
 */
export function customerListQuery(search: string, f: CustomerFilters, page: number, canViewDebt: boolean, now = new Date()): Query {
  const sorts = SORTS.filter((s) => !s.debt || canViewDebt);
  const sort = sorts.find((s) => s.value === f.sort) ?? sorts[0];
  const q: Query = {
    ...customerFilterQuery(search, f, canViewDebt, now),
    pageSize: PAGE_SIZE,
    currentItem: (page - 1) * PAGE_SIZE,
    orderBy: sort.orderBy,
    orderDirection: sort.dir,
  };
  return q;
}

/** Phần lọc dùng chung cho danh sách và tổng số (`/customers/totals`). */
export function customerFilterQuery(search: string, f: CustomerFilters, canViewDebt: boolean, now = new Date()): Query {
  const q: Query = { name: search || undefined };
  if (f.status === 'active') q.isActive = true;
  else if (f.status === 'inactive') q.isActive = false;
  else q.includeInactive = true;
  if (f.groupIds.length) q.groupIds = f.groupIds;
  const created = bounds(f.created, now);
  if (created) {
    q.createdDateFrom = created.fromIso;
    q.createdDateTo = created.toIso;
  }
  const tx = bounds(f.lastTx, now);
  if (tx) {
    q.lastTransactionFrom = tx.fromIso;
    q.lastTransactionTo = tx.toIso;
  }
  if (f.purchasedFrom !== null) q.totalPurchasedFrom = Math.round(f.purchasedFrom);
  if (f.purchasedTo !== null) q.totalPurchasedTo = Math.round(f.purchasedTo);
  if (canViewDebt) {
    if (f.debtFrom !== null) q.debtFrom = Math.round(f.debtFrom);
    if (f.debtTo !== null) q.debtTo = Math.round(f.debtTo);
  }
  return q;
}

export interface CustomerTotals {
  count: number;
  totalDebt: number;
  totalPurchased: number;
}

// ---------- Chi tiết ----------

export interface ChildCustomer {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  totalDebt: number;
  isActive: boolean;
}

export interface InvoiceInfoLine {
  label: string;
  value: string;
}

export interface CustomerDetail extends CustomerRow {
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  taxCode: string | null;
  comments: string | null;
  createdAt: string | null;
  branchName: string | null;
  totalInvoiced: number;
  parent: { id: number; code: string; name: string } | null;
  children: ChildCustomer[];
  /** Nợ của các khách con (cộng vào "Công nợ tổng"). */
  childrenDebt: number;
  addresses: RawAddress[];
  groups: { id: number; name: string }[];
  invoiceInfo: InvoiceInfoLine[];
}

export function toCustomerDetail(r: RawCustomer): CustomerDetail {
  const children = (r.children ?? []).map((c) => ({
    id: c.id,
    code: c.code ?? '',
    name: text(c.name) ?? 'Không tên',
    phone: text(c.contactNumber),
    totalDebt: num(c.totalDebt),
    isActive: c.isActive !== false,
  }));
  const addresses = [...(r.addresses ?? [])].sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault));
  const groups = (r.customerGroupDetails ?? [])
    .map((g) => (g.customerGroup ? { id: g.customerGroup.id, name: g.customerGroup.name ?? '' } : null))
    .filter((g): g is { id: number; name: string } => !!g && !!g.name);
  const ward = [r.invoiceWardName, r.invoiceCityName].map((x) => text(x)).filter(Boolean).join(', ');
  const company = r.type === 1;
  const invoiceInfo: InvoiceInfoLine[] = [
    { label: company ? 'Tên người mua' : 'Người mua', value: text(r.invoiceBuyerName) ?? '' },
    { label: 'Tên công ty', value: company ? (text(r.organization) ?? '') : '' },
    { label: 'Mã số thuế', value: text(r.taxCode) ?? '' },
    { label: 'Địa chỉ', value: [text(r.invoiceAddress), ward || null].filter(Boolean).join(', ') },
    { label: 'Email', value: text(r.invoiceEmail) ?? '' },
    { label: 'Điện thoại', value: text(r.invoicePhone) ?? '' },
    { label: 'Số CCCD', value: text(r.invoiceCccdCmnd) ?? '' },
    { label: company ? 'Mã ĐVQHNS' : 'Số hộ chiếu', value: (company ? text(r.invoiceDvqhnsCode) : text(r.invoiceBankAccount)) ?? '' },
  ].filter((l) => l.value);

  return {
    ...toCustomerRow({ ...r, addresses }),
    phone1: text(r.contactNumber),
    phone2: text(r.phone),
    email: text(r.email),
    taxCode: text(r.taxCode),
    comments: text(r.comments),
    createdAt: r.createdAt ?? null,
    branchName: text(r.branch?.name),
    totalInvoiced: num(r.totalInvoiced),
    parent: r.parent ? { id: r.parent.id, code: r.parent.code ?? '', name: text(r.parent.name) ?? '' } : null,
    children,
    childrenDebt: children.reduce((s, c) => s + c.totalDebt, 0),
    addresses,
    groups,
    invoiceInfo,
  };
}

// ---------- Công nợ ----------

export type DebtType = 'invoice' | 'payment' | 'expense' | 'return_order';

export interface RawDebtEntry {
  type: DebtType | string;
  id: number;
  code?: string | null;
  date?: string | null;
  createdAt?: string | null;
  amount?: number | string | null;
  debtSnapshot?: number | string | null;
  branch?: { id?: number; name?: string | null } | null;
  customerName?: string | null;
}

export interface DebtEntry {
  key: string;
  type: DebtType;
  id: number;
  code: string;
  date: string | null;
  label: string;
  /** Nợ tăng (+) hay giảm (−). */
  delta: number;
  /** Dư nợ sau giao dịch. */
  balance: number;
  branchName: string | null;
  customerName: string | null;
}

export function debtLabel(type: DebtType, code: string): string {
  if (type === 'invoice') return 'Bán hàng';
  if (type === 'return_order') return 'Trả hàng';
  if (type === 'expense') return 'Phiếu chi';
  if (code.startsWith('TTDH')) return 'Thanh toán đơn hàng';
  if (code.startsWith('TTHD')) return 'Thanh toán hóa đơn';
  return 'Thu tiền khách';
}

const DEBT_TYPES: DebtType[] = ['invoice', 'payment', 'expense', 'return_order'];

export function toDebtEntry(r: RawDebtEntry): DebtEntry {
  const type = (DEBT_TYPES as string[]).includes(r.type) ? (r.type as DebtType) : 'payment';
  const amount = num(r.amount);
  const code = r.code ?? '';
  return {
    key: `${type}-${r.id}`,
    type,
    id: r.id,
    code,
    date: r.date ?? r.createdAt ?? null,
    label: debtLabel(type, code),
    // Giống cách backend cộng dồn dư nợ: bán hàng, phiếu chi làm tăng nợ.
    delta: type === 'invoice' || type === 'expense' ? amount : -amount,
    balance: num(r.debtSnapshot),
    branchName: text(r.branch?.name),
    customerName: text(r.customerName),
  };
}

// ---------- Thu nợ ----------

export interface UnpaidInvoice {
  id: number;
  code: string;
  date: string | null;
  /** Còn nợ. */
  debt: number;
  /** Giá trị hóa đơn. */
  total: number;
  customerName: string | null;
}

export interface RawInvoiceForDebt {
  id: number;
  code?: string | null;
  purchaseDate?: string | null;
  status?: number | null;
  grandTotal?: string | number | null;
  debtAmount?: string | number | null;
  returnOrderAmount?: string | number | null;
  customer?: { name?: string | null } | null;
}

/**
 * Hóa đơn còn nợ (giống web): bỏ hóa đơn hủy và hóa đơn đã trả hàng đủ.
 * Xếp cũ trước để trả dần.
 */
export function toUnpaidInvoices(rows: RawInvoiceForDebt[]): UnpaidInvoice[] {
  return rows
    .filter((r) => r.status !== 2 && num(r.debtAmount) > 0 && num(r.returnOrderAmount) < num(r.debtAmount))
    .map((r) => ({
      id: r.id,
      code: r.code ?? '',
      date: r.purchaseDate ?? null,
      debt: num(r.debtAmount),
      total: num(r.grandTotal),
      customerName: text(r.customer?.name),
    }))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.id - b.id);
}

/** Số tiền theo từng hóa đơn: mã hóa đơn → tiền. */
export type InvoiceAmounts = Record<number, number>;

export const sumAmounts = (m: InvoiceAmounts) => Object.values(m).reduce((s, x) => s + x, 0);

/**
 * Khoản có thể cấn trừ (giống web): tổng nợ các hóa đơn lớn hơn nợ thực của
 * khách, vd do trả hàng hoặc giao dịch cũ đã giảm nợ nhưng chưa trừ vào hóa đơn.
 */
export function availableCredit(invoices: UnpaidInvoice[], debt: number): number {
  return Math.max(0, Math.round(invoices.reduce((s, i) => s + i.debt, 0) - debt));
}

/** Cấn trừ mặc định: dồn vào hóa đơn cũ nhất (giống web). */
export function defaultOffsets(invoices: UnpaidInvoice[], credit: number): InvoiceAmounts {
  const first = invoices[0];
  const v = first ? Math.min(credit, first.debt) : 0;
  return first && v > 0 ? { [first.id]: v } : {};
}

/** Phần còn thu được của hóa đơn sau khi cấn trừ. */
export const payableOf = (inv: UnpaidInvoice, offsets: InvoiceAmounts) => Math.max(0, inv.debt - (offsets[inv.id] ?? 0));

/** Chia số tiền thu vào các hóa đơn, cũ trước, trừ phần đã cấn trừ; phần dư không gán hóa đơn nào. */
export function allocatePayment(amount: number, invoices: UnpaidInvoice[], offsets: InvoiceAmounts = {}): InvoiceAmounts {
  let left = Math.max(0, Math.round(amount));
  const out: InvoiceAmounts = {};
  for (const inv of invoices) {
    if (left <= 0) break;
    const pay = Math.min(left, payableOf(inv, offsets));
    if (pay > 0) out[inv.id] = pay;
    left -= pay;
  }
  return out;
}

/** Sửa tiền thu của một hóa đơn: trong khoảng 0 → phần còn nợ sau cấn trừ. */
export function setInvoicePay(
  invoices: UnpaidInvoice[],
  payments: InvoiceAmounts,
  offsets: InvoiceAmounts,
  id: number,
  value: number,
): InvoiceAmounts {
  const inv = invoices.find((i) => i.id === id);
  if (!inv) return payments;
  return { ...payments, [id]: Math.min(Math.max(0, Math.round(value)), payableOf(inv, offsets)) };
}

/** Sửa cấn trừ của một hóa đơn: không quá nợ hóa đơn và phần cấn trừ còn lại. */
export function setInvoiceOffset(
  invoices: UnpaidInvoice[],
  offsets: InvoiceAmounts,
  credit: number,
  id: number,
  value: number,
): InvoiceAmounts {
  const inv = invoices.find((i) => i.id === id);
  if (!inv) return offsets;
  const others = sumAmounts(offsets) - (offsets[id] ?? 0);
  const max = Math.min(inv.debt, Math.max(0, credit - others));
  return { ...offsets, [id]: Math.min(Math.max(0, Math.round(value)), max) };
}

/** Danh sách gửi API: theo thứ tự hóa đơn, bỏ dòng 0 và hóa đơn không còn trong danh sách. */
export function toAllocItems(m: InvoiceAmounts, invoices: UnpaidInvoice[]): { invoiceId: number; amount: number }[] {
  return invoices.filter((i) => (m[i.id] ?? 0) > 0).map((i) => ({ invoiceId: i.id, amount: m[i.id] }));
}

// ---------- Quyền ----------

export interface CustomerPerms {
  view: boolean;
  create: boolean;
  update: boolean;
  /** Sửa ghi chú (có quyền sửa khách hoặc quyền riêng "sửa ghi chú"). */
  editNote: boolean;
  /** Xem công nợ: chỉ ẩn trên giao diện (API vẫn trả). */
  viewDebt: boolean;
  /** Chọn Sale PIC; có quyền này thì tạo khách bắt buộc chọn. */
  assignSalePic: boolean;
  viewGroups: boolean;
  /** Thu nợ (tạo phiếu thu). */
  collect: boolean;
  viewInvoices: boolean;
  viewOrders: boolean;
}

export function customerPerms(user: PermissionHolder | null): CustomerPerms {
  const can = (p: string) => canDo(user, p);
  const update = can('customers:update');
  return {
    view: can('customers:view'),
    create: can('customers:create'),
    update,
    editNote: update || can('customers:update_comments'),
    viewDebt: can('customers:view_debt'),
    assignSalePic: can('customers:assign_sale_pic'),
    viewGroups: can('customer_groups:view'),
    collect: can('cash_flows:create'),
    viewInvoices: can('invoices:view'),
    viewOrders: can('orders:view'),
  };
}
