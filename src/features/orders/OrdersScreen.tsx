import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, StyleSheet, View } from 'react-native';
import { canDo } from '@/core/can';
import { money, timeVN, type PeriodKey } from '@/core/format';
import { useSession } from '@/core/session';
import { useDebounced } from '@/core/useDebounced';
import { usePullRefresh } from '@/core/usePullRefresh';
import {
  C,
  ChipGroup,
  EmptyState,
  ErrorState,
  Icon,
  PageBackground,
  Pill,
  PressableScale,
  SearchField,
  Skeleton,
  TabPanel,
  TitleHeader,
  Txt,
} from '@/ui';
import { useDocList, type DocFilters, type DocRow, type StatusCounts } from './api';
import { groupByDay } from './group';
import {
  INVOICE_FILTERS,
  INVOICE_STATUS,
  isCancelled,
  KIND_LABEL,
  KIND_ORDER,
  KIND_SLUG,
  ORDER_FILTERS,
  ORDER_STATUS,
  PERIOD_FILTERS,
  statusOf,
  type DocKind,
  type StatusFilter,
} from './model';

function statusOptions(kind: DocKind, counts: StatusCounts | undefined) {
  const all = { value: 'all', label: 'Tất cả', count: counts?.all };
  if (kind === 'invoice') {
    return [all, ...INVOICE_FILTERS.map((s) => ({ value: String(s), label: INVOICE_STATUS[s].label, count: counts?.[String(s)] }))];
  }
  return [all, ...ORDER_FILTERS.map((s) => ({ value: s, label: ORDER_STATUS[s].label, count: counts?.[s] }))];
}

