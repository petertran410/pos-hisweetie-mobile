import { useQuery } from '@tanstack/react-query';
import { http } from '@/core/http';
import {
  buildKhoPayload,
  toFinanceAccess,
  toVehicle,
  type KhoCustomer,
  type KhoForm,
  type RawFinanceAccess,
  type RawKhoEntry,
  type RawVehicle,
} from './model';

/** Quyền tài chính của tài khoản tại từng kho / văn phòng (giống `useFinanceAccess` của web). */
export function useFinanceAccess(enabled = true) {
  return useQuery({
    queryKey: ['internal-finance', 'access'],
    enabled,
    queryFn: async () => toFinanceAccess(await http.get<RawFinanceAccess>('/internal-finance/access')),
    staleTime: 60_000,
  });
}

/** Xe đang dùng của 1 kho (phiếu xăng dầu, chăm sóc xe). */
export function useKhoVehicles(branchId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['vehicles', { branchId }],
    enabled: enabled && !!branchId,
    queryFn: async () => {
      const res = await http.get<RawVehicle[] | { data?: RawVehicle[] }>('/vehicles', { branchId: branchId ?? undefined });
      const list = Array.isArray(res) ? res : (res.data ?? []);
      return list.filter((v) => v.isActive !== false).map(toVehicle);
    },
    staleTime: 5 * 60_000,
  });
}

/** Tìm khách hàng cho phiếu tiền mặt (giống ô tìm khách của web). */
export function useKhoCustomerSearch(term: string) {
  return useQuery({
    queryKey: ['customers-search', term],
    enabled: term.length > 0,
    queryFn: async (): Promise<KhoCustomer[]> => {
      const res = await http.get<{ data?: { id: number; name?: string | null; code?: string | null }[] }>('/customers/search', { search: term });
      return (res.data ?? []).map((c) => ({ id: c.id, name: c.name || `Khách #${c.id}`, code: c.code ?? null }));
    },
    staleTime: 30_000,
  });
}

/** Tạo phiếu kho (tiền mặt / chi khác / xăng dầu / chăm sóc xe). */
export function createKho(form: KhoForm): Promise<RawKhoEntry> {
  const { path, body } = buildKhoPayload(form);
  return http.post<RawKhoEntry>(path, body);
}
