import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { http } from '@/core/http';
import { useSession } from '@/core/session';
import type { SaleProduct } from './cart';
import {
  toPriceHistoryRow,
  toSaleCustomer,
  toSaleProduct,
  type RawCustomer,
  type RawPriceHistory,
  type RawProduct,
} from './mappers';

/** Prisma Decimal về dạng chuỗi → số. */
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const PAGE_SIZE = 20;

// ---------- Hàng hóa ----------

interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/** Danh sách hàng bán được tại chi nhánh, tìm theo tên/mã, tải thêm khi cuộn. */
export function useSaleProducts(search: string, opts: { priceBookId?: number | null; onlyInPriceBook?: boolean }) {
  const branchId = useSession((s) => s.branchId);
  return useInfiniteQuery({
    queryKey: ['sales', 'products', branchId, search, opts.priceBookId ?? 0, !!opts.onlyInPriceBook],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await http.get<Page<RawProduct>>('/products', {
        search: search || undefined,
        page: pageParam,
        limit: PAGE_SIZE,
        branchId: branchId ?? undefined,
        isActive: true,
        isDirectSale: true,
        priceBookId: opts.onlyInPriceBook && opts.priceBookId ? opts.priceBookId : undefined,
        onlyInPriceBook: opts.onlyInPriceBook && opts.priceBookId ? true : undefined,
      });
      return { ...res, items: res.data.map((p) => toSaleProduct(p, branchId)) };
    },
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Tìm đúng 1 hàng theo mã vừa quét (khớp mã chính xác, không phân biệt hoa thường). */
export async function findProductByCode(code: string, branchId: number | null): Promise<SaleProduct[]> {
  const res = await http.get<Page<RawProduct>>('/products', {
    search: code,
    page: 1,
    limit: 10,
    branchId: branchId ?? undefined,
    isActive: true,
    isDirectSale: true,
  });
  return res.data.map((p) => toSaleProduct(p, branchId));
}

// ---------- Bảng giá ----------

export interface PriceBookSummary {
  id: number;
  name: string;
}

export interface PriceBookDetail {
  id: number;
  name: string;
  allowNonListedProducts: boolean;
  warnNonListedProducts: boolean;
  prices: Map<number, number>;
}

/** Bảng giá dùng được ở chi nhánh (theo khách + nhân viên), ưu tiên cao trước. */
export function useApplicablePriceBooks(customerId: number | null | undefined, enabled: boolean) {
  const branchId = useSession((s) => s.branchId);
  const userId = useSession((s) => s.user?.id);
  return useQuery({
    queryKey: ['sales', 'price-books', branchId, customerId ?? 0, userId],
    enabled,
    queryFn: async () => {
      const rows = await http.get<{ id: number; name: string }[]>('/price-books/applicable', {
        branchId: branchId ?? undefined,
        customerId: customerId ?? undefined,
        userId,
      });
      return rows.map((r) => ({ id: r.id, name: r.name }));
    },
    staleTime: 5 * 60_000,
  });
}

/** Giá từng sản phẩm của 1 bảng giá (0/null = bảng giá chung → dùng giá gốc). */
export function usePriceBook(id: number | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['sales', 'price-book', id],
    enabled: enabled && !!id && id > 0,
    queryFn: () => fetchPriceBook(id as number),
    staleTime: 5 * 60_000,
  });
}

export async function fetchPriceBook(id: number): Promise<PriceBookDetail> {
  const raw = await http.get<{
    id: number;
    name: string;
    allowNonListedProducts?: boolean;
    warnNonListedProducts?: boolean;
    priceBookDetails?: { productId: number; price: string | number; isActive?: boolean }[];
  }>(`/price-books/${id}`);
  const prices = new Map<number, number>();
  for (const d of raw.priceBookDetails ?? []) {
    if (d.isActive === false) continue;
    prices.set(d.productId, num(d.price));
  }
  return {
    id: raw.id,
    name: raw.name,
    allowNonListedProducts: raw.allowNonListedProducts !== false,
    warnNonListedProducts: !!raw.warnNonListedProducts,
    prices,
  };
}

/** Giá bán của 1 sản phẩm theo bảng giá đang chọn. */
export function priceFor(product: SaleProduct, book: PriceBookDetail | null | undefined): number {
  return book?.prices.get(product.id) ?? product.basePrice;
}

// ---------- Khách hàng ----------