export function DocCard({ kind, row, onPress }: { kind: DocKind; row: DocRow; onPress: () => void }) {
  const st = statusOf(kind, row.status);
  const cancelled = isCancelled(kind, row.status);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${row.code}, ${row.customerName}, ${money(row.grandTotal)} đồng, ${st.label}`}
      scaleTo={0.985}
      style={[styles.card, cancelled ? { opacity: 0.6 } : null]}>
      <View style={styles.cardTop}>
        <Txt variant="body" weight="bold" numeric style={{ flex: 1 }}>
          {row.code}
        </Txt>
        <Pill label={st.label} tone={st.tone} />
      </View>
      <View style={styles.cardMid}>
        <Txt variant="body" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
          {row.customerName}
        </Txt>
        <Txt variant="heading" weight="bold" numeric style={cancelled ? styles.strike : null}>
          {money(row.grandTotal)}
        </Txt>
      </View>
      <View style={styles.cardMid}>
        <Txt variant="caption" color={C.muted} numberOfLines={1} style={{ flex: 1 }}>
          {[timeVN(row.date), row.sellerName].filter(Boolean).join(' · ')}
        </Txt>
        {cancelled ? null : row.debtAmount > 0 ? (
          <Txt variant="caption" weight="semibold" color="#B91C1C" numeric>
            Còn nợ {money(row.debtAmount)}
          </Txt>
        ) : (
          <Txt variant="caption" weight="semibold" color="#15803D">
            Đã thu đủ
          </Txt>
        )}
      </View>
    </PressableScale>
  );
}

function ListSkeleton() {
  return (
    <View style={{ gap: 10, paddingHorizontal: 16, paddingTop: 8 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.card, { gap: 10 }]}>
          <Skeleton width="40%" height={15} />
          <Skeleton width="70%" height={15} />
          <Skeleton width="50%" height={12} />
        </View>
      ))}
    </View>
  );
}

/** Chọn khoảng thời gian bằng bảng chọn của iOS. */
function pickPeriod(current: PeriodKey | 'all', onPick: (p: PeriodKey | 'all') => void) {
  const labels = PERIOD_FILTERS.map((p) => (p.value === current ? `✓ ${p.label}` : p.label));
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Xem đơn trong khoảng', options: [...labels, 'Hủy'], cancelButtonIndex: labels.length },
      (i) => {
        if (i < PERIOD_FILTERS.length) onPick(PERIOD_FILTERS[i].value);
      },
    );
    return;
  }
  Alert.alert('Xem đơn trong khoảng', undefined, [
    ...PERIOD_FILTERS.map((p) => ({ text: p.label, onPress: () => onPick(p.value) })),
    { text: 'Hủy', style: 'cancel' as const },
  ]);
}

export interface OrdersViewProps {
  kinds: DocKind[];
  kind: DocKind;
  onKind: (k: DocKind) => void;
  filters: DocFilters;
  onSearch: (s: string) => void;
  onStatus: (s: StatusFilter) => void;
  onPeriod: (p: PeriodKey | 'all') => void;
  rows: DocRow[];
  total?: number;
  counts?: StatusCounts;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  loadingMore?: boolean;
  onEndReached?: () => void;
  onOpen: (row: DocRow) => void;
  now?: Date;
}

/** Danh sách hóa đơn / đơn đặt hàng: tìm, lọc trạng thái, lọc thời gian, nhóm theo ngày. */
export function OrdersView(p: OrdersViewProps) {
  const statusOrder = ['all', ...(p.kind === 'invoice' ? INVOICE_FILTERS.map(String) : ORDER_FILTERS)];
  const period = PERIOD_FILTERS.find((x) => x.value === p.filters.period)?.label ?? '';
  const items = groupByDay(p.rows, p.now);
  const what = p.kind === 'invoice' ? 'hóa đơn' : 'đơn đặt hàng';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <PageBackground />
      <TitleHeader title="Đơn hàng">
        <SearchField value={p.filters.search} onChangeText={p.onSearch} placeholder="Tìm mã đơn, khách hàng" />
        {p.kinds.length > 1 ? (
          <ChipGroup
            fill
            options={p.kinds.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
            value={p.kind}
            onChange={p.onKind}
          />
        ) : null}
      </TitleHeader>

      <TabPanel value={p.kind} order={KIND_ORDER} style={{ flex: 1 }}>
        <View style={{ gap: 10, paddingBottom: 6 }}>
          <View style={{ paddingHorizontal: 16 }}>
            <ChipGroup options={statusOptions(p.kind, p.counts)} value={p.filters.status} onChange={p.onStatus} />
          </View>
          <View style={styles.summary}>
            <Txt variant="label" color={C.muted} style={{ flex: 1 }}>
              {p.total !== undefined ? `${money(p.total)} ${what}` : ' '}
            </Txt>
            <PressableScale
              onPress={() => pickPeriod(p.filters.period, p.onPeriod)}
              accessibilityLabel={`Thời gian: ${period}. Bấm để đổi`}
              scaleTo={0.95}
              style={styles.period}>
              <Icon name="clock" size={15} color={C.brand} />
              <Txt variant="label" weight="semibold" color={C.brand}>
                {period}
              </Txt>
              <Icon name="chevron-down" size={15} color={C.brand} />
            </PressableScale>
          </View>
        </View>

        <TabPanel value={p.filters.status} order={statusOrder} style={{ flex: 1 }}>
          {p.loading ? (
            <ListSkeleton />
          ) : p.error ? (
            <ErrorState error={p.error} onRetry={p.onRetry} />
          ) : (
            <FlashList
              data={items}
              keyExtractor={(it) => it.key}
              getItemType={(it) => it.type}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
              onEndReached={p.onEndReached}
              onEndReachedThreshold={0.4}
              refreshing={!!p.refreshing}
              onRefresh={p.onRefresh}
              keyboardDismissMode="on-drag"
              ListFooterComponent={p.loadingMore ? <ActivityIndicator color={C.brand} style={{ marginTop: 12 }} /> : null}
              ListEmptyComponent={
                <EmptyState
                  icon="receipt-text"
                  color="slate"
                  title={p.filters.search ? 'Không tìm thấy đơn' : `Chưa có ${what}`}
                  message={
                    p.filters.search
                      ? `Không có ${what} nào khớp “${p.filters.search}”.`
                      : `Không có ${what} nào trong khoảng “${period.toLowerCase()}”. Thử đổi thời gian hoặc trạng thái.`
                  }
                />
              }
              renderItem={({ item }) =>
                item.type === 'day' ? (
                  <Txt variant="label" weight="semibold" color={C.muted} style={styles.day}>
                    {item.label}
                  </Txt>
                ) : (
                  <View style={{ paddingBottom: 10 }}>
                    <DocCard kind={p.kind} row={item.row} onPress={() => p.onOpen(item.row)} />
                  </View>
                )
              }
            />
          )}
        </TabPanel>
      </TabPanel>
    </View>
  );
}

export default function OrdersScreen() {
  const user = useSession((s) => s.user);
  const kinds = KIND_ORDER.filter((k) => canDo(user, k === 'invoice' ? 'invoices:view' : 'orders:view'));
  const [kind, setKind] = useState<DocKind>(kinds[0] ?? 'order');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Record<DocKind, StatusFilter>>({ order: 'all', invoice: 'all' });
  const [period, setPeriod] = useState<PeriodKey | 'all'>('last7');
  const term = useDebounced(search.trim(), 350);
  const active = kinds.includes(kind) ? kind : (kinds[0] ?? 'order');
  const filters: DocFilters = { search: term, status: status[active], period };
  const list = useDocList(active, filters, kinds.length > 0);
  const pull = usePullRefresh(list.refetch);

  if (!kinds.length) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <PageBackground />
        <TitleHeader title="Đơn hàng" />
        <EmptyState
          icon="lock"
          color="slate"
          title="Chưa có quyền xem đơn hàng"
          message="Nhờ quản trị viên cấp quyền “Xem hóa đơn” hoặc “Xem đặt hàng”."
        />
      </View>
    );
  }

  const pages = list.data?.pages ?? [];
  return (
    <OrdersView
      kinds={kinds}
      kind={active}
      onKind={setKind}
      filters={{ ...filters, search }}
      onSearch={setSearch}
      onStatus={(s) => setStatus((prev) => ({ ...prev, [active]: s }))}
      onPeriod={setPeriod}
      rows={pages.flatMap((pg) => pg.rows)}
      total={pages[0]?.total}
      counts={pages[0]?.counts}
      loading={list.isLoading}
      error={list.isError ? list.error : undefined}
      onRetry={() => void list.refetch()}
      refreshing={pull.refreshing}
      onRefresh={pull.onRefresh}
      loadingMore={list.isFetchingNextPage}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
      }}
      onOpen={(row) =>
        router.push({ pathname: '/don-hang/[kind]/[id]', params: { kind: KIND_SLUG[active], id: String(row.id) } })
      }
    />
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 6,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardMid: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  strike: { textDecorationLine: 'line-through' },
  summary: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  period: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: '#CFE3E6',
  },
  day: { paddingTop: 8, paddingBottom: 8 },
});
