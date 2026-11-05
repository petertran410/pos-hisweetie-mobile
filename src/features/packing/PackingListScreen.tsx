import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { money } from '@/core/format';
import { resolvePeriod } from '@/core/period';
import { useSession } from '@/core/session';
import { useDebounced } from '@/core/useDebounced';
import { usePullRefresh } from '@/core/usePullRefresh';
import {
  accents,
  accentSoft,
  C,
  ChipGroup,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  PageBackground,
  PeriodModal,
  periodText,
  pickFromSheet,
  PressableScale,
  radius,
  SearchField,
  Skeleton,
  TabPanel,
  TitleHeader,
  Txt,
} from '@/ui';
import { PERIOD_FILTERS } from '../orders/model';
import { useDeliveryOverview, usePackingList } from './api';
import { PackCard } from './components';
import { startPackDraft } from './draft';
import { setPackFilters, usePackFilters } from './filters';
import { newPackForm, PACK_TYPES, packFilterCount, packPerms, TYPE_FILTERS, type PackFilters, type PackPerms, type PackRow, type PackType } from './model';

const TYPE_ORDER = TYPE_FILTERS.map((t) => t.value);

/** Mở form tạo phiếu mới (chi nhánh mặc định là chi nhánh đang chọn). */
export function openNewPacking(type: PackType, branchId: number | null) {
  startPackDraft(newPackForm(type, branchId));
  router.push('/bao-don/phieu' as never);
}

function CreateTiles({ types, onCreate }: { types: PackType[]; onCreate: (t: PackType) => void }) {
  return (
    <View style={styles.tiles}>
      {types.map((t) => {
        const d = PACK_TYPES[t];
        return (
          <PressableScale
            key={t}
            onPress={() => onCreate(t)}
            accessibilityRole="button"
            accessibilityLabel={`Tạo phiếu ${d.label}`}
            scaleTo={0.95}
            style={[styles.tile, { backgroundColor: accentSoft[d.color] }]}>
            <Icon name={d.icon} size={22} color={accents[d.color]} />
            <Txt variant="label" weight="semibold" color={accents[d.color]} numberOfLines={1}>
              {d.label}
            </Txt>
          </PressableScale>
        );
      })}
    </View>
  );
}

