import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { http } from '@/core/http';
import { dayBoundsIso, isRange, type DateRange } from '@/core/period';
import { useSession } from '@/core/session';

/** Kỳ có sẵn của Tổng quan (khớp `RangeKey` của backend) hoặc khoảng ngày tự chọn. */
export type DashPreset = 'today' | 'yesterday' | 'week' | 'month';
export type DashRange = DashPreset | DateRange;

/** Tham số kỳ cho API: khoảng tự chọn gửi `range=custom` kèm `from`/`to` (ISO). */
export function rangeParams(range: DashRange): { range: string; from?: string; to?: string } {
  if (!isRange(range)) return { range };
  const b = dayBoundsIso(range.from, range.to);
  return { range: 'custom', from: b.fromIso, to: b.toIso };
}
export type TaskType = 'orders' | 'debt' | 'cod' | 'stock';

export interface DashboardStats {
  currentRevenue: number;
  lastRevenue: number;
  revenueChange: number;
  invoiceCount: number;
  invoiceChange: number;
  aov: number;
  aovChange: number;
  profit: number;
  profitChange: number;
  marginAvg: number;
  totalCustomerDebt: number;
  totalSupplierDebt: number;
  unpaidInvoices: number;
  unpaidAmount: number;
  codAmount: number;
  codCount: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  negativeStock: number;
}

export interface TrendPoint {
  label: string;
  revenue: number;
  profit: number;
}

export interface TaskRow {
  code: string;
  partner: string;
  branchName?: string;
  value: number;
  time?: string;
  status: string;
  ageDays?: number;
  usingCod?: boolean;
  minQuality?: number;
  unit?: string;
}

export interface TopProduct {
  productId: number;
  code: string;
  name: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface TopBuyer {
  id: number;
  code: string;
  name: string;
  totalRevenue: number;
  invoiceCount: number;
}

export interface RecentOrder {
  id: number;
  code: string;
  customerName: string;
  grandTotal: number;
  createdAt: string;
}

/** Số liệu tổng quan theo chi nhánh đang chọn. */
const useBranch = () => useSession((s) => s.branchId ?? undefined);

export function useDashboardStats(range: DashRange) {
  const branchId = useBranch();
  return useQuery({
    queryKey: ['dashboard', 'stats', range, branchId],
    // Đổi kỳ: giữ số cũ trong lúc tải để số liệu chạy mượt sang số mới.
    placeholderData: keepPreviousData,
    queryFn: () => http.get<DashboardStats>('/dashboard/stats', { ...rangeParams(range), branchId }),
  });
}

export function useRevenueTrend(range: DashRange) {
  const branchId = useBranch();
  return useQuery({
    queryKey: ['dashboard', 'trend', range, branchId],
    // Đổi kỳ: giữ số cũ trong lúc tải để số liệu chạy mượt sang số mới.
    placeholderData: keepPreviousData,
    queryFn: () => http.get<TrendPoint[]>('/dashboard/revenue-trend', { ...rangeParams(range), branchId }),
  });
}

export function useTaskCounts() {
  const branchId = useBranch();
  return useQuery({
    queryKey: ['dashboard', 'task-counts', branchId],
    queryFn: () =>
      http.get<Record<TaskType, number>>('/dashboard/task-counts', { branchId }),
  });
}

export function useTasks(type: TaskType, status?: string) {
  const branchId = useBranch();
  return useQuery({
    queryKey: ['dashboard', 'tasks', type, status, branchId],
    queryFn: () =>
      http.get<TaskRow[]>('/dashboard/tasks', { type, branchId, limit: 200, status }),
  });
}

export function useTopProducts(range: DashRange) {
  const branchId = useBranch();
  return useQuery({
    queryKey: ['dashboard', 'top-products', range, branchId],
    // Đổi kỳ: giữ số cũ trong lúc tải để số liệu chạy mượt sang số mới.
    placeholderData: keepPreviousData,
    queryFn: () =>
      http.get<TopProduct[]>('/dashboard/top-products', { ...rangeParams(range), branchId, limit: 5, metric: 'rev' }),
  });
}

export function useTopBuyers(range: DashRange) {
  const branchId = useBranch();
  return useQuery({
    queryKey: ['dashboard', 'top-buyers', range, branchId],
    // Đổi kỳ: giữ số cũ trong lúc tải để số liệu chạy mượt sang số mới.
    placeholderData: keepPreviousData,
    queryFn: () => http.get<TopBuyer[]>('/dashboard/top-buyers', { ...rangeParams(range), branchId, limit: 5 }),
  });
}

export function useRecentOrders() {
  return useQuery({
    queryKey: ['dashboard', 'recent'],
    queryFn: () => http.get<RecentOrder[]>('/dashboard/recent-activities', { limit: 8 }),
  });
}
