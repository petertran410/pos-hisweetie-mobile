import { StyleSheet, View } from 'react-native';
import { money, shortWhen } from '@/core/format';
import type { PermissionHolder } from '@/core/can';
import {
  C,
  Card,
  Divider,
  ErrorState,
  Grid2,
  HomeHeader,
  IconBadge,
  Page,
  PeriodField,
  periodText,
  Section,
  Select,
  StatCard,
  Txt,
} from '@/ui';
import {
  safeMetric,
  type BranchComparison,
  type CashflowSummary,
  type CategorySlice,
  type ChannelRow,
  type DashBranch,
  type DashboardStats,
  type FinanceData,
  type HeatCell,
  type RecentOrder,
  type ReturnsSummary,
  type SellerRow,
  type TaskType,
  type TopBuyer,
  type TopProduct,
  type TrendPoint,
} from './api';
import { Heatmap } from './charts';
import {
  BarList,
  BlockBody,
  CashflowBlock,
  CategoryBreakdown,
  FilterRow,
  FinanceBlock,
  ReturnsBlock,
  RevenueCard,
} from './components';
import {
  BRANCH_METRIC_OPTIONS,
  branchBars,
  branchOptions,
  buyerRows,
  CATEGORY_OPTIONS,
  categoryParts,
  channelParts,
  CHART,
  dashboardPerms,
  dashRangeDates,
  deltaTone,
  FINANCE_OPTIONS,
  formatDelta,
  greetingFor,
  HEAT_OPTIONS,
  heatGrid,
  marginText,
  PERIOD_OPTIONS,
  periodDates,
  productRows,
  RANGE_OPTIONS,
  sellerRows,
  shortName,
  TASK_ORDER,
  TASKS,
  topMetricOptions,
  trendCaption,
  type DashFilters,
} from './model';

/** Kết quả một truy vấn: số liệu, đang tải lần đầu, lỗi. */
export interface Block<T> {
  data?: T;
  loading?: boolean;
  error?: unknown;
}

export interface DashboardData {
  stats: Block<DashboardStats>;
  trend: Block<TrendPoint[]>;
  category: Block<CategorySlice[]>;
  products: Block<TopProduct[]>;
  buyers: Block<TopBuyer[]>;
  branchCmp: Block<BranchComparison>;
  finance: Block<FinanceData>;
  counts: Block<Partial<Record<TaskType, number>>>;
  recent: Block<RecentOrder[]>;
  cashflow: Block<CashflowSummary>;
  sellers: Block<SellerRow[]>;
  channels: Block<ChannelRow[]>;
  heatmap: Block<{ cells: HeatCell[] }>;
  returns: Block<ReturnsSummary>;
}

export type DashBlock = keyof DashboardData;

export interface DashboardViewProps {
  user: (PermissionHolder & { name?: string | null }) | null;
  /** Chi nhánh của tài khoản (từ phiên đăng nhập). */
  branches: { id: number; name: string }[];
  branch: DashBranch;
  onBranchChange: (branch: DashBranch) => void;
  filters: DashFilters;
  onFilters: (patch: Partial<DashFilters>) => void;
  data: DashboardData;
  refreshing?: boolean;
  onRefresh?: () => void;
  onRetry?: (block: DashBlock) => void;
  onOpenAccount: () => void;
  onOpenTask: (type: TaskType) => void;
  now?: Date;
}

/**
 * Màn Tổng quan (chỉ hiển thị; dữ liệu truyền vào từ DashboardScreen).
 * Các khối giống trang chủ web: doanh thu + biểu đồ, chỉ số chính, việc cần
 * xử lý, cơ cấu nhóm hàng, bán chạy, khách mua nhiều, so sánh chi nhánh,
 * công nợ và COD, đơn mới. Lợi nhuận chỉ Admin thấy.
 */
