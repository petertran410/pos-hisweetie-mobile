import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { http } from '@/core/http';
import { toDocRow } from '../orders/api';
import type { DocKind } from '../orders/model';
import type { Named } from './form';
import {
  customerFilterQuery,
  customerListQuery,
  HISTORY_PAGE_SIZE,
  num,
  PAGE_SIZE,
  toCustomerRow,
  toDebtEntry,
  toUnpaidInvoices,
  type CustomerFilters,
  type CustomerTotals,
  type RawCustomer,
  type RawDebtEntry,
  type RawInvoiceForDebt,
} from './model';

// ---------- Danh sách ----------

interface RawPage {
  data: RawCustomer[];
  total: number;
}

export function useCustomerList(search: string, filters: CustomerFilters, canViewDebt: boolean, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['customers', search, filters, canViewDebt],
    enabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await http.get<RawPage>('/customers', customerListQuery(search, filters, pageParam, canViewDebt));
      return { page: pageParam, total: num(res.total), rows: (res.data ?? []).map(toCustomerRow) };
    },
    getNextPageParam: (last) => (last.page * PAGE_SIZE < last.total ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

/** Tổng số khách, tổng nợ, tổng bán theo bộ lọc. */
export function useCustomerTotals(search: string, filters: CustomerFilters, canViewDebt: boolean, enabled: boolean) {
  return useQuery({
    queryKey: ['customers', 'totals', search, filters, canViewDebt],
    enabled,
    queryFn: async (): Promise<CustomerTotals> => {
      const r = await http.get<Partial<CustomerTotals>>('/customers/totals', customerFilterQuery(search, filters, canViewDebt));
      return { count: num(r.count), totalDebt: num(r.totalDebt), totalPurchased: num(r.totalPurchased) };
    },
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

// ---------- Chi tiết ----------

export function useCustomerDetail(id: number) {
  return useQuery({
    queryKey: ['customer', id],
    enabled: Number.isFinite(id) && id > 0,
    queryFn: async () => {
      const raw = await http.get<RawCustomer | null>(`/customers/${id}`);
      if (!raw) throw new Error('Không tìm thấy khách hàng');
      return raw;
    },
    staleTime: 15_000,
  });
}

interface RawDocPage {
  data: Parameters<typeof toDocRow>[1][];
  total: number;
}

/** Hóa đơn / đơn đặt hàng của khách, mới nhất trước, tải dần. */
export function useCustomerDocs(kind: DocKind, customerId: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['customer-docs', kind, customerId],
    enabled: enabled && customerId > 0,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const query =
        kind === 'invoice'
          ? { customerIds: [customerId], page: pageParam, limit: HISTORY_PAGE_SIZE, orderBy: 'purchaseDate', orderDirection: 'desc' }
          : { customerId, page: pageParam, limit: HISTORY_PAGE_SIZE, orderBy: 'orderDate', orderDirection: 'desc' };
      const res = await http.get<RawDocPage>(kind === 'invoice' ? '/invoices' : '/orders', query);
      return { page: pageParam, total: num(res.total), rows: (res.data ?? []).map((r) => toDocRow(kind, r)) };
    },
    getNextPageParam: (last) => (last.page * HISTORY_PAGE_SIZE < last.total ? last.page + 1 : undefined),
    staleTime: 20_000,
  });
}

/** Lịch sử công nợ (backend trả hết, mới nhất trước, kèm dư nợ sau mỗi dòng). */
export function useDebtTimeline(customerId: number, includeChildren: boolean, enabled: boolean) {
  return useQuery({
    queryKey: ['customer-debt', customerId, includeChildren],
    enabled: enabled && customerId > 0,
    queryFn: async () => {
      const res = await http.get<{ data: RawDebtEntry[] }>(
        `/customers/${customerId}/debt-timeline`,
        includeChildren ? { includeChildren: true } : undefined,
      );
      return (res.data ?? []).map(toDebtEntry);
    },
    staleTime: 15_000,
  });
}

// ---------- Danh mục cho form ----------

export function useCustomerGroups(enabled: boolean) {
  return useQuery({
    queryKey: ['customer-groups'],
    enabled,
    queryFn: async (): Promise<Named[]> => {
      const res = await http.get<{ data?: { id: number; name?: string | null; isActive?: boolean }[] }>('/customer-groups');
      return (res.data ?? [])
        .filter((g) => g.isActive !== false && g.name)
        .map((g) => ({ id: g.id, name: g.name ?? '' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    },
    staleTime: 5 * 60_000,
  });
}

/** Nhân viên để chọn Sale PIC. */
export function useStaff(enabled: boolean) {
  return useQuery({
    queryKey: ['users', 'for-filter'],
    enabled,
    queryFn: async (): Promise<Named[]> => {
      const res = await http.get<{ id: number; name?: string | null }[] | { data?: { id: number; name?: string | null }[] }>(
        '/users/for-filter',
      );
      const list = Array.isArray(res) ? res : (res.data ?? []);
      return list.filter((u) => u.name).map((u) => ({ id: u.id, name: u.name ?? '' }));
    },
    staleTime: 5 * 60_000,
  });
}

/** Mã Sale PIC hiện tại (nằm trong chính sách công nợ; tên lấy từ danh sách nhân viên). */
export async function fetchSalePicId(customerId: number): Promise<number | null> {
  const res = await http.get<{ policy?: { salePicId?: number | null } | null }>(`/debt-tracking/policy/${customerId}`);
  return res.policy?.salePicId ?? null;
}

export function useSalePicId(customerId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['customer-sale-pic', customerId],
    enabled: enabled && !!customerId,
    queryFn: () => fetchSalePicId(customerId ?? 0),
    staleTime: 60_000,
  });
}

export interface ParentOption {
  id: number;
  code: string;
  name: string;
  phone: string | null;
}

/** Khách có thể làm khách cha: đang hoạt động và chưa thuộc khách nào. */
export function useParentSearch(search: string, excludeId: number | null) {
  return useQuery({
    queryKey: ['customers', 'parent-search', search],
    queryFn: async () => {
      const res = await http.get<{ data: (RawCustomer & { parentId?: number | null })[] }>('/customers/search', {
        search: search || undefined,
      });
      return res.data;
    },
    select: (rows): ParentOption[] =>
      rows
        .filter((r) => !r.parentId && r.id !== excludeId)
        .map((r) => ({ id: r.id, code: r.code ?? '', name: r.name ?? '', phone: r.contactNumber || r.phone || null })),
    staleTime: 20_000,
  });
}

/** Tra mã số thuế (dịch vụ công khai VietQR, không cần khóa). */
export async function lookupTaxCode(taxCode: string): Promise<{ name: string; address: string } | null> {
  const res = await fetch(`https://api.vietqr.io/v2/business/${encodeURIComponent(taxCode.trim())}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { code?: string; data?: { name?: string; address?: string } };
  if (json.code !== '00' || !json.data?.name) return null;
  return { name: json.data.name, address: json.data.address ?? '' };
}

// ---------- Ghi ----------

export const createCustomer = (body: Record<string, unknown>) => http.post<RawCustomer>('/customers', body);

export const updateCustomer = (id: number, body: Record<string, unknown>) => http.put<RawCustomer>(`/customers/${id}`, body);

export const setCustomerActive = (id: number, isActive: boolean) => updateCustomer(id, { isActive });

export const saveCustomerNote = (id: number, comments: string) =>
  http.patch<{ id: number; comments: string | null }>(`/customers/${id}/comments`, { comments: comments.trim() });

// ---------- Thu nợ ----------

/** Hóa đơn còn nợ của khách (và các khách con), cũ trước. */
export function useUnpaidInvoices(customerIds: number[], enabled: boolean) {
  return useQuery({
    queryKey: ['customer-unpaid', customerIds],
    enabled: enabled && customerIds.length > 0,
    queryFn: async () => {
      const res = await http.get<{ data: RawInvoiceForDebt[] }>('/invoices', {
        customerIds,
        page: 1,
        // Lấy mới trước để không sót hóa đơn còn nợ gần đây (giống web: 1000).
        limit: 1000,
        orderBy: 'purchaseDate',
        orderDirection: 'desc',
      });
      return toUnpaidInvoices(res.data ?? []);
    },
    staleTime: 0,
  });
}

export interface CustomerPaymentBody {
  customerId: number;
  totalAmount: number;
  branchId: number;
  method: 'cash' | 'transfer';
  accountId?: number;
  transDate: string;
  description?: string;
  allocateToInvoices: boolean;
  invoices?: { invoiceId: number; amount: number }[];
  /** Cấn trừ nợ vào hóa đơn (không tạo phiếu thu nếu tiền thu = 0). */
  debtOffsets?: { invoiceId: number; amount: number }[];
}

export const createCustomerPayment = (body: CustomerPaymentBody) =>
  http.post<{ cashFlow?: { code?: string } }>('/cashflows/customer-payments', body);
