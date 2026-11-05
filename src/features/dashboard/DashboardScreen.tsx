import { router } from 'expo-router';
import { useState } from 'react';
import { queryClient } from '@/core/query';
import { useSession } from '@/core/session';
import { usePullRefresh } from '@/core/usePullRefresh';
import {
  useBranchComparison,
  useCashflow,
  useCategoryBreakdown,
  useDashboardStats,
  useFinance,
  useRecentOrders,
  useReturns,
  useRevenueTrend,
  useSaleChannels,
  useSalesHeatmap,
  useSellers,
  useTaskCounts,
  useTopBuyers,
  useTopProducts,
  type DashBranch,
} from './api';
import { DashboardView, type Block, type DashBlock, type DashboardData } from './DashboardView';
import { dashboardPerms, DEFAULT_DASH_FILTERS, type DashFilters } from './model';

/** Kết quả react-query → khối số liệu cho màn hiển thị. */
function block<T>(q: { data?: T; isLoading: boolean; isError: boolean; error: unknown }): Block<T> {
  return { data: q.data, loading: q.isLoading, error: q.isError ? q.error : undefined };
}

/**
 * Chi nhánh xem số liệu: mặc định là chi nhánh đang làm việc (phiên đăng
 * nhập); chọn khác trên Tổng quan chỉ đổi số liệu, không đổi chi nhánh làm
 * việc. Đổi chi nhánh làm việc (màn Thêm) thì Tổng quan theo về chi nhánh đó.
 */
function useDashBranch(): [DashBranch, (b: DashBranch) => void] {
  const sessionBranch = useSession((s) => s.branchId);
  const [pick, setPick] = useState<{ base: number | null; value: DashBranch } | null>(null);
  const branch: DashBranch = pick && pick.base === sessionBranch ? pick.value : (sessionBranch ?? 'all');
  return [branch, (value) => setPick({ base: sessionBranch, value })];
}

export default function DashboardScreen() {
  const user = useSession((s) => s.user);
  const branches = useSession((s) => s.branches);
  const perms = dashboardPerms(user);
  const [branch, setBranch] = useDashBranch();
  const [filters, setFilters] = useState<DashFilters>(DEFAULT_DASH_FILTERS);
  const on = perms.view;

  const stats = useDashboardStats(filters.range, branch, on);
  const trend = useRevenueTrend(filters.range, branch, on);
  const category = useCategoryBreakdown(filters.range, branch, filters.catDim, on);
  const products = useTopProducts(filters.topRange, branch, filters.topMetric, perms.profit, on);
  const buyers = useTopBuyers(filters.buyerRange, branch, on);
  const branchCmp = useBranchComparison(filters.branchPeriod, filters.branchMetric, perms.profit, on);
  const finance = useFinance(filters.finPeriod, branch, on);
  const counts = useTaskCounts(branch, on);
  const recent = useRecentOrders(on);
  // Báo cáo thêm: chỉ gọi khi có quyền của báo cáo đó (khối bị ẩn thì không gọi).
  const cashflow = useCashflow(filters.range, branch, perms.cashflow);
  const sellers = useSellers(filters.range, branch, perms.sellers);
  const channels = useSaleChannels(filters.range, branch, on);
  const heatmap = useSalesHeatmap(filters.heatPeriod, branch, perms.heatmap);
  const returns = useReturns(filters.range, branch, perms.returns);

  const queries = {
    stats,
    trend,
    category,
    products,
    buyers,
    branchCmp,
    finance,
    counts,
    recent,
    cashflow,
    sellers,
    channels,
    heatmap,
    returns,
  };
  const data: DashboardData = {
    stats: block(stats),
    trend: block(trend),
    category: block(category),
    products: block(products),
    buyers: block(buyers),
    branchCmp: block(branchCmp),
    finance: block(finance),
    counts: block(counts),
    recent: block(recent),
    cashflow: block(cashflow),
    sellers: block(sellers),
    channels: block(channels),
    heatmap: block(heatmap),
    returns: block(returns),
  };

  // Kéo để làm mới: tải lại các khối đang hiện (khối bị ẩn không chạy).
  const pull = usePullRefresh(() => queryClient.refetchQueries({ queryKey: ['dashboard'], type: 'active' }));

  return (
    <DashboardView
      user={user}
      branches={branches}
      branch={branch}
      onBranchChange={setBranch}
      filters={filters}
      onFilters={(patch) => setFilters((cur) => ({ ...cur, ...patch }))}
      data={data}
      refreshing={pull.refreshing}
      onRefresh={pull.onRefresh}
      onRetry={(key: DashBlock) => void queries[key].refetch()}
      onOpenAccount={() => router.navigate('/them')}
      onOpenTask={(type) =>
        router.push({ pathname: '/tong-quan/viec/[type]', params: { type, branch: String(branch) } })
      }
    />
  );
}