/** Tìm khách theo tên / mã / số điện thoại (để trống: 50 khách đầu). */
export function useCustomerSearch(search: string) {
  return useQuery({
    queryKey: ['sales', 'customers', search],
    queryFn: async () => {
      const res = await http.get<{ data: RawCustomer[] }>('/customers/search', { search: search || undefined });
      return res.data.map(toSaleCustomer);
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/**
 * Giá khách đã mua món này ở 5 hóa đơn gần nhất tại chi nhánh đang chọn
 * (giống nút lịch sử giá trên dòng hàng của web POS).
 */
export function useProductPriceHistory(customerId: number | null | undefined, productId: number, enabled: boolean) {
  const branchId = useSession((s) => s.branchId);
  return useQuery({
    queryKey: ['sales', 'price-history', customerId ?? 0, productId, branchId],
    enabled: enabled && !!customerId && productId > 0,
    queryFn: async () => {
      const rows = await http.get<RawPriceHistory[]>('/orders/product-price-history', {
        customerId: customerId ?? undefined,
        productId,
        type: 'invoice',
        branchId: branchId ?? undefined,
      });
      return (rows ?? []).map(toPriceHistoryRow);
    },
    staleTime: 30_000,
  });
}

// ---------- Tồn kho của 1 dòng hàng (màn Sửa hàng, giống dòng tồn trên web POS) ----------

/** Quyền xem từng số tồn (mỗi API cần quyền riêng; thiếu quyền thì không gọi, ẩn ô đó). */
export interface StockAccess {
  /** `inventory:view`: tồn + tồn KM mới nhất. Thiếu thì dùng tồn lúc tải danh sách hàng. */
  inventory: boolean;
  /** `orders:view`: khách đã đặt (đơn đặt hàng chưa xong). */
  customerOrdered: boolean;
  /** `order_suppliers:view`: đã đặt nhà cung cấp. */
  supplierOrdered: boolean;
  /** `products:view` hoặc `transfers:view`: hàng đang chuyển tới chi nhánh. */
  inTransit: boolean;
}

/** 1 ô số tồn. `value`: `undefined` = đang tải, `null` = không lấy được. */
export interface StockCell {
  key: 'onHand' | 'customerOrdered' | 'supplierOrdered' | 'inTransit' | 'promo';
  label: string;
  value: number | null | undefined;
}

const stockValue = (q: { data?: number; isError: boolean }) => (q.isError ? null : q.data);

/** Tổng theo sản phẩm tại chi nhánh (`{ [productId]: số }`), dùng chung cho 3 API tổng hợp. */
function useStockSummary(path: string, productId: number, branchId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['sales', 'stock', path, productId, branchId],
    enabled: enabled && productId > 0,
    queryFn: async () => {
      const res = await http.get<Record<string, number | string> | null>(path, {
        productIds: String(productId),
        branchId: branchId ?? undefined,
      });
      return num(res?.[String(productId)]);
    },
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * Tồn, khách đặt, đặt NCC, đang đi đường, tồn KM của 1 hàng hóa tại chi nhánh
 * đang chọn. `fallbackOnHand`: tồn lúc tải danh sách hàng (khi không có quyền
 * xem tồn mới nhất).
 */
export function useLineStock(
  productId: number,
  fallbackOnHand: number | null | undefined,
  access: StockAccess,
  enabled: boolean,
): StockCell[] {
  const branchId = useSession((s) => s.branchId);
  const inventory = useQuery({
    queryKey: ['sales', 'stock', 'inventory', productId, branchId],
    enabled: enabled && access.inventory && productId > 0 && !!branchId,
    queryFn: async () => {
      const rows = await http.get<{ productId: number; onHand?: number | string; promoQuantity?: number | string }[]>(
        '/inventories/by-branch',
        { branchId: branchId ?? undefined, productIds: String(productId) },
      );
      const row = (rows ?? []).find((r) => r.productId === productId);
      return { onHand: num(row?.onHand), promo: num(row?.promoQuantity) };
    },
    staleTime: 30_000,
    retry: false,
  });
  const customerOrdered = useStockSummary('/orders/pending-summary', productId, branchId, enabled && access.customerOrdered);
  const supplierOrdered = useStockSummary('/order-suppliers/confirmed-summary', productId, branchId, enabled && access.supplierOrdered);
  const inTransit = useStockSummary('/transfers/in-transit-summary', productId, branchId, enabled && access.inTransit);

  const live = access.inventory && !!branchId;
  // Chưa tải xong (hoặc lỗi) tồn mới nhất thì hiện tồn đã có lúc tải danh sách hàng.
  const onHand = live && inventory.data ? inventory.data.onHand : inventory.isLoading && live ? (fallbackOnHand ?? undefined) : (fallbackOnHand ?? null);
  const cells: StockCell[] = [{ key: 'onHand', label: 'Tồn', value: onHand }];
  if (access.customerOrdered) cells.push({ key: 'customerOrdered', label: 'KH đặt', value: stockValue(customerOrdered) });
  if (access.supplierOrdered) cells.push({ key: 'supplierOrdered', label: 'Đặt NCC', value: stockValue(supplierOrdered) });
  if (access.inTransit) cells.push({ key: 'inTransit', label: 'Đang đi đường', value: stockValue(inTransit) });
  if (live) cells.push({ key: 'promo', label: 'Tồn KM', value: inventory.isError ? null : inventory.data?.promo });
  return cells;
}

// ---------- Thanh toán ----------

export interface BankAccount {
  id: number;
  bankName?: string | null;
  bankCode?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
}

export function useBankAccounts(enabled: boolean) {
  return useQuery({
    queryKey: ['sales', 'bank-accounts'],
    enabled,
    queryFn: () => http.get<BankAccount[]>('/bank-accounts/for-payment'),
    staleTime: 10 * 60_000,
  });
}

/** "VCB · ****6789" */
/** "VCB · 0123456789": hiện đủ số tài khoản để chọn đúng tài khoản nhận. */
export function bankLabel(a: BankAccount): string {
  return [a.bankCode || a.bankName, a.accountNumber].filter(Boolean).join(' · ') || `Tài khoản #${a.id}`;
}

/** Chọn tài khoản nhận: tên ngân hàng + số tài khoản, dòng phụ là chủ tài khoản. */
export const bankOptions = (list: BankAccount[]) =>
  list.map((a) => ({
    value: a.id,
    label: bankLabel(a),
    sub: [a.bankCode ? a.bankName : null, a.accountHolder].filter(Boolean).join(' · ') || null,
  }));

// ---------- Khuyến mãi (chỉ để cảnh báo) ----------

export interface EligiblePromotion {
  promotionId: number;
  name: string;
  autoApply: boolean;
}

/**
 * Kiểm tra giỏ có chương trình khuyến mãi nào áp dụng không. App chưa áp dụng
 * khuyến mãi nên chỉ dùng để nhắc người bán.
 */
export function usePromotionCheck(
  input: { customerId?: number; userId?: number; items: { productId: number; quantity: number; price: number; discount: number }[] },
  enabled: boolean,
) {
  const branchId = useSession((s) => s.branchId);
  const key = input.items.map((i) => `${i.productId}:${i.quantity}:${i.price}:${i.discount}`).join('|');
  return useQuery({
    queryKey: ['sales', 'promotions', branchId, input.customerId ?? 0, key],
    enabled: enabled && !!branchId && input.items.length > 0,
    queryFn: async () => {
      const res = await http.post<{ eligiblePromotions?: { promotionId: number; name: string; autoApply: boolean }[] }>(
        '/promotions/evaluate',
        { branchId, customerId: input.customerId, userId: input.userId, items: input.items },
      );
      const seen = new Set<number>();
      return (res.eligiblePromotions ?? []).filter((p) => !seen.has(p.promotionId) && seen.add(p.promotionId));
    },
    staleTime: 60_000,
    retry: false,
  });
}

// ---------- Tạo đơn ----------

export interface CreatedInvoice {
  id: number;
  code: string;
}

export interface CreatedOrder {
  order: { id: number; code: string };
  warnings?: string[];
}

export const createPosInvoice = (body: unknown) => http.post<CreatedInvoice>('/invoices/pos', body);
export const createOrder = (body: unknown) => http.post<CreatedOrder>('/orders', body);
export const addOrderPayment = (body: { orderId: number; amount: number; paymentMethod: string; accountId?: number }) =>
  http.post<unknown>('/order-payments', body);
export const addPaymentNote = (kind: 'invoices' | 'orders', id: number, body: { paymentType: string; amount?: number }) =>
  http.post<unknown>(`/${kind}/${id}/payment-note`, body);
