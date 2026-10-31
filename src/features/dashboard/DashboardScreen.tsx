import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { money, qty, timeVN, dayLabel, vnd } from '@/core/format';
import { useCan } from '@/core/permissions';
import { currentBranch, useSession } from '@/core/session';
import {
  C,
  EmptyState,
  ErrorState,
  Icon,
  Row,
  Screen,
  Section,
  Segmented,
  Txt,
} from '@/ui';
import {
  useDashboardStats,
  useRecentOrders,
  useRevenueTrend,
  useTaskCounts,
  useTopBuyers,
  useTopProducts,
  type DashRange,
} from './api';
import { KpiTile, RevenueHero } from './components';
import { RANGE_OPTIONS, TASKS, TASK_ORDER } from './model';

function BranchButton() {
  useSession((s) => s.branchId);
  const branch = currentBranch();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Chi nhánh ${branch?.name ?? ''}, đổi chi nhánh`}
      onPress={() => router.push('/chi-nhanh')}
      style={({ pressed }) => [styles.branch, pressed ? { opacity: 0.6 } : null]}>
      <Icon name="building.2" size={15} />
      <Txt variant="subhead" color={C.tint} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
        {branch?.name ?? 'Chọn chi nhánh'}
      </Txt>
      <Icon name="chevron.down" size={11} weight="semibold" />
    </Pressable>
  );
}

export default function DashboardScreen() {
  const allowed = useCan('dashboard', 'view');
  const [range, setRange] = useState<DashRange>('today');
  const stats = useDashboardStats(range);
  const trend = useRevenueTrend(range);
  const counts = useTaskCounts();
  const products = useTopProducts(range);
  const buyers = useTopBuyers(range);
  const recent = useRecentOrders();

  if (!allowed) {
    return (
      <EmptyState
        icon="lock"
        title="Chưa có quyền xem tổng quan"
        message="Nhờ quản trị viên cấp quyền “Xem tổng quan” nếu bạn cần số liệu doanh thu."
      />
    );
  }

  const refreshing = stats.isRefetching || trend.isRefetching || counts.isRefetching;
  const refresh = () => {
    void stats.refetch();
    void trend.refetch();
    void counts.refetch();
    void products.refetch();
    void buyers.refetch();
    void recent.refetch();
  };
  const s = stats.data;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.top}>
        <BranchButton />
        <Segmented options={[...RANGE_OPTIONS]} value={range} onChange={setRange} />
      </View>

      {stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <>
          <View style={styles.block}>
            <RevenueHero
              revenue={s?.currentRevenue}
              change={s?.revenueChange}
              trend={trend.data}
              loading={stats.isLoading}
            />
            <View style={styles.grid}>
              <KpiTile label="Hóa đơn" value={s ? money(s.invoiceCount) : '—'} change={s?.invoiceChange} />
              <KpiTile label="Trung bình mỗi hóa đơn" value={s ? money(s.aov) : '—'} change={s?.aovChange} />
            </View>
            <View style={styles.grid}>
              <KpiTile label="Lợi nhuận" value={s ? money(s.profit) : '—'} change={s?.profitChange} />
              <KpiTile
                label="Biên lợi nhuận"
                value={s ? `${String(Math.round(s.marginAvg * 10) / 10).replace('.', ',')}%` : '—'}
              />
            </View>
          </View>

          <Section title="Cần xử lý" separatorInset={57}>
            {TASK_ORDER.map((type) => {
              const n = counts.data?.[type];
              return (
                <Row
                  key={type}
                  icon={TASKS[type].icon}
                  iconBackground={type === 'stock' ? C.warning : C.tint}
                  title={TASKS[type].title}
                  value={n === undefined ? '' : money(n)}
                  valueColor={n ? C.label : C.secondary}
                  chevron
                  onPress={() => router.push({ pathname: '/tong-quan/viec/[type]', params: { type } })}
                />
              );
            })}
          </Section>

          <Section title="Công nợ và thu hộ">
            <Row title="Khách đang nợ" value={s ? vnd(s.totalCustomerDebt) : ''} valueColor={C.warning} />
            <Row
              title="Hóa đơn chưa thu đủ"
              subtitle={s ? `${money(s.unpaidInvoices)} hóa đơn` : undefined}
              value={s ? vnd(s.unpaidAmount) : ''}
            />
            <Row
              title="Tiền COD chưa thu"
              subtitle={s ? `${money(s.codCount)} đơn` : undefined}
              value={s ? vnd(s.codAmount) : ''}
            />
            <Row title="Phải trả nhà cung cấp" value={s ? vnd(s.totalSupplierDebt) : ''} />
          </Section>

          {products.data && products.data.length > 0 ? (
            <Section title="Bán chạy">
              {products.data.map((p, i) => (
                <Row
                  key={p.productId}
                  title={`${i + 1}. ${p.name}`}
                  subtitle={`${p.code}, đã bán ${qty(p.totalQuantity)}`}
                  value={money(p.totalRevenue)}
                  valueColor={C.label}
                />
              ))}
            </Section>
          ) : null}

          {buyers.data && buyers.data.length > 0 ? (
            <Section title="Khách mua nhiều">
              {buyers.data.map((b, i) => (
                <Row
                  key={b.id}
                  title={`${i + 1}. ${b.name}`}
                  subtitle={`${money(b.invoiceCount)} hóa đơn`}
                  value={money(b.totalRevenue)}
                  valueColor={C.label}
                />
              ))}
            </Section>
          ) : null}

          {recent.data && recent.data.length > 0 ? (
            <Section title="Đơn đặt mới">
              {recent.data.map((o) => (
                <Row
                  key={o.id}
                  title={o.customerName}
                  subtitle={`${o.code}, ${dayLabel(o.createdAt)} lúc ${timeVN(o.createdAt)}`}
                  value={money(o.grandTotal)}
                  valueColor={C.label}
                />
              ))}
            </Section>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  branch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    maxWidth: '100%',
  },
  block: { marginTop: 16, marginHorizontal: 16, gap: 10 },
  grid: { flexDirection: 'row', gap: 10 },
});
