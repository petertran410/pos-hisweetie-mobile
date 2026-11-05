import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { http } from '@/core/http';
import { dayBoundsIso, isRange, type DateRange } from '@/core/period';
import type { Query } from '@/core/request';

// ---------- Kỳ thời gian (khớp backend `dashboard.service.ts`) ----------

/** `RangeKey` của backend: kỳ cho số liệu bán hàng (kết quả, biểu đồ, bán chạy, khách mua nhiều). */
export type DashPreset = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth';
export type DashRange = DashPreset | DateRange;

/** `PeriodKey` của backend: kỳ cho So sánh chi nhánh và Công nợ, COD. */
export type DashPeriod = 'today' | 'yesterday' | 'd7' | 'd30' | 'thisWeek' | 'thisMonth' | 'lastMonth';
export type BranchPeriod = DashPeriod | DateRange;
/** Công nợ, COD có thêm "Tất cả" (không lọc thời gian). */
export type FinancePeriod = DashPeriod | 'all' | DateRange;

export type TopMetric = 'rev' | 'qty' | 'profit';
export type BranchMetric = 'rev' | 'profit';
export type CategoryDimension = 'parent' | 'middle' | 'child';
export type TaskType = 'orders' | 'debt' | 'cod' | 'stock';

/** Chi nhánh xem số liệu: 1 chi nhánh hoặc gộp tất cả. */
export type DashBranch = number | 'all';

/** Khoảng tự chọn → `from`/`to` ISO (đầu ngày → cuối ngày giờ máy, giống web). */
function customDates(r: DateRange): { from: string; to: string } {
  const b = dayBoundsIso(r.from, r.to);
  return { from: b.fromIso, to: b.toIso };
}

/** Tham số kỳ bán hàng: khoảng tự chọn gửi `range=custom` kèm `from`/`to`. */
export function rangeParams(range: DashRange): { range: string; from?: string; to?: string } {
  return isRange(range) ? { range: 'custom', ...customDates(range) } : { range };
}

/** Tham số kỳ của So sánh chi nhánh / Công nợ: `period=…` (khoảng tự chọn: `period=custom`). */
export function periodParams(period: FinancePeriod): { period: string; from?: string; to?: string } {
  return isRange(period) ? { period: 'custom', ...customDates(period) } : { period };
}

/** 'all' → không gửi `branchId` (backend gộp mọi chi nhánh). */
export const branchParam = (branch: DashBranch): number | undefined => (branch === 'all' ? undefined : branch);

/** Lợi nhuận chỉ Admin xem được: người khác luôn xếp theo doanh thu. */
export function safeMetric<M extends TopMetric>(metric: M, canProfit: boolean): M | 'rev' {
  return metric === 'profit' && !canProfit ? 'rev' : metric;
}

// ---------- Tham số từng API (đúng tên query của controller) ----------

export const TOP_LIMIT = 10;
export const RECENT_LIMIT = 8;

export const statsQuery = (range: DashRange, branch: DashBranch): Query => ({ ...rangeParams(range), branchId: branchParam(branch) });

export const trendQuery = statsQuery;

export const categoryQuery = (range: DashRange, branch: DashBranch, dimension: CategoryDimension): Query => ({
  ...rangeParams(range),
  branchId: branchParam(branch),
  dimension,
});

export const topProductsQuery = (range: DashRange, branch: DashBranch, metric: TopMetric, canProfit: boolean): Query => ({
  ...rangeParams(range),
  branchId: branchParam(branch),
  metric: safeMetric(metric, canProfit),
  limit: TOP_LIMIT,
});

export const topBuyersQuery = (range: DashRange, branch: DashBranch): Query => ({
  ...rangeParams(range),
  branchId: branchParam(branch),
  limit: TOP_LIMIT,
});

/** So sánh chi nhánh luôn gồm mọi chi nhánh (backend không nhận `branchId`). */
export const branchCompareQuery = (period: BranchPeriod, metric: BranchMetric, canProfit: boolean): Query => ({
  ...periodParams(period),
  metric: safeMetric(metric, canProfit),
});

export const financeQuery = (period: FinancePeriod, branch: DashBranch): Query => ({
  ...periodParams(period),
  branchId: branchParam(branch),
});

export const tasksQuery = (type: TaskType, branch: DashBranch, status?: string): Query => ({
  type,
  branchId: branchParam(branch),
  limit: 200,
  status,
});

/** Thu chi sổ quỹ, doanh thu theo kênh bán, trả hàng: cùng kỳ và chi nhánh với số liệu bán hàng. */
export const cashflowQuery = statsQuery;
export const channelsQuery = statsQuery;
export const returnsQuery = statsQuery;

export const sellersQuery = (range: DashRange, branch: DashBranch): Query => ({
  ...rangeParams(range),
  branchId: branchParam(branch),
  limit: TOP_LIMIT,
});

/** Khung giờ bán: kỳ dài (mặc định 30 ngày) để đủ dữ liệu từng ô. */
export const heatmapQuery = (period: BranchPeriod, branch: DashBranch): Query => ({
  ...periodParams(period),
  branchId: branchParam(branch),
});

// ---------- Dữ liệu trả về ----------

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
  /** Tỷ lệ 0–1 (0,23 = 23%). */
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

export interface CategorySlice {
  name: string;
  revenue: number;
  percent: number;
}

export interface BranchSeries {
  id: number;
  name: string;
  data: number[];
  total: number;
}

export interface BranchComparison {
  labels: string[];
  branches: BranchSeries[];
}

