import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { money } from '@/core/format';
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
  pickFromSheet,
  PressableScale,
  SearchField,
  Skeleton,
  TabPanel,
  TitleHeader,
  toneColors,
  Txt,
} from '@/ui';
import { useCustomerList, useCustomerTotals } from './api';
import { CustomerCard } from './components';
import { NEW_CUSTOMER_PATH, startCustomerDraft } from './draft';
import { setCustomerFilters, useCustomerFilters } from './filters';
import { newCustomerForm } from './form';
import {
  activeFilterCount,
  customerPerms,
  SORTS,
  STATUS_FILTERS,
  type CustomerFilters,
  type CustomerPerms,
  type CustomerRow,
  type CustomerTotals,
  type SortKey,
  type StatusFilter,
} from './model';

const STATUS_ORDER = STATUS_FILTERS.map((s) => s.value);

function ListSkeleton() {
  return (
    <View style={{ gap: 10, paddingHorizontal: 16, paddingTop: 8 }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.skeleton}>
          <Skeleton width={44} height={44} radius={22} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" height={15} />
            <Skeleton width="40%" height={12} />
          </View>
          <Skeleton width={70} height={15} />
        </View>
      ))}
    </View>
  );
}

export interface CustomersViewProps {
  perms: CustomerPerms;
  search: string;
  onSearch: (s: string) => void;
  filters: CustomerFilters;
  onStatus: (s: StatusFilter) => void;
  onSort: (s: SortKey) => void;
  onOpenFilters: () => void;
  onCreate?: () => void;
  rows: CustomerRow[];
  totals?: CustomerTotals;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  loadingMore?: boolean;
  onEndReached?: () => void;
  onOpen: (row: CustomerRow) => void;
}

/** Danh sách khách hàng: tìm, lọc trạng thái, bộ lọc, sắp xếp, tổng nợ. */
export function CustomersView(p: CustomersViewProps) {
  const sorts = SORTS.filter((s) => !s.debt || p.perms.viewDebt);
  const sort = sorts.find((s) => s.value === p.filters.sort) ?? sorts[0];
  const count = activeFilterCount(p.filters, p.perms.viewDebt);
  const filtered = count > 0 || !!p.search;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <PageBackground />
      <TitleHeader
        title="Khách hàng"
        right={p.onCreate ? <IconButton icon="plus" label="Thêm khách hàng" onPress={p.onCreate} tint={C.brand} /> : undefined}>
        <View style={styles.searchRow}>
          <SearchField value={p.search} onChangeText={p.onSearch} placeholder="Tìm tên, mã, số điện thoại" style={{ flex: 1 }} />
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
        <ChipGroup fill options={STATUS_FILTERS} value={p.filters.status} onChange={p.onStatus} />
      </TitleHeader>

      <View style={styles.summary}>
        <View style={{ flex: 1, gap: 1 }}>
          <Txt variant="label" color={C.muted} numeric numberOfLines={1}>
            {p.totals ? `${money(p.totals.count)} khách hàng` : ' '}
          </Txt>
          {p.totals && p.perms.viewDebt && p.totals.totalDebt > 0 ? (
            <Txt variant="caption" weight="semibold" color={toneColors.danger.fg} numeric numberOfLines={1}>
              Tổng nợ {money(p.totals.totalDebt)}
            </Txt>
          ) : null}
        </View>
        <PressableScale
          onPress={() => pickFromSheet('Sắp xếp theo', sorts, p.filters.sort, p.onSort)}
          accessibilityLabel={`Sắp xếp: ${sort.label}. Bấm để đổi`}
          scaleTo={0.95}
          style={styles.sortBtn}>
          <Icon name="arrow-up-down" size={15} color={C.brand} />
          <Txt variant="label" weight="semibold" color={C.brand} numberOfLines={1}>
            {sort.label}
          </Txt>
        </PressableScale>
      </View>

      <TabPanel value={p.filters.status} order={STATUS_ORDER} style={{ flex: 1 }}>
        {p.loading ? (
          <ListSkeleton />
        ) : p.error ? (
          <ErrorState error={p.error} onRetry={p.onRetry} />
        ) : (
          <FlashList
            data={p.rows}
            keyExtractor={(r) => String(r.id)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 }}
            onEndReached={p.onEndReached}
            onEndReachedThreshold={0.4}
            refreshing={!!p.refreshing}
            onRefresh={p.onRefresh}
            keyboardDismissMode="on-drag"
            ListFooterComponent={p.loadingMore ? <ActivityIndicator color={C.brand} style={{ marginTop: 12 }} /> : null}
            ListEmptyComponent={
              <EmptyState
                icon="users"
                color="slate"
                title={filtered ? 'Không tìm thấy khách hàng' : 'Chưa có khách hàng'}
                message={
                  p.search
                    ? `Không có khách nào khớp “${p.search}”. Thử tìm bằng số điện thoại hoặc mã khách.`
                    : filtered
                      ? 'Không có khách nào khớp bộ lọc. Thử bỏ bớt điều kiện lọc.'
                      : 'Chưa có khách hàng nào ở trạng thái này.'
                }
              />
            }
            renderItem={({ item }) => (
              <View style={{ paddingBottom: 10 }}>
                <CustomerCard row={item} showDebt={p.perms.viewDebt} onPress={() => p.onOpen(item)} />
              </View>
            )}
          />
        )}
      </TabPanel>
    </View>
  );
}

export default function CustomersScreen() {
  const user = useSession((s) => s.user);
  const perms = customerPerms(user);
  const filters = useCustomerFilters((s) => s.filters);
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 350);
  const list = useCustomerList(term, filters, perms.viewDebt, perms.view);
  const totals = useCustomerTotals(term, filters, perms.viewDebt, perms.view);
  const pull = usePullRefresh(() => Promise.all([list.refetch(), totals.refetch()]));

  if (!perms.view) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <PageBackground />
        <TitleHeader title="Khách hàng" />
        <EmptyState icon="lock" color="slate" title="Chưa có quyền xem khách hàng" message="Nhờ quản trị viên cấp quyền “Xem khách hàng”." />
      </View>
    );
  }

  const pages = list.data?.pages ?? [];
  return (
    <CustomersView
      perms={perms}
      search={search}
      onSearch={setSearch}
      filters={filters}
      onStatus={(status) => setCustomerFilters({ status })}
      onSort={(sort) => setCustomerFilters({ sort })}
      onOpenFilters={() => router.push('/khach-hang/loc' as never)}
      onCreate={
        perms.create
          ? () => {
              startCustomerDraft(newCustomerForm());
              router.push(NEW_CUSTOMER_PATH as never);
            }
          : undefined
      }
      rows={pages.flatMap((pg) => pg.rows)}
      totals={totals.data}
      loading={list.isLoading}
      error={list.isError ? list.error : undefined}
      onRetry={() => void list.refetch()}
      refreshing={pull.refreshing}
      onRefresh={pull.onRefresh}
      loadingMore={list.isFetchingNextPage}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
      }}
      onOpen={(row) => router.push({ pathname: '/khach-hang/[id]', params: { id: String(row.id) } } as never)}
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
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: '#CFE3E6',
    maxWidth: '60%',
  },
  skeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
});
