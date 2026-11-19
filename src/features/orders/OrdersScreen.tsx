import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { canDo } from '@/core/can';
import { money, timeVN } from '@/core/format';
import { resolveRange } from '@/core/period';
import { useSession } from '@/core/session';
import { useDebounced } from '@/core/useDebounced';
import { usePullRefresh } from '@/core/usePullRefresh';
import {
  C,
  ChipGroup,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  PageBackground,
  PeriodModal,
  periodText,
  Pill,
  PressableScale,
  SearchField,
  Skeleton,
  TabPanel,
  TitleHeader,
  toast,
  Txt,
} from '@/ui';
import { DRAFTS_FULL_MESSAGE, newDraft, whenDraftsReady } from '../sales/drafts';
import { alertSummary, DocAlertIcons, DocAlertSheet } from './alerts';
import { useDocList, type DocFilters, type DocRow, type StatusCounts } from './api';
import { setDocFilters, useDocFilters } from './filters';
import { groupByDay } from './group';
import {
  DOC_PERIODS,
  docFilterCount,
  filtersFor,
  INVOICE_FILTERS,
  INVOICE_STATUS,
  isCancelled,
  KIND_LABEL,
  KIND_ORDER,
  KIND_SLUG,
  kindFromSlug,
  ORDER_FILTERS,
  ORDER_STATUS,
  statusOf,
  type DocKind,
  type DocPeriod,
  type StatusFilter,
} from './model';

function statusOptions(kind: DocKind, counts: StatusCounts | undefined) {
  const all = { value: 'all', label: 'Tất cả', count: counts?.all };
  if (kind === 'invoice') {
    return [all, ...INVOICE_FILTERS.map((s) => ({ value: String(s), label: INVOICE_STATUS[s].label, count: counts?.[String(s)] }))];
  }
  return [all, ...ORDER_FILTERS.map((s) => ({ value: s, label: ORDER_STATUS[s].label, count: counts?.[s] }))];
}

export function DocCard({
  kind,
  row,
  onPress,
  onAlerts,
}: {
  kind: DocKind;
  row: DocRow;
  onPress: () => void;
  /** Bấm dãy icon cảnh báo: mở sheet giải thích. */
  onAlerts?: () => void;
}) {
  const st = statusOf(kind, row.status);
  const cancelled = isCancelled(kind, row.status);
  const alerts = row.alerts.length ? alertSummary(row) : '';
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={[`${row.code}, ${row.customerName}, ${money(row.grandTotal)} đồng, ${st.label}`, alerts && `cảnh báo: ${alerts}`]
        .filter(Boolean)
        .join(', ')}
      // Nút icon lồng trong thẻ không tự nhận tiêu điểm khi đọc màn hình: thêm thao tác riêng.
      accessibilityActions={alerts && onAlerts ? [{ name: 'alerts', label: 'Xem cảnh báo' }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'alerts') onAlerts?.();
      }}
      scaleTo={0.985}
      style={[styles.card, cancelled ? { opacity: 0.6 } : null]}>
      <View style={styles.cardTop}>
        <Txt variant="body" weight="bold" numeric style={{ flexShrink: 1 }}>
          {row.code}
        </Txt>
        <DocAlertIcons row={row} onPress={onAlerts} />
        <View style={{ flex: 1 }} />
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

export interface OrdersViewProps {
  kinds: DocKind[];
  kind: DocKind;
  onKind: (k: DocKind) => void;
  filters: DocFilters;
  onSearch: (s: string) => void;
  onStatus: (s: StatusFilter) => void;
  onPeriod: (p: DocPeriod) => void;
  /** Số bộ lọc đang bật trong sheet "Bộ lọc" (cảnh báo, người bán, người tạo…). */
  filterCount?: number;
  onOpenFilters?: () => void;
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
  onCreate?: () => void;
  onOpen: (row: DocRow) => void;
  now?: Date;
}

/**
 * Danh sách hóa đơn / đơn đặt hàng: tìm, lọc trạng thái, lọc thời gian, bộ lọc thêm
 * (cảnh báo, người bán, người tạo), nhóm theo ngày, icon cảnh báo trên từng thẻ.
 */
