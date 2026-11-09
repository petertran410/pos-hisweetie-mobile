import { canDo, type PermissionHolder } from '@/core/can';
import { dayBoundsIso, resolvePeriod, type PeriodChoice } from '@/core/period';
import type { Query } from '@/core/request';
import type { AccentName, IconName } from '@/ui';

/** Số Decimal của backend trả về dạng chuỗi. */
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const text = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t ? t : null;
};

// ---------- Loại báo đơn ----------

/** Ba loại báo đơn theo đúng thứ tự làm việc: đóng → loading → giao. */
export type PackType = 'dong-hang' | 'loading' | 'giao-hang';
export const PACK_ORDER: PackType[] = ['dong-hang', 'loading', 'giao-hang'];

export interface PackTypeDef {
  label: string;
  icon: IconName;
  color: AccentName;
  /** Đường dẫn API của loại phiếu. */
  path: '/packing-hangs' | '/packing-loadings' | '/packing-slips';
  /** Tiền tố quyền: `packing_hangs:create`… */
  perm: 'packing_hangs' | 'packing_loadings' | 'packing_slips';
  /** Thư mục ảnh trên máy chủ (giống web); phiếu ký gửi dùng `ky-gui`. */
  subfolder: string;
  /** `packingType` khi quét QR chứng từ. */
  scanType: 'packing-hang' | 'packing-loading' | 'packing-slip';
  /** Hóa đơn được đổi sang trạng thái này khi tạo phiếu. */
  doneLabel: string;
}

export const PACK_TYPES: Record<PackType, PackTypeDef> = {
  'dong-hang': {
    label: 'Đóng hàng',
    icon: 'package',
    color: 'violet',
    path: '/packing-hangs',
    perm: 'packing_hangs',
    subfolder: 'dong-hang',
    scanType: 'packing-hang',
    doneLabel: 'Đã đóng',
  },
  loading: {
    label: 'Loading',
    icon: 'container',
    color: 'orange',
    path: '/packing-loadings',
    perm: 'packing_loadings',
    subfolder: 'loading',
    scanType: 'packing-loading',
    doneLabel: 'Đã loading',
  },
  'giao-hang': {
    label: 'Giao hàng',
    icon: 'truck',
    color: 'teal',
    path: '/packing-slips',
    perm: 'packing_slips',
    subfolder: 'bao-don',
    scanType: 'packing-slip',
    doneLabel: 'Đã giao',
  },
};

export const isPackType = (v: unknown): v is PackType => v === 'dong-hang' || v === 'loading' || v === 'giao-hang';

/** Ảnh của phiếu ký gửi nằm thư mục riêng (giống web). */
export const imageSubfolder = (type: PackType, mode: DocMode) => (mode === 'consignment' ? 'ky-gui' : PACK_TYPES[type].subfolder);

// ---------- Quyền ----------

export interface PackPerms {
  /** Xem danh sách gộp (`/all-packing`). */
  list: boolean;
  view: (t: PackType) => boolean;
  create: (t: PackType) => boolean;
  update: (t: PackType) => boolean;
  remove: (t: PackType) => boolean;
  /** Loại được phép tạo, theo thứ tự làm việc. */
  creatable: PackType[];
  /** Chọn phiếu ký gửi làm chứng từ. */
  consignments: boolean;
  /** Xem hóa đơn trong chứng từ. */
  invoices: boolean;
}

export function packPerms(user: PermissionHolder | null): PackPerms {
  const can = (t: PackType, action: string) => canDo(user, `${PACK_TYPES[t].perm}:${action}`);
  return {
    list: canDo(user, 'packing_slips:view'),
    view: (t) => can(t, 'view'),
    create: (t) => can(t, 'create'),
    update: (t) => can(t, 'update'),
    remove: (t) => can(t, 'delete'),
    creatable: PACK_ORDER.filter((t) => can(t, 'create')),
    consignments: canDo(user, 'consignments:view'),
    invoices: canDo(user, 'invoices:view'),
  };
}

// ---------- Dữ liệu API ----------

interface RawParty {
  id?: number;
  name?: string | null;
  code?: string | null;
  contactNumber?: string | null;
}

