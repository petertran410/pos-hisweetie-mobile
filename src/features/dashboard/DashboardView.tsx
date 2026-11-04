import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { money, shortWhen, vnd } from '@/core/format';
import { isRange } from '@/core/period';
import type { PermissionHolder } from '@/core/can';
import {
  C,
  Card,
  ChipGroup,
  Divider,
  ErrorState,
  Grid2,
  HomeHeader,
  Icon,
  IconBadge,
  InfoRow,
  Page,
  PeriodModal,
  periodText,
  PressableScale,
  Section,
  ShortcutGrid,
  StatCard,
  TabPanel,
  Txt,
  type ShortcutItem,
} from '@/ui';
import type { DashRange, DashboardStats, RecentOrder, TaskType, TopBuyer, TopProduct, TrendPoint } from './api';
import { formatQtySold, RankList, RevenueCard } from './components';
import { dashRangeDates, deltaTone, formatDelta, greetingFor, RANGE_OPTIONS, shortName, TASK_ORDER, TASKS } from './model';
import { allowedShortcuts } from './shortcuts';

const RANGE_ORDER: string[] = [...RANGE_OPTIONS.map((o) => o.value), 'custom'];

export interface DashboardData {
  /** Đang tải lần đầu (chưa có số liệu). */
  loading?: boolean;
  stats?: DashboardStats;
  statsError?: unknown;
  trend?: TrendPoint[];
  counts?: Partial<Record<TaskType, number>>;
  products?: TopProduct[];
  buyers?: TopBuyer[];
  recent?: RecentOrder[];
}

export interface DashboardViewProps {
  user: (PermissionHolder & { name?: string | null }) | null;
  branchName?: string;
  range: DashRange;
  onRangeChange: (range: DashRange) => void;
  data: DashboardData;
  refreshing?: boolean;
  onRefresh?: () => void;
  onRetry?: () => void;
  onOpenBranch: () => void;
  onOpenAccount: () => void;
  onOpenTask: (type: TaskType) => void;
  onShortcut: (key: string, href?: string) => void;
  now?: Date;
}