export interface FinanceData {
  debt: number;
  overdue: number;
  unpaidCount: number;
  codAmount: number;
  codCount: number;
  aging: { inTerm: number; d1to30: number; over30: number };
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
  totalProfit: number;
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

export interface CashflowSummary {
  receipt: number;
  payment: number;
  net: number;
  count: number;
  series: { label: string; receipt: number; payment: number }[];
  /** 5 nhóm chi lớn nhất. */
  topPayments: { name: string; amount: number }[];
}

export interface SellerRow {
  /** null = hóa đơn chưa gán nhân viên bán. */
  id: number | null;
  name: string;
  revenue: number;
  invoiceCount: number;
}

export interface ChannelRow extends SellerRow {
  percent: number;
}

export interface HeatCell {
  /** 0 = Chủ nhật … 6 = Thứ Bảy. */
  dow: number;
  /** 0–23, giờ Việt Nam. */
  hour: number;
  revenue: number;
  count: number;
}

export interface ReturnsSummary {
  count: number;
  amount: number;
  revenue: number;
  /** % giá trị trả trên doanh thu. */
  rate: number;
  /** Phiếu yêu cầu trả đang chờ nhận hàng (không theo kỳ). */
  pendingCount: number;
  topProducts: { productId: number; code: string; name: string; quantity: number; amount: number }[];
}

// ---------- Hook ----------

/**
 * `enabled = false` khi không có quyền xem tổng quan (hoặc khối bị ẩn):
 * không gọi API của khối đó. Đổi bộ lọc thì giữ số cũ trong lúc tải để
 * số liệu chạy mượt sang số mới.
 */
const smooth = { placeholderData: keepPreviousData } as const;

export function useDashboardStats(range: DashRange, branch: DashBranch, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'stats', range, branch],
    enabled,
    ...smooth,
    queryFn: () => http.get<DashboardStats>('/dashboard/stats', statsQuery(range, branch)),
  });
}

export function useRevenueTrend(range: DashRange, branch: DashBranch, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'trend', range, branch],
    enabled,
    ...smooth,
    queryFn: () => http.get<TrendPoint[]>('/dashboard/revenue-trend', trendQuery(range, branch)),
  });
}

export function useCategoryBreakdown(range: DashRange, branch: DashBranch, dimension: CategoryDimension, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'category', range, branch, dimension],
    enabled,
    ...smooth,
    queryFn: () => http.get<CategorySlice[]>('/dashboard/category-breakdown', categoryQuery(range, branch, dimension)),
  });
}

export function useTopProducts(range: DashRange, branch: DashBranch, metric: TopMetric, canProfit: boolean, enabled: boolean) {
  const m = safeMetric(metric, canProfit);
  return useQuery({
    queryKey: ['dashboard', 'top-products', range, branch, m],
    enabled,
    ...smooth,
    queryFn: () => http.get<TopProduct[]>('/dashboard/top-products', topProductsQuery(range, branch, m, canProfit)),
  });
}

export function useTopBuyers(range: DashRange, branch: DashBranch, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'top-buyers', range, branch],
    enabled,
    ...smooth,
    queryFn: () => http.get<TopBuyer[]>('/dashboard/top-buyers', topBuyersQuery(range, branch)),
  });
}

export function useBranchComparison(period: BranchPeriod, metric: BranchMetric, canProfit: boolean, enabled: boolean) {
  const m = safeMetric(metric, canProfit);
  return useQuery({
    queryKey: ['dashboard', 'branch-compare', period, m],
    enabled,
    ...smooth,
    queryFn: () => http.get<BranchComparison>('/dashboard/branch-comparison', branchCompareQuery(period, m, canProfit)),
  });
}

export function useFinance(period: FinancePeriod, branch: DashBranch, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'finance', period, branch],
    enabled,
    ...smooth,
    queryFn: () => http.get<FinanceData>('/dashboard/finance', financeQuery(period, branch)),
  });
}

export function useTaskCounts(branch: DashBranch, enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'task-counts', branch],
    enabled,
    queryFn: () => http.get<Record<TaskType, number>>('/dashboard/task-counts', { branchId: branchParam(branch) }),
  });
}

export function useTasks(type: TaskType, branch: DashBranch, status?: string) {
  return useQuery({
    queryKey: ['dashboard', 'tasks', type, status, branch],
    queryFn: () => http.get<TaskRow[]>('/dashboard/tasks', tasksQuery(type, branch, status)),
  });
}

export function useRecentOrders(enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'recent'],
    enabled,
    queryFn: () => http.get<RecentOrder[]>('/dashboard/recent-activities', { limit: RECENT_LIMIT }),
  });
}

export function useCashflow(range: DashRange, branch: DashBranch, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'cashflow', range, branch],
    enabled,
    ...smooth,
    queryFn: () => http.get<CashflowSummary>('/dashboard/cashflow', cashflowQuery(range, branch)),
  });
}

export function useSellers(range: DashRange, branch: DashBranch, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'sellers', range, branch],
    enabled,
    ...smooth,
    queryFn: () => http.get<SellerRow[]>('/dashboard/sellers', sellersQuery(range, branch)),
  });
}

export function useSaleChannels(range: DashRange, branch: DashBranch, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'channels', range, branch],
    enabled,
    ...smooth,
    queryFn: () => http.get<ChannelRow[]>('/dashboard/sale-channels', channelsQuery(range, branch)),
  });
}

export function useSalesHeatmap(period: BranchPeriod, branch: DashBranch, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'heatmap', period, branch],
    enabled,
    ...smooth,
    queryFn: () => http.get<{ cells: HeatCell[] }>('/dashboard/sales-heatmap', heatmapQuery(period, branch)),
  });
}

export function useReturns(range: DashRange, branch: DashBranch, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'returns', range, branch],
    enabled,
    ...smooth,
    queryFn: () => http.get<ReturnsSummary>('/dashboard/returns', returnsQuery(range, branch)),
  });
}