export interface RawPackDocLink {
  id?: number;
  invoiceId?: number | null;
  consignmentId?: number | null;
  invoice?: {
    id: number;
    code?: string | null;
    grandTotal?: string | number | null;
    purchaseDate?: string | null;
    branchId?: number | null;
    customer?: RawParty | null;
    paymentNote?: RawPayNote | null;
  } | null;
  consignment?: {
    id: number;
    code?: string | null;
    grandTotal?: string | number | null;
    consignDate?: string | null;
    branchId?: number | null;
    customer?: RawParty | null;
  } | null;
}

export interface RawPacking {
  id: number;
  code?: string | null;
  type?: string | null;
  branchId?: number | null;
  numberOfPackages?: number | string | null;
  note?: string | null;
  createdAt?: string | null;
  cancelledAt?: string | null;
  branch?: { id: number; name?: string | null } | null;
  creator?: RawParty | null;
  cancelledBy?: RawParty | null;
  loadingById?: number | null;
  loadingBy?: RawParty | null;
  paymentMethod?: string | null;
  cashAmount?: string | number | null;
  hasFeeGuiBen?: boolean | null;
  feeGuiBen?: string | number | null;
  hasFeeGrab?: boolean | null;
  feeGrab?: string | number | null;
  hasCuocGuiHang?: boolean | null;
  cuocGuiHang?: string | number | null;
  hasCuocNhanHang?: boolean | null;
  cuocNhanHang?: string | number | null;
  expensePayerId?: number | null;
  expensePayer?: RawParty | null;
  invoices?: RawPackDocLink[] | null;
  images?: { id: number; imageUrl?: string | null }[] | null;
  expenseFiles?: { id: number; fileUrl?: string | null; fileName?: string | null; fileType?: string | null; fileSize?: number | null }[] | null;
  imageCount?: number | null;
  expenseFileCount?: number | null;
  hasColdItems?: boolean | null;
  coldItemCount?: number | null;
  coldItems?: { invoiceCode?: string | null; productCode?: string | null; productName?: string | null }[] | null;
  cashWarning?: RawCashWarning | null;
}

/** Chứng từ (hóa đơn hoặc phiếu ký gửi) gắn với phiếu. */
export interface DocItem {
  kind: DocMode;
  id: number;
  code: string;
  customerName: string | null;
  total: number;
  date: string | null;
  branchId: number | null;
  /** Số mặt hàng lạnh trong chứng từ (cảnh báo). */
  coldCount: number;
  /** Đã có bao nhiêu phiếu cùng loại cho chứng từ này. */
  packingCount?: number;
  /** Cách khách trả ghi trên hóa đơn (ghi chú thanh toán mới nhất); null = chưa ghi. */
  payNote?: PayNote | null;
}

/** Ghi chú thanh toán của hóa đơn: tiền mặt kèm số tiền cần thu, hoặc chuyển khoản. */
export interface PayNote {
  cash: boolean;
  amount: number;
}

interface RawPayNote {
  paymentType?: string | null;
  amount?: string | number | null;
}

export const toPayNote = (r?: RawPayNote | null): PayNote | null =>
  r?.paymentType ? { cash: r.paymentType === 'cash', amount: r.paymentType === 'cash' ? Math.max(0, num(r.amount)) : 0 } : null;

export type DocMode = 'invoice' | 'consignment';

export function toDocItem(link: RawPackDocLink): DocItem | null {
  if (link.consignment) {
    const c = link.consignment;
    return {
      kind: 'consignment',
      id: c.id,
      code: c.code ?? '',
      customerName: text(c.customer?.name),
      total: num(c.grandTotal),
      date: c.consignDate ?? null,
      branchId: c.branchId ?? null,
      coldCount: 0,
    };
  }
  if (link.invoice) {
    const i = link.invoice;
    return {
      kind: 'invoice',
      id: i.id,
      code: i.code ?? '',
      customerName: text(i.customer?.name),
      total: num(i.grandTotal),
      date: i.purchaseDate ?? null,
      branchId: i.branchId ?? null,
      coldCount: 0,
      payNote: toPayNote(i.paymentNote),
    };
  }
  return null;
}

