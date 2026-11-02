import { router } from 'expo-router';
import { useState } from 'react';
import { useCan } from '@/core/permissions';
import { currentBranch, useSession } from '@/core/session';
import { usePullRefresh } from '@/core/usePullRefresh';
import { EmptyState, Page, toast } from '@/ui';
import {
  useDashboardStats,
  useRecentOrders,
  useRevenueTrend,
  useTaskCounts,
  useTopBuyers,
  useTopProducts,
  type DashRange,
} from './api';
import { DashboardView } from './DashboardView';

export default function DashboardScreen() {
  const allowed = useCan('dashboard', 'view');
  const user = useSession((s) => s.user);
  useSession((s) => s.branchId);
  const [range, setRange] = useState<DashRange>('today');
  const stats = useDashboardStats(range);
  const trend = useRevenueTrend(range);
  const counts = useTaskCounts();
  const products = useTopProducts(range);
  const buyers = useTopBuyers(range);
  const recent = useRecentOrders();
  const pull = usePullRefresh(() =>
    Promise.all([stats.refetch(), trend.refetch(), counts.refetch(), products.refetch(), buyers.refetch(), recent.refetch()]),
  );

  if (!allowed) {
    return (
      <Page scroll={false}>
        <EmptyState
          icon="lock"
          color="slate"
          title="Chưa có quyền xem tổng quan"
          message="Nhờ quản trị viên cấp quyền “Xem tổng quan” nếu bạn cần số liệu doanh thu."
        />
      </Page>
    );
  }

  return (
    <DashboardView
      user={user}
      branchName={currentBranch()?.name}
      range={range}
      onRangeChange={setRange}
      data={{
        loading: stats.isLoading,
        stats: stats.data,
        statsError: stats.isError ? stats.error : undefined,
        trend: trend.data,
        counts: counts.data,
        products: products.data,
        buyers: buyers.data,
        recent: recent.data,
      }}
      refreshing={pull.refreshing}
      onRefresh={pull.onRefresh}
      onRetry={() => void stats.refetch()}
      onOpenBranch={() => router.push('/chi-nhanh')}
      onOpenAccount={() => router.navigate('/them')}
      onOpenTask={(type) => router.push({ pathname: '/tong-quan/viec/[type]', params: { type } })}
      onShortcut={(key, href) => {
        if (href) router.navigate(href as never);
        else toast.info('Chức năng này sẽ có ở bản cập nhật tới');
      }}
    />
  );
}