export function OrdersView(p: OrdersViewProps) {
  const statusOrder = ['all', ...(p.kind === 'invoice' ? INVOICE_FILTERS.map(String) : ORDER_FILTERS)];
  const [periodOpen, setPeriodOpen] = useState(false);
  const [alertRow, setAlertRow] = useState<DocRow | null>(null);
  const period = periodText(DOC_PERIODS, p.filters.period, p.now);
  const items = groupByDay(p.rows, p.now);
  const what = p.kind === 'invoice' ? 'hóa đơn' : 'đơn đặt hàng';
  const count = p.filterCount ?? 0;
  const emptyMessage = p.filters.search
    ? `Không có ${what} nào khớp “${p.filters.search}”.`
    : count
      ? `Không có ${what} nào khớp bộ lọc trong khoảng “${period.toLowerCase()}”. Thử bỏ bớt bộ lọc.`
      : `Không có ${what} nào trong khoảng “${period.toLowerCase()}”. Thử đổi thời gian hoặc trạng thái.`;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <PageBackground />
      <TitleHeader
        title="Đơn hàng"
        right={
          p.onCreate ? (
            <IconButton icon="plus" label="Tạo đơn hàng hoặc hóa đơn" onPress={p.onCreate} tint={C.brand} />
          ) : undefined
        }>
        <View style={styles.searchRow}>
          <SearchField value={p.filters.search} onChangeText={p.onSearch} placeholder="Tìm mã đơn, khách hàng" style={{ flex: 1 }} />
          {p.onOpenFilters ? (
            <PressableScale
              onPress={p.onOpenFilters}
              accessibilityLabel={count ? `Bộ lọc, đang bật ${count}` : 'Bộ lọc'}
              hitSlop={4}
              scaleTo={0.92}
              style={[styles.filterBtn, count ? styles.filterOn : null]}>
              <Icon name="sliders-horizontal" size={20} color={count ? C.white : C.text} />
              {count ? (
                <View style={styles.badge}>
                  <Txt variant="caption" weight="bold" color={C.brand} numeric>
                    {count}
                  </Txt>
                </View>
              ) : null}
            </PressableScale>
          ) : null}
        </View>
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
              onPress={() => setPeriodOpen(true)}
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
                  title={p.filters.search || count ? 'Không tìm thấy đơn' : `Chưa có ${what}`}
                  message={emptyMessage}
                />
              }
              renderItem={({ item }) =>
                item.type === 'day' ? (
                  <Txt variant="label" weight="semibold" color={C.muted} style={styles.day}>
                    {item.label}
                  </Txt>
                ) : (
                  <View style={{ paddingBottom: 10 }}>
                    <DocCard kind={p.kind} row={item.row} onPress={() => p.onOpen(item.row)} onAlerts={() => setAlertRow(item.row)} />
                  </View>
                )
              }
            />
          )}
        </TabPanel>
      </TabPanel>
      <PeriodModal
        visible={periodOpen}
        title={p.kind === 'invoice' ? 'Thời gian mua hàng' : 'Thời gian'}
        options={DOC_PERIODS}
        value={p.filters.period}
        initialRange={resolveRange(p.filters.period, p.now)}
        onChange={(v) => {
          setPeriodOpen(false);
          p.onPeriod(v);
        }}
        onClose={() => setPeriodOpen(false)}
      />
      <DocAlertSheet kind={p.kind} row={alertRow} onClose={() => setAlertRow(null)} />
    </View>
  );
}

/**
 * Nút "+" ở Đơn hàng: như nút "+" ở Bán hàng, mở 1 đơn nháp trống rồi vào giỏ
 * hàng. Đủ đơn nháp thì sang màn Bán hàng để chọn đơn.
 */
function createFromOrders() {
  whenDraftsReady(() => {
    if (newDraft() === 'full') {
      toast.info(DRAFTS_FULL_MESSAGE);
      router.push('/ban-hang');
      return;
    }
    router.push('/ban-hang/gio-hang');
  });
}

export default function OrdersScreen() {
  const user = useSession((s) => s.user);
  const kinds = KIND_ORDER.filter((k) => canDo(user, k === 'invoice' ? 'invoices:view' : 'orders:view'));
  // Lối tắt "Hóa đơn" / "Đặt hàng" ở Tổng quan mở thẳng đúng loại (?kind=hoa-don).
  const params = useLocalSearchParams<{ kind?: string }>();
  const wanted = params.kind ? kindFromSlug(params.kind) : null;
  const [kind, setKind] = useState<DocKind>(wanted ?? kinds[0] ?? 'order');
  const [seenKind, setSeenKind] = useState(params.kind);
  if (params.kind !== seenKind) {
    setSeenKind(params.kind);
    if (wanted) setKind(wanted);
  }
  // Đã đổi loại theo lối tắt: bỏ tham số để lần bấm sau vẫn có tác dụng.
  useEffect(() => {
    if (params.kind) router.setParams({ kind: undefined });
  }, [params.kind]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Record<DocKind, StatusFilter>>({ order: 'all', invoice: 'all' });
  // Thời gian, cảnh báo, người bán, người tạo: dùng chung với sheet "Bộ lọc" (/don-hang/loc).
  const docFilters = useDocFilters((s) => s.filters);
  const term = useDebounced(search.trim(), 350);
  const active = kinds.includes(kind) ? kind : (kinds[0] ?? 'order');
  const filters: DocFilters = { ...filtersFor(active, docFilters), search: term, status: status[active] };
  const list = useDocList(active, filters, kinds.length > 0);
  const pull = usePullRefresh(list.refetch);
  const canCreate = canDo(user, 'orders:create') || canDo(user, 'invoices:create');

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
      onPeriod={(period) => setDocFilters({ period })}
      filterCount={docFilterCount(active, docFilters)}
      onOpenFilters={() => router.push({ pathname: '/don-hang/loc', params: { kind: KIND_SLUG[active] } } as never)}
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
      onCreate={canCreate ? createFromOrders : undefined}
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
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.card,
    borderWidth: 1.2,
    borderColor: '#D5DEE6',
  },
  filterOn: { backgroundColor: C.brand, borderColor: C.brand },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.brand,
  },
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