// ---------- Cảnh báo thu tiền mặt (phiếu giao hàng) ----------

/**
 * Phiếu giao hàng lệch với ghi chú thanh toán của hóa đơn:
 * - `transfer`: hóa đơn ghi thu tiền mặt nhưng phiếu chọn chuyển khoản;
 * - `amount`: tiền mặt cần thu trên phiếu khác tổng tiền mặt ghi trên các hóa đơn.
 */
export interface CashWarning {
  kind: 'transfer' | 'amount';
  /** Tổng tiền mặt các hóa đơn ghi thu. */
  invoiceCash: number;
  /** Tiền mặt cần thu ghi trên phiếu (0 khi chuyển khoản). */
  slipCash: number;
  /** Mã các hóa đơn ghi thu tiền mặt. */
  codes: string[];
}

interface RawCashWarning {
  kind?: string | null;
  invoiceCash?: string | number | null;
  slipCash?: string | number | null;
  codes?: (string | null)[] | null;
}

export const toCashWarning = (r?: RawCashWarning | null): CashWarning | null =>
  r && (r.kind === 'transfer' || r.kind === 'amount')
    ? { kind: r.kind, invoiceCash: num(r.invoiceCash), slipCash: num(r.slipCash), codes: (r.codes ?? []).filter((c): c is string => !!c) }
    : null;

/** Lệch dưới mức này (đồng) coi như khớp, giống backend. */
const CASH_EPSILON = 0.5;

/**
 * Tính cảnh báo ngay trên form, cùng quy tắc với backend (`packingCashWarning`):
 * chưa hóa đơn nào có ghi chú thanh toán thì không cảnh báo.
 */
export function cashWarningOf(payMethod: 'cash' | 'transfer', cashAmount: number, docs: DocItem[]): CashWarning | null {
  const noted = docs.filter((d) => d.kind === 'invoice' && d.payNote);
  if (!noted.length) return null;
  const cashDocs = noted.filter((d) => d.payNote?.cash);
  const invoiceCash = cashDocs.reduce((s, d) => s + (d.payNote?.amount ?? 0), 0);
  const codes = cashDocs.map((d) => d.code);
  if (payMethod !== 'cash') return cashDocs.length ? { kind: 'transfer', invoiceCash, slipCash: 0, codes } : null;
  const slipCash = Number(cashAmount) || 0;
  return Math.abs(slipCash - invoiceCash) > CASH_EPSILON ? { kind: 'amount', invoiceCash, slipCash, codes } : null;
}

/** Hóa đơn / phiếu ký gửi trả về từ ô chọn chứng từ (`/…/for-packing`) hoặc quét QR. */
export interface RawDocCandidate {
  id: number;
  kind?: 'invoice' | 'consignment' | string;
  code?: string | null;
  branchId?: number | null;
  grandTotal?: string | number | null;
  purchaseDate?: string | null;
  consignDate?: string | null;
  customer?: RawParty | null;
  coldItemCount?: number | null;
  packingCount?: number | null;
  paymentNote?: RawPayNote | null;
}

export const toCandidate = (r: RawDocCandidate, kind: DocMode): DocItem => ({
  kind,
  id: r.id,
  code: r.code ?? '',
  customerName: text(r.customer?.name),
  total: num(r.grandTotal),
  date: r.purchaseDate ?? r.consignDate ?? null,
  branchId: r.branchId ?? null,
  coldCount: num(r.coldItemCount),
  packingCount: r.packingCount ?? undefined,
  payNote: toPayNote(r.paymentNote),
});

// ---------- Danh sách ----------

export interface PackRow {
  key: string;
  id: number;
  type: PackType;
  code: string;
  cancelled: boolean;
  /** Khách đầu tiên + "+2 khách" (hoặc tên chi nhánh khi chưa có khách). */
  who: string;
  createdAt: string | null;
  creatorName: string | null;
  packages: number;
  docCodes: string[];
  imageCount: number;
  coldCount: number;
  /** Giao hàng: tiền mặt cần thu; null khi chuyển khoản / loại khác. */
  cash: number | null;
  transfer: boolean;
  /** Giao hàng lệch tiền mặt so với hóa đơn (backend tính). */
  cashWarning: CashWarning | null;
}

