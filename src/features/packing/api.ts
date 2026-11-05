import { keepPreviousData, useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query';
import { api, http, type Query } from '@/core/http';
import { isoDate } from '@/core/format';
import { resolvePeriod, type PeriodChoice } from '@/core/period';
import { useSession } from '@/core/session';
import {
  PACK_PAGE_SIZE,
  PACK_TYPES,
  packListQuery,
  toCandidate,
  toPackDetail,
  toPackRow,
  toWaiting,
  type DocItem,
  type DocMode,
  type PackFilters,
  type PackRow,
  type PackType,
  type RawDocCandidate,
  type RawPacking,
  type RawWaiting,
} from './model';

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Làm mới danh sách báo đơn, chi tiết phiếu và hóa đơn liên quan (trạng thái hóa đơn đổi theo phiếu). */
export function refreshAfterPacking(qc: QueryClient) {
  return Promise.all(
    [['packings'], ['packing'], ['delivery-overview'], ['doc'], ['docs'], ['dashboard']].map((queryKey) => qc.invalidateQueries({ queryKey })),
  );
}

// ---------- Danh sách ----------

export function usePackingList(filters: PackFilters, enabled: boolean) {
  const branchId = useSession((s) => s.branchId);
  return useInfiniteQuery({
    queryKey: ['packings', branchId, filters],
    enabled,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }) => {
      const res = await http.get<{ data?: RawPacking[]; total?: number }>('/all-packing', packListQuery(filters, branchId, pageParam));
      return {
        page: pageParam,
        total: num(res.total),
        rows: (res.data ?? []).map(toPackRow).filter((r): r is PackRow => !!r),
      };
    },
    getNextPageParam: (last) => (last.page * PACK_PAGE_SIZE < last.total ? last.page + 1 : undefined),
  });
}

// ---------- Chi tiết ----------

export function usePackingDetail(type: PackType | null, id: number, enabled = true) {
  return useQuery({
    queryKey: ['packing', type, id],
    enabled: enabled && !!type && id > 0,
    queryFn: async () => toPackDetail(type as PackType, await http.get<RawPacking>(`${PACK_TYPES[type as PackType].path}/${id}`)),
  });
}

export const fetchPackingDetail = async (type: PackType, id: number) =>
  toPackDetail(type, await http.get<RawPacking>(`${PACK_TYPES[type].path}/${id}`));

// ---------- Ghi ----------

/** Kiểm quyền theo chi nhánh của phiếu (có thể khác chi nhánh đang chọn). */
const bodyBranch = (body: Record<string, unknown>) => Number(body.branchId) || undefined;

export const createPacking = (type: PackType, body: Record<string, unknown>) =>
  api<{ id?: number; code?: string }>(PACK_TYPES[type].path, { method: 'POST', body, branchId: bodyBranch(body) });

export const updatePacking = (type: PackType, id: number, body: Record<string, unknown>) =>
  api<{ id?: number; code?: string; financeLocked?: { code?: string; reason?: string }[] }>(`${PACK_TYPES[type].path}/${id}`, {
    method: 'PUT',
    body,
    branchId: bodyBranch(body),
  });

/** Trước khi hủy phiếu giao hàng: có phiếu thu tiền mặt đi kèm hay đang bị khóa không. */
export const packingCancelCheck = (id: number) =>
  http.get<{ receiptCashFlowCount?: number; blockedReason?: string | null }>(`/packing-slips/${id}/cancel-check`);

export function cancelPacking(type: PackType, id: number, cancelCashFlows?: boolean) {
  const q = type === 'giao-hang' && cancelCashFlows !== undefined ? `?cancelCashFlows=${cancelCashFlows ? 'true' : 'false'}` : '';
  return http.delete<unknown>(`${PACK_TYPES[type].path}/${id}${q}`);
}

export const resendZalo = (id: number) => http.post<unknown>(`/packing-slips/${id}/resend-notification`);
export const resendLark = (id: number) => http.post<unknown>(`/packing-loadings/${id}/resend-lark`);

// ---------- Chọn chứng từ ----------

/** Hóa đơn / phiếu ký gửi để gắn vào phiếu (tìm theo mã hoặc tên khách). */
export function useDocCandidates(type: PackType, mode: DocMode, branchId: number | null, search: string, enabled: boolean) {
  return useQuery({
    queryKey: ['packing-candidates', type, mode, branchId, search],
    enabled: enabled && !!branchId,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<DocItem[]> => {
      const q: Query = { branchId: branchId ?? undefined, pageSize: 100, search: search || undefined };
      if (mode === 'consignment') {
        const res = await api<{ data?: RawDocCandidate[] }>('/consignments/for-packing', { query: q, branchId });
        return (res.data ?? []).map((r) => toCandidate(r, 'consignment'));
      }
      // Đóng hàng / loading không nhận hóa đơn đã giao.
      // Chi nhánh trong X-Branch-Id = chi nhánh của phiếu: backend kiểm quyền đúng chi nhánh.
      const res = await api<{ data?: RawDocCandidate[] }>('/invoices/for-packing', {
        query: { ...q, packingType: type, excludeDelivered: type === 'giao-hang' ? undefined : 'true' },
        branchId,
      });
      return (res.data ?? []).map((r) => toCandidate(r, 'invoice'));
    },
  });
}

/** Đọc mã QR in trên hóa đơn / phiếu ký gửi (mã có chữ ký, backend tự kiểm tra). */
export async function resolveScannedDoc(payload: string, type: PackType): Promise<DocItem> {
  const r = await http.post<RawDocCandidate & { kind?: string }>('/invoices/scan-resolve', { payload, packingType: PACK_TYPES[type].scanType });
  return toCandidate(r, r.kind === 'consignment' ? 'consignment' : 'invoice');
}

// ---------- Chờ giao ----------

export function useDeliveryOverview(period: PeriodChoice, search: string, enabled: boolean) {
  const branchId = useSession((s) => s.branchId);
  return useInfiniteQuery({
    queryKey: ['delivery-overview', branchId, period, search],
    enabled,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }) => {
      const range = resolvePeriod(period) ?? { from: isoDate(new Date()), to: isoDate(new Date()) };
      const res = await http.get<{ stats?: { total?: number; delivered?: number; pending?: number }; data?: RawWaiting[]; total?: number }>(
        '/invoices/delivery-overview',
        {
          branchId: branchId ?? undefined,
          fromDate: range.from,
          toDate: range.to,
          search: search || undefined,
          pageSize: PACK_PAGE_SIZE,
          currentItem: (pageParam - 1) * PACK_PAGE_SIZE,
        },
      );
      return {
        page: pageParam,
        total: num(res.total),
        stats: { total: num(res.stats?.total), delivered: num(res.stats?.delivered), pending: num(res.stats?.pending) },
        rows: (res.data ?? []).map(toWaiting),
      };
    },
    getNextPageParam: (last) => (last.page * PACK_PAGE_SIZE < last.total ? last.page + 1 : undefined),
  });
}