export function DashboardView({
  user,
  branches,
  branch,
  onBranchChange,
  filters: f,
  onFilters,
  data,
  refreshing,
  onRefresh,
  onRetry,
  onOpenAccount,
  onOpenTask,
  now = new Date(),
}: DashboardViewProps) {
  const perms = dashboardPerms(user);
  const s = data.stats.data;
  const retry = (block: DashBlock) => (onRetry ? () => onRetry(block) : undefined);
  const periodLabel = periodText(RANGE_OPTIONS, f.range, now);
  const header = (
    <HomeHeader
      greeting={`Xin chào, ${shortName(user?.name) || 'bạn'}`}
      title={greetingFor(now)}
      userName={user?.name}
      onAvatarPress={onOpenAccount}
    />
  );

  // Không có quyền xem số liệu: không gọi API số liệu nào.
  if (!perms.view) {
    return (
      <Page header={header}>
        <Card style={styles.locked}>
          <IconBadge name="lock" color="slate" size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="body" weight="semibold">
              Chưa có quyền xem số liệu
            </Txt>
            <Txt variant="caption" color={C.muted}>
              Nhờ quản trị viên cấp quyền “Xem tổng quan” nếu bạn cần số liệu doanh thu.
            </Txt>
          </View>
        </Card>
      </Page>
    );
  }

  const topMetric = safeMetric(f.topMetric, perms.profit);
  const branchMetric = safeMetric(f.branchMetric, perms.profit);
  const parts = categoryParts(data.category.data);
  const products = productRows(data.products.data, topMetric);
  const buyers = buyerRows(data.buyers.data);
  const bars = branchBars(data.branchCmp.data);
  const channels = channelParts(data.channels.data);
  const sellers = sellerRows(data.sellers.data);
  const grid = heatGrid(data.heatmap.data?.cells);
  const rangeNote = periodLabel.toLowerCase();

  return (
    <Page header={header} refreshing={refreshing} onRefresh={onRefresh}>
      {/* Bộ lọc chung: chi nhánh + thời gian (áp cho doanh thu, chỉ số, nhóm hàng, việc cần xử lý, công nợ). */}
      <Card style={styles.filters}>
        <Select
          label="Chi nhánh"
          options={branchOptions(branches)}
          value={branch}
          onChange={(v) => onBranchChange(v ?? 'all')}
        />
        <Divider />
        <PeriodField
          label="Thời gian"
          options={RANGE_OPTIONS}
          value={f.range}
          initialRange={dashRangeDates(f.range, now)}
          onChange={(range) => onFilters({ range })}
        />
      </Card>

      {/* Mỗi khối báo cáo thêm chỉ hiện (và chỉ gọi API) khi có quyền của báo cáo đó. */}
      {data.stats.error ? (
        <ErrorState error={data.stats.error} onRetry={retry('stats')} />
      ) : (
        <Section index={0} title="Kết quả bán hàng">
          <RevenueCard
            revenue={s?.currentRevenue}
            change={s?.revenueChange}
            profit={s?.profit}
            margin={s?.marginAvg}
            showProfit={perms.profit}
            trend={data.trend.data}
            trendLoading={data.trend.loading}
            periodLabel={periodLabel}
            caption={`${trendCaption(f.range)}, ${periodLabel.toLowerCase()}`}
            loading={data.stats.loading}
          />
          <Grid2>
            {[
              <StatCard
                key="inv"
                icon="receipt"
                color="blue"
                label="Số hóa đơn"
                value={s?.invoiceCount}
                format={money}
                loading={data.stats.loading}
                delta={formatDelta(s?.invoiceChange)}
                deltaTone={deltaTone(s?.invoiceChange)}
              />,
              <StatCard
                key="aov"
                icon="chart-column"
                color="violet"
                label="Trung bình mỗi đơn"
                value={s?.aov}
                format={money}
                loading={data.stats.loading}
                delta={formatDelta(s?.aovChange)}
                deltaTone={deltaTone(s?.aovChange)}
              />,
              // Lợi nhuận / biên lợi nhuận: chỉ Admin, Super Admin (giống web).
              ...(perms.profit
                ? [
                    <StatCard
                      key="profit"
                      icon="wallet"
                      color="orange"
                      label="Lợi nhuận tạm tính"
                      value={s?.profit}
                      format={money}
                      loading={data.stats.loading}
                      delta={formatDelta(s?.profitChange)}
                      deltaTone={deltaTone(s?.profitChange)}
                    />,
                    <StatCard
                      key="margin"
                      icon="percent"
                      color="green"
                      label="Biên lợi nhuận"
                      value={s ? marginText(s.marginAvg) : undefined}
                      loading={data.stats.loading}
                      note="theo giá vốn kho"
                    />,
                  ]
                : []),
            ]}
          </Grid2>
        </Section>
      )}

      <Section index={2} title="Cần xử lý" actionLabel="Xem tất cả" onAction={() => onOpenTask('orders')}>
        <Grid2>
          {TASK_ORDER.map((type) => (
            <StatCard
              key={type}
              icon={TASKS[type].icon}
              color={TASKS[type].color}
              label={TASKS[type].short}
              value={data.counts.data?.[type]}
              format={money}
              loading={data.counts.loading}
              onPress={() => onOpenTask(type)}
            />
          ))}
        </Grid2>
      </Section>

      {perms.cashflow ? (
        <Section index={3} title="Thu chi sổ quỹ">
          <Card style={styles.block}>
            <FilterRow note={`Phiếu thu, phiếu chi ${rangeNote}`}>{null}</FilterRow>
            <BlockBody loading={data.cashflow.loading} error={data.cashflow.error} onRetry={retry('cashflow')} empty={!data.cashflow.data}>
              {data.cashflow.data ? <CashflowBlock data={data.cashflow.data} /> : null}
            </BlockBody>
          </Card>
        </Section>
      ) : null}

      <Section index={3} title="Cơ cấu theo nhóm hàng">
        <Card style={styles.block}>
          <FilterRow note={`Tỷ trọng doanh thu, ${periodLabel.toLowerCase()}`}>
            <Select variant="pill" label="Nhóm theo" options={CATEGORY_OPTIONS} value={f.catDim} onChange={(v) => onFilters({ catDim: v ?? 'parent' })} />
          </FilterRow>
          <BlockBody
            loading={data.category.loading}
            error={data.category.error}
            onRetry={retry('category')}
            empty={parts.length === 0}>
            <CategoryBreakdown parts={parts} />
          </BlockBody>
        </Card>
      </Section>

      <Section index={4} title="Kênh bán hàng">
        <Card style={styles.block}>
          <FilterRow note={`Tỷ trọng doanh thu, ${rangeNote}`}>{null}</FilterRow>
          <BlockBody loading={data.channels.loading} error={data.channels.error} onRetry={retry('channels')} empty={channels.length === 0}>
            <CategoryBreakdown parts={channels} />
          </BlockBody>
        </Card>
      </Section>

      <Section index={4} title="Top 10 hàng bán chạy">
        <Card style={styles.block}>
          <FilterRow>
            <Select
              variant="pill"
              label="Xếp theo"
              options={topMetricOptions(perms.profit)}
              value={topMetric}
              onChange={(v) => onFilters({ topMetric: v ?? 'rev' })}
            />
            <PeriodField
              variant="pill"
              label="Thời gian"
              options={RANGE_OPTIONS}
              value={f.topRange}
              initialRange={dashRangeDates(f.topRange, now)}
              onChange={(topRange) => onFilters({ topRange })}
            />
          </FilterRow>
          <BlockBody
            loading={data.products.loading}
            error={data.products.error}
            onRetry={retry('products')}
            empty={products.length === 0}
            rows={5}>
            <BarList rows={products} color={topMetric === 'profit' ? CHART.profit : CHART.revenue} />
          </BlockBody>
        </Card>
      </Section>

      <Section index={5} title="Top 10 khách mua nhiều nhất">
        <Card style={styles.block}>
          <FilterRow note="Theo tổng tiền hóa đơn">
            <PeriodField
              variant="pill"
              label="Thời gian"
              options={RANGE_OPTIONS}
              value={f.buyerRange}
              initialRange={dashRangeDates(f.buyerRange, now)}
              onChange={(buyerRange) => onFilters({ buyerRange })}
            />
          </FilterRow>
          <BlockBody loading={data.buyers.loading} error={data.buyers.error} onRetry={retry('buyers')} empty={buyers.length === 0} rows={5}>
            <BarList rows={buyers} />
          </BlockBody>
        </Card>
      </Section>

      {perms.sellers ? (
        <Section index={6} title="Doanh thu theo nhân viên bán">
          <Card style={styles.block}>
            <FilterRow note={`Theo người bán trên hóa đơn, ${rangeNote}`}>{null}</FilterRow>
            <BlockBody loading={data.sellers.loading} error={data.sellers.error} onRetry={retry('sellers')} empty={sellers.length === 0} rows={4}>
              <BarList rows={sellers} />
            </BlockBody>
          </Card>
        </Section>
      ) : null}

      {perms.heatmap ? (
        <Section index={6} title="Khung giờ bán chạy">
          <Card style={styles.block}>
            <FilterRow note="Doanh thu theo thứ và giờ">
              <PeriodField
                variant="pill"
                label="Thời gian"
                options={HEAT_OPTIONS}
                value={f.heatPeriod}
                initialRange={periodDates(f.heatPeriod, now)}
                onChange={(heatPeriod) => onFilters({ heatPeriod })}
              />
            </FilterRow>
            <BlockBody loading={data.heatmap.loading} error={data.heatmap.error} onRetry={retry('heatmap')} rows={4}>
              <Heatmap grid={grid} />
            </BlockBody>
          </Card>
        </Section>
      ) : null}

      <Section index={6} title="So sánh chi nhánh">
        <Card style={styles.block}>
          <FilterRow note={perms.profit ? undefined : 'Doanh thu'}>
            {perms.profit ? (
              <Select
                variant="pill"
                label="Chỉ số"
                options={BRANCH_METRIC_OPTIONS}
                value={branchMetric}
                onChange={(v) => onFilters({ branchMetric: v ?? 'rev' })}
              />
            ) : null}
            <PeriodField
              variant="pill"
              label="Thời gian"
              options={PERIOD_OPTIONS}
              value={f.branchPeriod}
              initialRange={periodDates(f.branchPeriod, now)}
              onChange={(branchPeriod) => onFilters({ branchPeriod })}
            />
          </FilterRow>
          <BlockBody
            loading={data.branchCmp.loading}
            error={data.branchCmp.error}
            onRetry={retry('branchCmp')}
            empty={bars.length === 0}>
            <BarList rows={bars} ranked={false} color={branchMetric === 'profit' ? CHART.profit : CHART.revenue} />
          </BlockBody>
        </Card>
      </Section>

      {perms.returns ? (
        <Section index={7} title="Trả hàng">
          <Card style={styles.block}>
            <FilterRow note={`Theo ngày tạo phiếu trả, ${rangeNote}`}>{null}</FilterRow>
            <BlockBody loading={data.returns.loading} error={data.returns.error} onRetry={retry('returns')} empty={!data.returns.data}>
              {data.returns.data ? <ReturnsBlock data={data.returns.data} /> : null}
            </BlockBody>
          </Card>
        </Section>
      ) : null}

      <Section index={7} title="Công nợ và thu hộ">
        <Card style={styles.flush}>
          <View style={{ paddingHorizontal: 16 }}>
            <FilterRow note="Dòng tiền cần thu hồi">
              <PeriodField
                variant="pill"
                label="Thời gian"
                options={FINANCE_OPTIONS}
                value={f.finPeriod}
                initialRange={periodDates(f.finPeriod, now)}
                onChange={(finPeriod) => onFilters({ finPeriod })}
              />
            </FilterRow>
          </View>
          <View style={{ paddingHorizontal: data.finance.data ? 0 : 16 }}>
            <BlockBody loading={data.finance.loading} error={data.finance.error} onRetry={retry('finance')} empty={!data.finance.data}>
              {data.finance.data ? (
                <FinanceBlock data={data.finance.data} supplierDebt={perms.supplierDebt ? s?.totalSupplierDebt : undefined} />
              ) : null}
            </BlockBody>
          </View>
        </Card>
      </Section>

      {data.recent.data && data.recent.data.length > 0 ? (
        <Section index={8} title="Hoạt động gần đây">
          <Card>
            {data.recent.data.map((o, i) => (
              <View key={o.id}>
                {i > 0 ? <Divider inset={68} /> : null}
                <View style={styles.recent}>
                  <IconBadge name="shopping-cart" color="violet" size={40} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="body" weight="semibold" numberOfLines={1}>
                      {o.customerName}
                    </Txt>
                    <Txt variant="caption" color={C.muted} numberOfLines={1}>
                      Đặt hàng {o.code}, {shortWhen(o.createdAt, now)}
                    </Txt>
                  </View>
                  <Txt variant="body" weight="bold" numeric>
                    {money(o.grandTotal)}
                  </Txt>
                </View>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: 16, paddingVertical: 2, marginTop: 4 },
  block: { padding: 16 },
  flush: { paddingTop: 16, paddingBottom: 16 },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginTop: 4 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});