function whoOf(docs: DocItem[], branchName: string | null): string {
  const names = [...new Set(docs.map((d) => d.customerName).filter((n): n is string => !!n))];
  if (!names.length) return branchName ?? 'Chưa có khách';
  return names.length > 1 ? `${names[0]} +${names.length - 1} khách` : names[0];
}

export function toPackRow(r: RawPacking): PackRow | null {
  const type = r.type;
  if (!isPackType(type)) return null;
  const docs = (r.invoices ?? []).map(toDocItem).filter((d): d is DocItem => !!d);
  const isCash = type === 'giao-hang' && r.paymentMethod === 'cash';
  return {
    key: `${type}-${r.id}`,
    id: r.id,
    type,
    code: r.code ?? '',
    cancelled: !!r.cancelledAt,
    who: whoOf(docs, text(r.branch?.name)),
    createdAt: r.createdAt ?? null,
    creatorName: text(r.creator?.name),
    packages: num(r.numberOfPackages),
    docCodes: docs.map((d) => d.code),
    imageCount: num(r.imageCount ?? r.images?.length),
    coldCount: r.hasColdItems ? num(r.coldItemCount) : 0,
    cash: isCash ? num(r.cashAmount) : null,
    transfer: type === 'giao-hang' && !isCash,
    cashWarning: type === 'giao-hang' ? toCashWarning(r.cashWarning) : null,
  };
}

export type TypeFilter = 'all' | PackType;
export const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'dong-hang', label: 'Đóng hàng' },
  { value: 'loading', label: 'Loading' },
  { value: 'giao-hang', label: 'Giao hàng' },
];

export type PayFilter = 'all' | 'cash' | 'transfer';

export interface PackFilters {
  search: string;
  type: TypeFilter;
  period: PeriodChoice;
  invoiceSearch: string;
  customerSearch: string;
  /** Chỉ phiếu giao hàng có hình thức thanh toán. */
  pay: PayFilter;
  /** Lọc nhiều chi nhánh; rỗng = chi nhánh đang chọn (giống web). */
  branchIds: number[];
  /** Chỉ phiếu giao hàng lệch tiền mặt so với hóa đơn. */
  cashWarning: boolean;
}

export const DEFAULT_PACK_FILTERS: PackFilters = {
  search: '',
  type: 'all',
  // Web xem mọi thời gian, phân trang dần.
  period: 'all',
  invoiceSearch: '',
  customerSearch: '',
  pay: 'all',
  branchIds: [],
  cashWarning: false,
};

/** Số bộ lọc trong sheet lọc (không tính ô tìm, loại, thời gian). */
export const packFilterCount = (f: PackFilters) =>
  [f.invoiceSearch.trim(), f.customerSearch.trim(), f.pay !== 'all', f.branchIds.length > 0, f.cashWarning].filter(Boolean).length;

export const PACK_PAGE_SIZE = 20;

/** Tham số `GET /all-packing` đúng với DTO của backend (tham số lạ bị lỗi 400). */
export function packListQuery(f: PackFilters, branchId: number | null, page: number, now = new Date()): Query {
  const q: Query = {
    pageSize: PACK_PAGE_SIZE,
    currentItem: (page - 1) * PACK_PAGE_SIZE,
    ...(f.branchIds.length ? { branchIds: f.branchIds } : { branchId: branchId ?? undefined }),
    search: f.search.trim() || undefined,
    invoiceSearch: f.invoiceSearch.trim() || undefined,
    customerSearch: f.customerSearch.trim() || undefined,
  };
  // Lọc thanh toán chỉ có ở phiếu giao hàng (backend tự bỏ 2 loại kia).
  if (f.pay !== 'all') q.paymentMethod = f.pay;
  // Chỉ phiếu giao hàng lệch tiền mặt (backend cũng chỉ trả phiếu giao hàng).
  if (f.cashWarning) q.cashWarning = true;
  if (f.type !== 'all') q.type = f.type;
  const range = resolvePeriod(f.period, now);
  if (range) {
    const b = dayBoundsIso(range.from, range.to);
    q.fromCreatedDate = b.fromIso;
    q.toCreatedDate = b.toIso;
  }
  return q;
}