/** Màn Tổng quan (chỉ hiển thị; dữ liệu truyền vào từ DashboardScreen). */
export function DashboardView({
  user,
  branchName,
  range,
  onRangeChange,
  data,
  refreshing,
  onRefresh,
  onRetry,
  onOpenBranch,
  onOpenAccount,
  onOpenTask,
  onShortcut,
  now = new Date(),
}: DashboardViewProps) {
  const s = data.stats;
  const [rangeOpen, setRangeOpen] = useState(false);
  const custom = isRange(range);
  const rangeKey = custom ? 'custom' : range;
  const periodLabel = periodText(RANGE_OPTIONS, range, now);
  const shortcuts: ShortcutItem[] = allowedShortcuts(user).map((d) => ({
    key: d.key,
    icon: d.icon,
    color: d.color,
    label: d.label,
    soon: !d.href,
    onPress: () => onShortcut(d.key, d.href),
  }));
  const margin = s ? `${String(Math.round(s.marginAvg * 10) / 10).replace('.', ',')}%` : undefined;

  const header = (
    <HomeHeader
      greeting={`Xin chào, ${shortName(user?.name) || 'bạn'}`}
      title={greetingFor(now)}
      userName={user?.name}
      onAvatarPress={onOpenAccount}>
      <PressableScale
        onPress={onOpenBranch}
        accessibilityLabel={`Chi nhánh ${branchName ?? ''}. Bấm để đổi`}
        scaleTo={0.95}
        style={styles.branch}>
        <Icon name="store" size={18} color={C.brand} />
        <Txt variant="label" weight="semibold" color={C.brand} numberOfLines={1} style={{ flexShrink: 1 }}>
          {branchName ?? 'Chọn chi nhánh'}
        </Txt>
        <Icon name="chevron-down" size={16} color={C.brand} />
      </PressableScale>
    </HomeHeader>
  );

  return (
    <Page header={header} refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ gap: 8 }}>
        <ChipGroup fill options={RANGE_OPTIONS} value={custom ? null : range} onChange={onRangeChange} />
        <PressableScale
          onPress={() => setRangeOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={custom ? `Khoảng ngày ${periodLabel}. Bấm để đổi` : 'Chọn khoảng ngày khác'}
          scaleTo={0.96}
          style={[styles.rangeBtn, custom ? styles.rangeBtnOn : null]}>
          <Icon name="calendar-range" size={16} color={custom ? C.white : C.brand} />
          <Txt variant="label" weight="semibold" color={custom ? C.white : C.brand} numeric>
            {custom ? periodLabel : 'Chọn khoảng ngày'}
          </Txt>
          <Icon name="chevron-down" size={15} color={custom ? C.white : C.brand} />
        </PressableScale>
      </View>
      <PeriodModal
        visible={rangeOpen}
        title="Thời gian"
        options={RANGE_OPTIONS}
        value={range}
        initialRange={dashRangeDates(range, now)}
        onChange={(v) => {
          setRangeOpen(false);
          onRangeChange(v);
        }}
        onClose={() => setRangeOpen(false)}
      />

      {data.statsError ? (
        <ErrorState error={data.statsError} onRetry={onRetry} />
      ) : (
        <>
          <Section index={0} title="Kết quả bán hàng">
            <TabPanel value={rangeKey} order={RANGE_ORDER} style={styles.panel}>
              <RevenueCard
                revenue={s?.currentRevenue}
                change={s?.revenueChange}
                trend={data.trend}
                periodLabel={periodLabel}
                loading={data.loading}
              />
              <Grid2>
                {[
                  <StatCard
                    key="inv"
                    icon="receipt"
                    color="blue"
                    label="Hóa đơn"
                    value={s?.invoiceCount}
                    format={money}
                    loading={data.loading}
                    delta={formatDelta(s?.invoiceChange)}
                    deltaTone={deltaTone(s?.invoiceChange)}
                  />,
                  <StatCard
                    key="profit"
                    icon="wallet"
                    color="green"
                    label="Lợi nhuận"
                    value={s?.profit}
                    format={money}
                    loading={data.loading}
                    delta={formatDelta(s?.profitChange)}
                    deltaTone={deltaTone(s?.profitChange)}
                  />,
                  <StatCard
                    key="aov"
                    icon="chart-column"
                    color="violet"
                    label="Trung bình mỗi đơn"
                    value={s?.aov}
                    format={money}
                    loading={data.loading}
                    delta={formatDelta(s?.aovChange)}
                    deltaTone={deltaTone(s?.aovChange)}
                  />,
                  <StatCard
                    key="margin"
                    icon="percent"
                    color="orange"
                    label="Biên lợi nhuận"
                    value={s ? margin : undefined}
                    loading={data.loading}
                  />,
                ]}
              </Grid2>
            </TabPanel>
          </Section>

          {shortcuts.length > 0 ? (
            <Section index={1} title="Chức năng">
              <ShortcutGrid
                items={shortcuts}
                footnote={
                  shortcuts.some((x) => x.soon)
                    ? 'Các chức năng đang được làm và sẽ mở dần ở bản cập nhật tới.'
                    : undefined
                }
              />
            </Section>
          ) : null}

          <Section index={2} title="Cần xử lý" actionLabel="Xem tất cả" onAction={() => onOpenTask('orders')}>
            <Grid2>
              {TASK_ORDER.map((type) => (
                <StatCard
                  key={type}
                  icon={TASKS[type].icon}
                  color={TASKS[type].color}
                  label={TASKS[type].short}
                  value={data.counts?.[type]}
                  format={money}
                  loading={data.counts === undefined}
                  onPress={() => onOpenTask(type)}
                />
              ))}
            </Grid2>
          </Section>

          <Section index={3} title="Công nợ và thu hộ">
            <Card>
              <InfoRow
                icon="users"
                color="red"
                label="Khách đang nợ"
                value={s ? vnd(s.totalCustomerDebt) : '—'}
                valueTone="warning"
              />
              <Divider inset={64} />
              <InfoRow
                icon="receipt-text"
                color="blue"
                label="Hóa đơn chưa thu đủ"
                sub={s ? `${money(s.unpaidInvoices)} hóa đơn` : undefined}
                value={s ? vnd(s.unpaidAmount) : '—'}
              />
              <Divider inset={64} />
              <InfoRow
                icon="banknote"
                color="orange"
                label="Tiền COD chưa thu"
                sub={s ? `${money(s.codCount)} đơn` : undefined}
                value={s ? vnd(s.codAmount) : '—'}
              />
              <Divider inset={64} />
              <InfoRow
                icon="hand-coins"
                color="slate"
                label="Nợ nhà cung cấp"
                value={s ? vnd(s.totalSupplierDebt) : '—'}
              />
            </Card>
          </Section>

          {data.products && data.products.length > 0 ? (
            <Section index={4} title="Bán chạy">
              <TabPanel value={rangeKey} order={RANGE_ORDER}>
                <RankList
                  items={data.products.map((p) => ({
                    key: p.productId,
                    title: p.name,
                    sub: `${p.code}, ${formatQtySold(p.totalQuantity).toLowerCase()}`,
                    value: money(p.totalRevenue),
                  }))}
                />
              </TabPanel>
            </Section>
          ) : null}

          {data.buyers && data.buyers.length > 0 ? (
            <Section index={5} title="Khách mua nhiều">
              <TabPanel value={rangeKey} order={RANGE_ORDER}>
                <RankList
                  items={data.buyers.map((b) => ({
                    key: b.id,
                    title: b.name,
                    sub: `${money(b.invoiceCount)} hóa đơn`,
                    value: money(b.totalRevenue),
                  }))}
                />
              </TabPanel>
            </Section>
          ) : null}

          {data.recent && data.recent.length > 0 ? (
            <Section index={6} title="Đơn đặt mới">
              <View style={{ gap: 10 }}>
                {data.recent.map((o) => (
                  <Card key={o.id} style={styles.recent}>
                    <IconBadge name="clipboard-list" color="violet" size={40} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt variant="body" weight="semibold" numberOfLines={1}>
                        {o.customerName}
                      </Txt>
                      <Txt variant="caption" color={C.muted} numberOfLines={1}>
                        {o.code}, {shortWhen(o.createdAt, now)}
                      </Txt>
                    </View>
                    <Txt variant="body" weight="bold" numeric>
                      {money(o.grandTotal)}
                    </Txt>
                  </Card>
                ))}
              </View>
            </Section>
          ) : null}
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  rangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: C.brandSoft,
  },
  rangeBtnOn: { backgroundColor: C.brand },
  panel: { gap: 12 },
  branch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: '#CFE6EA',
  },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
});
