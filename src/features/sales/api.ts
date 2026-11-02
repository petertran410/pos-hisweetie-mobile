import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { http } from '@/core/http';
import { useSession } from '@/core/session';
import type { SaleProduct } from './cart';
import { toSaleCustomer, toSaleProduct, type RawCustomer, type RawProduct } from './mappers';

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
export function bankLabel(a: BankAccount): string {
  const tail = a.accountNumber ? `****${a.accountNumber.slice(-4)}` : '';
  return [a.bankCode || a.bankName, tail].filter(Boolean).join(' · ');
}

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