// ---------- Chi tiết ----------

export interface PackFile {
  url: string;
  name: string;
  type: string | null;
  size: number | null;
}

export const FEES = [
  { key: 'guiBen', label: 'Phí gửi bến', has: 'hasFeeGuiBen', amount: 'feeGuiBen' },
  { key: 'grab', label: 'Phí Grab', has: 'hasFeeGrab', amount: 'feeGrab' },
  { key: 'guiHang', label: 'Cước gửi hàng', has: 'hasCuocGuiHang', amount: 'cuocGuiHang' },
  { key: 'nhanHang', label: 'Cước nhận hàng', has: 'hasCuocNhanHang', amount: 'cuocNhanHang' },
] as const;

export type FeeKey = (typeof FEES)[number]['key'];
export type Fees = Record<FeeKey, { on: boolean; amount: number }>;

export const NO_FEES: Fees = {
  guiBen: { on: false, amount: 0 },
  grab: { on: false, amount: 0 },
  guiHang: { on: false, amount: 0 },
  nhanHang: { on: false, amount: 0 },
};

export interface PackDetail {
  id: number;
  type: PackType;
  code: string;
  branchId: number | null;
  branchName: string | null;
  createdAt: string | null;
  creatorName: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  packages: number;
  note: string | null;
  docMode: DocMode;
  docs: DocItem[];
  images: string[];
  coldCount: number;
  /** Mặt hàng lạnh: mã + tên hàng, thuộc hóa đơn nào (để đóng gói giữ lạnh). */
  coldItems: { code: string; name: string; doc: string }[];
  loadingBy: { id: number; name: string } | null;
  payMethod: 'cash' | 'transfer';
  cashAmount: number;
  cashWarning: CashWarning | null;
  fees: Fees;
  payer: { id: number; name: string } | null;
  files: PackFile[];
}

export function toPackDetail(type: PackType, r: RawPacking): PackDetail {
  const docs = (r.invoices ?? []).map(toDocItem).filter((d): d is DocItem => !!d);
  const fees = { ...NO_FEES };
  for (const f of FEES) fees[f.key] = { on: !!r[f.has], amount: num(r[f.amount]) };
  return {
    id: r.id,
    type,
    code: r.code ?? '',
    branchId: r.branchId ?? r.branch?.id ?? null,
    branchName: text(r.branch?.name),
    createdAt: r.createdAt ?? null,
    creatorName: text(r.creator?.name),
    cancelledAt: r.cancelledAt ?? null,
    cancelledByName: text(r.cancelledBy?.name),
    packages: num(r.numberOfPackages),
    note: text(r.note),
    docMode: docs.some((d) => d.kind === 'consignment') ? 'consignment' : 'invoice',
    docs,
    images: (r.images ?? []).map((i) => i.imageUrl).filter((u): u is string => !!u),
    coldCount: r.hasColdItems ? num(r.coldItemCount) : 0,
    coldItems: (r.coldItems ?? []).map((c) => ({ code: c.productCode ?? '', name: c.productName || 'Sản phẩm', doc: c.invoiceCode ?? '' })),
    loadingBy: r.loadingBy?.id ? { id: r.loadingBy.id, name: r.loadingBy.name ?? '' } : null,
    payMethod: r.paymentMethod === 'cash' ? 'cash' : 'transfer',
    cashAmount: num(r.cashAmount),
    cashWarning: type === 'giao-hang' && !r.cancelledAt ? toCashWarning(r.cashWarning) : null,
    fees,
    payer: r.expensePayer?.id ? { id: r.expensePayer.id, name: r.expensePayer.name ?? '' } : null,
    files: (r.expenseFiles ?? [])
      .filter((f) => !!f.fileUrl)
      .map((f) => ({ url: f.fileUrl ?? '', name: f.fileName || fileNameOf(f.fileUrl ?? ''), type: f.fileType ?? null, size: f.fileSize ?? null })),
  };
}