function OverviewCard({ stats, loading, onPress }: { stats?: { total: number; delivered: number; pending: number }; loading?: boolean; onPress: () => void }) {
  const cells = [
    { label: 'Tổng đơn', value: stats?.total, color: C.text },
    { label: 'Đã giao', value: stats?.delivered, color: '#15803D' },
    { label: 'Chưa giao', value: stats?.pending, color: '#B45309' },
  ];
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Giao hàng hôm nay: ${stats?.pending ?? 0} đơn chưa giao. Bấm để xem`}
      scaleTo={0.985}
      style={styles.overview}>
      <View style={styles.overviewHead}>
        <Icon name="truck" size={18} color={C.brand} />
        <Txt variant="label" weight="semibold" style={{ flex: 1 }}>
          Giao hàng hôm nay
        </Txt>
        <Txt variant="label" weight="semibold" color={C.brand}>
          Đơn chờ giao
        </Txt>
        <Icon name="chevron-right" size={16} color={C.brand} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {cells.map((c) => (
          <View key={c.label} style={{ flex: 1, gap: 2 }}>
            <Txt variant="caption" color={C.muted}>
              {c.label}
            </Txt>
            {loading && c.value === undefined ? (
              <Skeleton width={40} height={20} />
            ) : (
              <Txt variant="heading" weight="bold" color={c.color} numeric>
                {money(c.value ?? 0)}
              </Txt>
            )}
          </View>
        ))}
      </View>
    </PressableScale>
  );
}

function ListSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, gap: 10 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.skeleton, { gap: 8 }]}>
          <Skeleton width="40%" height={15} />
          <Skeleton width="70%" height={15} />
          <Skeleton width="55%" height={12} />
        </View>
      ))}
    </View>
  );
}

export interface PackingListViewProps {
  perms: PackPerms;
  search: string;
  onSearch: (s: string) => void;
  filters: PackFilters;
  onType: (t: PackFilters['type']) => void;
  onPeriod: (p: PackFilters['period']) => void;
  onOpenFilters: () => void;
  onCreate: (t: PackType) => void;
  overview?: { stats?: { total: number; delivered: number; pending: number }; loading?: boolean; onPress: () => void };
  rows: PackRow[];
  total?: number;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  loadingMore?: boolean;
  onEndReached?: () => void;
  onOpen: (row: PackRow) => void;
  now?: Date;
}

/** Báo đơn: tạo nhanh 3 loại phiếu, đơn chờ giao hôm nay, danh sách phiếu (tìm, lọc loại, thời gian). */
export function PackingListView(p: PackingListViewProps) {
  const [periodOpen, setPeriodOpen] = useState(false);
  const count = packFilterCount(p.filters);
  const filtered = count > 0 || !!p.search || p.filters.type !== 'all';
  const period = periodText(PERIOD_FILTERS, p.filters.period, p.now);
  const create = p.perms.creatable.length
    ? () =>
        pickFromSheet(
          'Tạo báo đơn',
          p.perms.creatable.map((t) => ({ value: t, label: PACK_TYPES[t].label })),
          null,
          p.onCreate,
        )
    : undefined;

  const header = (
    <View style={{ gap: 12, paddingBottom: 10 }}>
      {p.perms.creatable.length ? <CreateTiles types={p.perms.creatable} onCreate={p.onCreate} /> : null}
      {p.overview ? <OverviewCard {...p.overview} /> : null}
      <View style={styles.summary}>
        <Txt variant="label" color={C.muted} style={{ flex: 1 }} numeric>
          {p.total !== undefined ? `${money(p.total)} phiếu` : ' '}
        </Txt>
        <PressableScale
          onPress={() => setPeriodOpen(true)}
          accessibilityLabel={`Thời gian: ${period}. Bấm để đổi`}
          scaleTo={0.95}
          style={styles.pill}>
          <Icon name="clock" size={15} color={C.brand} />
          <Txt variant="label" weight="semibold" color={C.brand} numeric>
            {period}
          </Txt>
          <Icon name="chevron-down" size={15} color={C.brand} />
        </PressableScale>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <PageBackground />
      <TitleHeader title="Báo đơn" right={create ? <IconButton icon="plus" label="Tạo báo đơn" onPress={create} tint={C.brand} /> : undefined}>
        {p.perms.list ? (
          <>
            <View style={styles.searchRow}>
              <SearchField value={p.search} onChangeText={p.onSearch} placeholder="Tìm mã báo đơn, ghi chú" style={{ flex: 1 }} />
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
            </View>
            <ChipGroup fill options={TYPE_FILTERS} value={p.filters.type} onChange={p.onType} />
          </>
        ) : null}
      </TitleHeader>

      {!p.perms.list ? (
        <View style={{ padding: 16, gap: 16 }}>
          {p.perms.creatable.length ? <CreateTiles types={p.perms.creatable} onCreate={p.onCreate} /> : null}
          <EmptyState icon="lock" color="slate" title="Chưa có quyền xem danh sách" message="Bạn vẫn tạo được phiếu. Nhờ quản trị viên cấp quyền “Xem báo đơn” để xem lại các phiếu đã tạo." />
        </View>
      ) : (
        <TabPanel value={p.filters.type} order={TYPE_ORDER} style={{ flex: 1 }}>
          {p.loading ? (
            <View style={{ gap: 12 }}>
              <View style={{ paddingHorizontal: 16 }}>{header}</View>
              <ListSkeleton />
            </View>
          ) : p.error ? (
            <ErrorState error={p.error} onRetry={p.onRetry} />
          ) : (
            <FlashList
              data={p.rows}
              keyExtractor={(r) => r.key}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 }}
              ListHeaderComponent={header}
              onEndReached={p.onEndReached}
              onEndReachedThreshold={0.4}
              refreshing={!!p.refreshing}
              onRefresh={p.onRefresh}
              keyboardDismissMode="on-drag"
              ListFooterComponent={p.loadingMore ? <ActivityIndicator color={C.brand} style={{ marginTop: 12 }} /> : null}
              ListEmptyComponent={
                <EmptyState
                  icon="clipboard-list"
                  color="slate"
                  title={filtered ? 'Không tìm thấy phiếu' : 'Chưa có phiếu nào'}
                  message={
                    p.search
                      ? `Không có phiếu nào khớp “${p.search}”.`
                      : filtered
                        ? 'Thử đổi loại phiếu, thời gian hoặc bỏ bớt bộ lọc.'
                        : p.filters.period === 'all'
                          ? 'Bấm “+” để tạo phiếu đóng hàng, loading hoặc giao hàng.'
                          : `Không có phiếu nào trong khoảng ${period.toLowerCase()}.`
                  }
                />
              }
              renderItem={({ item }) => (
                <View style={{ paddingBottom: 10 }}>
                  <PackCard row={item} onPress={() => p.onOpen(item)} now={p.now} />
                </View>
              )}
            />
          )}
        </TabPanel>
      )}

      <PeriodModal
        visible={periodOpen}
        title="Thời gian"
        options={PERIOD_FILTERS}
        value={p.filters.period}
        initialRange={resolvePeriod(p.filters.period, p.now)}
        onChange={(v) => {
          setPeriodOpen(false);
          p.onPeriod(v);
        }}
        onClose={() => setPeriodOpen(false)}
      />
    </View>
  );
}

export default function PackingListScreen() {
  const user = useSession((s) => s.user);
  const branchId = useSession((s) => s.branchId);
  const perms = packPerms(user);
  const filters = usePackFilters((s) => s.filters);
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 350);
  const effective = { ...filters, search: term };
  const list = usePackingList(effective, perms.list);
  const overview = useDeliveryOverview('today', '', perms.list);
  const pull = usePullRefresh(() => Promise.all([list.refetch(), overview.refetch()]));
  const pages = list.data?.pages ?? [];

  return (
    <PackingListView
      perms={perms}
      search={search}
      onSearch={setSearch}
      filters={filters}
      onType={(type) => setPackFilters({ type })}
      onPeriod={(period) => setPackFilters({ period })}
      onOpenFilters={() => router.push('/bao-don/loc' as never)}
      onCreate={(t) => openNewPacking(t, branchId)}
      overview={
        perms.list
          ? {
              stats: overview.data?.pages[0]?.stats,
              loading: overview.isLoading,
              onPress: () => router.push('/bao-don/cho-giao' as never),
            }
          : undefined
      }
      rows={pages.flatMap((pg) => pg.rows)}
      total={pages[0]?.total}
      loading={list.isLoading}
      error={list.isError ? list.error : undefined}
      onRetry={() => void list.refetch()}
      refreshing={pull.refreshing}
      onRefresh={pull.onRefresh}
      loadingMore={list.isFetchingNextPage}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
      }}
      onOpen={(row) => router.push({ pathname: '/bao-don/[type]/[id]', params: { type: row.type, id: String(row.id) } } as never)}
    />
  );
}

const styles = StyleSheet.create({
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
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 76, borderRadius: radius.card, paddingHorizontal: 6 },
  overview: { padding: 14, gap: 10, borderRadius: radius.card, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  overviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
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
  skeleton: { padding: 14, borderRadius: 16, backgroundColor: C.card },
});
