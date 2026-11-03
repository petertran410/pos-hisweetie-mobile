import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, StyleSheet, View } from 'react-native';
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
  PressableScale,
  SearchField,
  Skeleton,
  SubHeader,
  TabPanel,
  Txt,
} from '@/ui';
import { useProductList } from './api';
import { ProductCard } from './components';
import { NEW_PRODUCT_PATH, startDraft } from './draft';
import { setProductFilters, useProductFilters } from './filters';
import { newForm } from './form';
import {
  activeFilterCount,
  PRODUCT_TYPES,
  productPerms,
  SORTS,
  STATUS_FILTERS,
  type ProductFilters,
  type ProductPerms,
  type ProductRow,
  type ProductType,
  type SortKey,
  type StatusFilter,
} from './model';

const STATUS_ORDER = STATUS_FILTERS.map((s) => s.value);

/** Bảng chọn kiểu iOS; mục đang chọn có dấu ✓. */
function pickFromSheet<T>(title: string, items: { value: T; label: string }[], current: T | null, onPick: (v: T) => void) {
  const labels = items.map((it) => (it.value === current ? `✓ ${it.label}` : it.label));
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions({ title, options: [...labels, 'Hủy'], cancelButtonIndex: labels.length }, (i) => {
      if (i < items.length) onPick(items[i].value);
    });
    return;
  }
  Alert.alert(title, undefined, [
    ...items.map((it, i) => ({ text: labels[i], onPress: () => onPick(it.value) })),
    { text: 'Hủy', style: 'cancel' as const },
  ]);
}

/** Hỏi loại hàng muốn thêm rồi mở form. */
export function pickNewType(onPick: (t: ProductType) => void) {
  pickFromSheet('Thêm hàng hóa', PRODUCT_TYPES, null, onPick);
}

function ListSkeleton() {
  return (
    <View style={{ gap: 10, paddingHorizontal: 16, paddingTop: 8 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.skeleton]}>
          <Skeleton width={60} height={60} radius={12} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="35%" height={12} />
            <Skeleton width="80%" height={15} />
            <Skeleton width="50%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export interface ProductsViewProps {
  perms: ProductPerms;
  search: string;
  onSearch: (s: string) => void;
  filters: ProductFilters;
  onStatus: (s: StatusFilter) => void;
  onSort: (s: SortKey) => void;
  onOpenFilters: () => void;
  onCreate?: () => void;
  rows: ProductRow[];
  total?: number;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  loadingMore?: boolean;
  onEndReached?: () => void;
  onOpen: (row: ProductRow) => void;
}

/** Danh sách hàng hóa: tìm, lọc trạng thái, bộ lọc, sắp xếp. */
export function ProductsView(p: ProductsViewProps) {
  const sorts = SORTS.filter((s) => !s.cost || p.perms.viewCost);
  const sort = sorts.find((s) => s.value === p.filters.sort) ?? sorts[0];
  const count = activeFilterCount(p.filters);
  const filtered = count > 0 || !!p.search;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <PageBackground />
      <SubHeader
        title="Hàng hóa"
        right={p.onCreate ? <IconButton icon="plus" label="Thêm hàng hóa" onPress={p.onCreate} tint={C.brand} /> : undefined}>
        <View style={styles.searchRow}>
          <SearchField value={p.search} onChangeText={p.onSearch} placeholder="Tìm mã, tên hàng" style={{ flex: 1 }} />
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
      </SubHeader>

      <View style={styles.summary}>
        <Txt variant="label" color={C.muted} style={{ flex: 1 }} numeric>
          {p.total !== undefined ? `${money(p.total)} hàng hóa` : ' '}
        </Txt>
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
                icon="package-search"
                color="slate"
                title={filtered ? 'Không tìm thấy hàng hóa' : 'Chưa có hàng hóa'}
                message={
                  p.search
                    ? `Không có hàng hóa nào khớp “${p.search}”.`
                    : filtered
                      ? 'Không có hàng hóa nào khớp bộ lọc. Thử bỏ bớt điều kiện lọc.'
                      : 'Chưa có hàng hóa nào ở trạng thái này.'
                }
              />
            }
            renderItem={({ item }) => (
              <View style={{ paddingBottom: 10 }}>
                <ProductCard row={item} showSale={p.perms.viewSale} showCost={p.perms.viewCost} onPress={() => p.onOpen(item)} />
              </View>
            )}
          />
        )}
      </TabPanel>
    </View>
  );
}

export default function ProductsScreen() {
  const user = useSession((s) => s.user);
  const perms = productPerms(user);
  const filters = useProductFilters((s) => s.filters);
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 350);
  const list = useProductList(term, filters, perms.viewCost, perms.view);
  const pull = usePullRefresh(list.refetch);

  if (!perms.view) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <PageBackground />
        <SubHeader title="Hàng hóa" />
        <EmptyState icon="lock" color="slate" title="Chưa có quyền xem hàng hóa" message="Nhờ quản trị viên cấp quyền “Xem sản phẩm”." />
      </View>
    );
  }

  const pages = list.data?.pages ?? [];
  return (
    <ProductsView
      perms={perms}
      search={search}
      onSearch={setSearch}
      filters={filters}
      onStatus={(status) => setProductFilters({ status })}
      onSort={(sort) => setProductFilters({ sort })}
      onOpenFilters={() => router.push('/hang-hoa/loc' as never)}
      onCreate={
        perms.create
          ? () =>
              pickNewType((type) => {
                startDraft(newForm(type));
                router.push(NEW_PRODUCT_PATH as never);
              })
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
      onOpen={(row) => router.push({ pathname: '/hang-hoa/[id]', params: { id: String(row.id) } } as never)}
    />
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
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
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
});