export const fileNameOf = (url: string) => decodeURIComponent(url.split('?')[0].split('/').pop() ?? 'Tệp');

/** Tệp là ảnh (để hiện ảnh nhỏ thay vì biểu tượng tệp). */
export const isImageFile = (f: { type: string | null; name: string; url: string | null }) =>
  (f.type ?? '').startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name || f.url || '');

export const feeTotal = (fees: Fees) => FEES.reduce((s, f) => s + (fees[f.key].on ? fees[f.key].amount : 0), 0);

// ---------- Form ----------

/** Ảnh / tệp trong form: tải lên ngay khi chọn, lưu phiếu chỉ gửi đường dẫn. */
export interface Attachment {
  key: string;
  /** Ảnh trên máy (xem trước) hoặc đường dẫn đã có trên máy chủ. */
  uri: string;
  /** Đường dẫn trên máy chủ khi đã tải xong. */
  url: string | null;
  state: 'queued' | 'uploading' | 'done' | 'error';
  name: string;
  type: string | null;
  size: number | null;
  error?: string;
}

export interface PackForm {
  type: PackType;
  docMode: DocMode;
  branchId: number | null;
  docs: DocItem[];
  packages: number;
  note: string;
  images: Attachment[];
  // Loading
  loadingBy: { id: number; name: string } | null;
  // Giao hàng
  /** null = chưa chọn: người tạo phiếu tự chọn, hệ thống không chọn sẵn (giống bán hàng). */
  payMethod: 'cash' | 'transfer' | null;
  cashAmount: number;
  fees: Fees;
  payer: { id: number; name: string } | null;
  files: Attachment[];
}

const remote = (url: string, i: number, name?: string, type?: string | null, size?: number | null): Attachment => ({
  key: `r${i}-${url}`,
  uri: url,
  url,
  state: 'done',
  name: name ?? fileNameOf(url),
  type: type ?? null,
  size: size ?? null,
});

export function newPackForm(type: PackType, branchId: number | null, docs: DocItem[] = []): PackForm {
  return {
    type,
    docMode: 'invoice',
    branchId,
    docs,
    // Để 0 như web: người dùng phải tự nhập số kiện.
    packages: 0,
    note: '',
    images: [],
    loadingBy: null,
    payMethod: null,
    cashAmount: 0,
    fees: NO_FEES,
    payer: null,
    files: [],
  };
}

/** Thanh toán ghi trên các hóa đơn đã chọn (chỉ để gợi ý): có hóa đơn ghi tiền mặt thì cộng số tiền cần thu. */
export function docPay(docs: DocItem[]): { cash: boolean; amount: number; codes: string[] } | null {
  const cashDocs = docs.filter((d) => d.payNote?.cash);
  if (!cashDocs.length) return docs.some((d) => d.payNote) ? { cash: false, amount: 0, codes: [] } : null;
  return { cash: true, amount: cashDocs.reduce((s, d) => s + (d.payNote?.amount ?? 0), 0), codes: cashDocs.map((d) => d.code) };
}

type PayPatch = Pick<PackForm, 'payMethod' | 'cashAmount'>;

/**
 * Người dùng chọn hình thức thanh toán. Chọn tiền mặt khi ô số tiền còn trống thì điền sẵn
 * tiền mặt ghi trên hóa đơn (giống bán hàng điền "Khách cần trả"), vẫn sửa được.
 */
export function choosePayMethod(form: PackForm, payMethod: 'cash' | 'transfer'): PayPatch {
  const pay = payMethod === 'cash' && !(form.cashAmount > 0) ? docPay(form.docs) : null;
  return { payMethod, cashAmount: pay?.cash ? pay.amount : form.cashAmount };
}

/** Nút "Dùng theo hóa đơn": lấy hình thức + tiền mặt cần thu đúng như hóa đơn ghi. */
export function payFromDocs(form: PackForm): PayPatch | null {
  const pay = docPay(form.docs);
  if (!pay) return null;
  return pay.cash ? { payMethod: 'cash', cashAmount: pay.amount } : { payMethod: 'transfer', cashAmount: 0 };
}

/** Đổi danh sách chứng từ (thêm / bỏ). */
export const withDocs = (form: PackForm, docs: DocItem[]): PackForm => ({ ...form, docs });

export function toPackForm(d: PackDetail): PackForm {
  return {
    type: d.type,
    docMode: d.docMode,
    branchId: d.branchId,
    docs: d.docs,
    packages: d.packages,
    note: d.note ?? '',
    images: d.images.map((u, i) => remote(u, i)),
    loadingBy: d.loadingBy,
    payMethod: d.payMethod,
    cashAmount: d.cashAmount,
    fees: d.fees,
    payer: d.payer,
    files: d.files.map((f, i) => remote(f.url, i, f.name, f.type, f.size)),
  };
}

const anyFee = (fees: Fees) => FEES.some((f) => fees[f.key].on);

/**
 * Thêm chứng từ: bỏ trùng; chứng từ phải đúng chi nhánh đang chọn (giống web).
 * Đóng hàng / loading chưa có chi nhánh thì lấy theo chứng từ đầu tiên.
 */
export function addDocs(form: PackForm, incoming: DocItem[]): { form: PackForm; error: string | null; added: number } {
  let docs = form.docs;
  let branchId = form.branchId;
  let error: string | null = null;
  let added = 0;
  for (const d of incoming) {
    if (d.kind !== form.docMode) {
      error = d.kind === 'consignment' ? 'QR này là phiếu ký gửi' : 'QR này là hóa đơn';
      continue;
    }
    if (docs.some((x) => x.id === d.id)) continue;
    const base = docs[0]?.branchId ?? branchId;
    if (base && d.branchId && d.branchId !== base) {
      error = docs.length && form.type !== 'giao-hang' ? 'Chỉ được chọn chứng từ cùng chi nhánh' : 'Chứng từ không thuộc chi nhánh đang chọn';
      continue;
    }
    if (!branchId && d.branchId) branchId = d.branchId;
    docs = [...docs, d];
    added++;
  }
  return { form: withDocs({ ...form, branchId }, docs), error, added };
}

/** Lỗi đầu tiên cần sửa; null = lưu được. */
export function validatePackForm(f: PackForm): string | null {
  if (!f.branchId) return 'Vui lòng chọn chi nhánh';
  if (!f.docs.length) return f.docMode === 'consignment' ? 'Vui lòng chọn ít nhất 1 phiếu ký gửi' : 'Vui lòng chọn ít nhất 1 hóa đơn';
  if (!(f.packages > 0)) return 'Số kiện phải lớn hơn 0';
  if (f.type === 'loading' && !f.loadingBy) return 'Vui lòng chọn người loading';
  if (f.type === 'giao-hang') {
    if (!f.payMethod) return 'Vui lòng chọn hình thức thanh toán: chuyển khoản hoặc tiền mặt';
    if (f.payMethod === 'cash' && !(f.cashAmount > 0)) return 'Vui lòng nhập số tiền thanh toán';
    if (anyFee(f.fees) && !f.payer) return 'Vui lòng chọn người chi khi có chi phí';
  }
  if (f.note.length > 1000) return 'Ghi chú tối đa 1000 ký tự';
  return null;
}

/** Ảnh / tệp chưa tải xong (đang tải hoặc lỗi). */
export const pendingUploads = (f: PackForm) => [...f.images, ...(f.type === 'giao-hang' && anyFee(f.fees) ? f.files : [])].filter((a) => a.state !== 'done');

/**
 * Nội dung gửi tạo / sửa phiếu. Luôn gửi đủ các trường: backend đặt lại phí về 0
 * nếu thiếu và thay toàn bộ ảnh / tệp theo danh sách gửi lên.
 */
export function buildPackPayload(f: PackForm): Record<string, unknown> {
  const ids = f.docs.map((d) => d.id);
  const imageUrls = f.images.map((a) => a.url).filter((u): u is string => !!u);
  const base: Record<string, unknown> = {
    branchId: f.branchId,
    // Chỉ gửi 1 trong 2: gửi `consignmentIds: []` kèm hóa đơn làm mất liên kết hóa đơn.
    ...(f.docMode === 'consignment' ? { consignmentIds: ids } : { invoiceIds: ids }),
    numberOfPackages: Math.round(f.packages),
    note: f.note.trim(),
    imageUrls,
  };
  if (f.type === 'loading') return { ...base, loadingById: f.loadingBy?.id };
  if (f.type === 'dong-hang') return base;
  const fee = anyFee(f.fees);
  const amt = (k: FeeKey) => (f.fees[k].on ? Math.round(f.fees[k].amount) : 0);
  return {
    ...base,
    paymentMethod: f.payMethod,
    cashAmount: f.payMethod === 'cash' ? Math.round(f.cashAmount) : 0,
    hasFeeGuiBen: f.fees.guiBen.on,
    feeGuiBen: amt('guiBen'),
    hasFeeGrab: f.fees.grab.on,
    feeGrab: amt('grab'),
    hasCuocGuiHang: f.fees.guiHang.on,
    cuocGuiHang: amt('guiHang'),
    hasCuocNhanHang: f.fees.nhanHang.on,
    cuocNhanHang: amt('nhanHang'),
    expensePayerId: fee ? (f.payer?.id ?? null) : null,
    expenseFiles: fee
      ? f.files
          .filter((a) => !!a.url)
          .map((a) => ({ fileUrl: a.url, fileName: a.name, fileType: a.type ?? undefined, fileSize: a.size ?? undefined }))
      : [],
  };
}

/** So sánh để hỏi trước khi bỏ form (bỏ qua trạng thái tải ảnh). */
export function isPackDirty(f: PackForm, base: PackForm): boolean {
  const strip = (x: PackForm) => ({
    ...x,
    images: x.images.map((a) => a.url ?? a.uri),
    files: x.files.map((a) => a.url ?? a.uri),
  });
  return JSON.stringify(strip(f)) !== JSON.stringify(strip(base));
}

// ---------- Chờ giao ----------

export interface WaitingInvoice {
  id: number;
  code: string;
  customerName: string | null;
  total: number;
  branchId: number | null;
  status: number | null;
  statusLabel: string | null;
  createdAt: string | null;
  payNote: PayNote | null;
}

export interface RawWaiting {
  id: number;
  code?: string | null;
  status?: number | null;
  statusValue?: string | null;
  branchId?: number | null;
  grandTotal?: string | number | null;
  createdAt?: string | null;
  customer?: RawParty | null;
  paymentNote?: RawPayNote | null;
}

/** Nhãn + màu trạng thái hóa đơn chờ giao (giống web). */
export const WAITING_STATUS: Record<number, { label: string; tone: 'warning' | 'danger' | 'info' | 'violet' }> = {
  3: { label: 'Đang xử lý', tone: 'warning' },
  4: { label: 'Không giao được', tone: 'danger' },
  5: { label: 'Đóng hàng', tone: 'info' },
  6: { label: 'Loading', tone: 'violet' },
};

export const waitingStatus = (w: Pick<WaitingInvoice, 'status' | 'statusLabel'>) =>
  (w.status !== null ? WAITING_STATUS[w.status] : undefined) ?? { label: w.statusLabel ?? 'Chưa giao', tone: 'warning' as const };

export const toWaiting = (r: RawWaiting): WaitingInvoice => ({
  id: r.id,
  code: r.code ?? '',
  customerName: text(r.customer?.name),
  total: num(r.grandTotal),
  branchId: r.branchId ?? null,
  status: r.status ?? null,
  statusLabel: text(r.statusValue),
  createdAt: r.createdAt ?? null,
  payNote: toPayNote(r.paymentNote),
});

/** Hóa đơn chờ giao → chứng từ để mở form giao hàng có sẵn. */
export const waitingToDoc = (w: WaitingInvoice): DocItem => ({
  kind: 'invoice',
  id: w.id,
  code: w.code,
  customerName: w.customerName,
  total: w.total,
  date: w.createdAt,
  branchId: w.branchId,
  coldCount: 0,
  payNote: w.payNote,
});
