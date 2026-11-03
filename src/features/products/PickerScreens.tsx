import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { money, qty } from '@/core/format';
import { errorMessage } from '@/core/http';
import { useSession } from '@/core/session';
import { useDebounced } from '@/core/useDebounced';
import { C, EmptyState, ErrorState, Icon, PressableScale, SearchField, SheetHeader, toast, Txt } from '@/ui';
import { Thumb } from '../sales/components';
import {
  createCategory,
  createTrademark,
  createUnit,
  useCategories,
  useComponentSearch,
  useTrademarks,
  useUnits,
  type NamedItem,
} from './api';
import { patchDraft, useProductDraft } from './draft';
import { CATEGORY_LEVELS, num, productPerms, toComponentFromProduct, type CategoryLevel, type RawComponentProduct } from './model';

/** So khớp không phân biệt hoa thường / dấu tiếng Việt. */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

export interface NamePickerViewProps {
  title: string;
  items: NamedItem[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  selected: string;
  /** Cho phép bỏ chọn (giá trị rỗng). */
  clearLabel?: string;
  onPick: (item: NamedItem | null) => void;
  /** Có quyền tạo mới thì hiện "+ Tạo …" khi tìm không thấy. */
  onCreate?: (name: string) => void;
  creating?: boolean;
}

/** Sheet chọn 1 tên trong danh mục (nhóm hàng, thương hiệu, đơn vị), có tìm và tạo mới. */
export function NamePickerView({ title, items, loading, error, onRetry, selected, clearLabel, onPick, onCreate, creating }: NamePickerViewProps) {
  const [search, setSearch] = useState('');
  const q = fold(search);
  const shown = q ? items.filter((it) => fold(it.name).includes(q)) : items;
  const exact = items.some((it) => fold(it.name) === q);
  const canCreate = !!onCreate && !!search.trim() && !exact;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title={title} cancelLabel="Đóng" />
      <View style={styles.search}>
        <SearchField value={search} onChangeText={setSearch} placeholder={`Tìm ${title.toLowerCase()}`} />
      </View>
      {loading ? (
        <ActivityIndicator color={C.brand} style={{ marginTop: 24 }} />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(it) => String(it.id)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={
            <>
              {canCreate ? (
                <PressableScale
                  onPress={() => onCreate?.(search.trim())}
                  disabled={creating}
                  accessibilityRole="button"
                  accessibilityLabel={`Tạo mới ${search.trim()}`}
                  scaleTo={0.98}
                  style={styles.row}>
                  {creating ? <ActivityIndicator color={C.brand} /> : <Icon name="circle-plus" size={20} color={C.brand} />}
                  <Txt variant="body" weight="semibold" color={C.brand} style={{ flex: 1 }} numberOfLines={1}>
                    Tạo mới “{search.trim()}”
                  </Txt>
                </PressableScale>
              ) : null}
              {clearLabel && selected && !q ? (
                <PressableScale onPress={() => onPick(null)} accessibilityRole="button" scaleTo={0.98} style={styles.row}>
                  <Icon name="circle-x" size={20} color={C.muted} />
                  <Txt variant="body" color={C.muted} style={{ flex: 1 }}>
                    {clearLabel}
                  </Txt>
                </PressableScale>
              ) : null}
            </>
          }
          ListEmptyComponent={
            canCreate ? undefined : (
              <EmptyState icon="search" color="slate" title="Không có kết quả" message={search ? `Không có mục nào khớp “${search}”.` : 'Danh mục đang trống.'} />
            )
          }
          renderItem={({ item }) => {
            const on = item.name === selected;
            return (
              <PressableScale
                onPress={() => onPick(item)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={item.name}
                scaleTo={0.98}
                style={styles.row}>
                <Txt variant="body" weight={on ? 'semibold' : 'regular'} color={on ? C.brand : C.text} style={{ flex: 1 }}>
                  {item.name}
                </Txt>
                {on ? <Icon name="check" size={20} color={C.brand} /> : null}
              </PressableScale>
            );
          }}
        />
      )}
    </View>
  );
}

const NAME_FIELD: Record<CategoryLevel, 'parentName' | 'middleName' | 'childName'> = {
  parent: 'parentName',
  middle: 'middleName',
  child: 'childName',
};

/** Hook dùng chung: tạo mới rồi chọn luôn mục vừa tạo. */
function useCreateAndPick(queryKey: unknown[], create: (name: string) => Promise<NamedItem>, pick: (item: NamedItem) => void) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const run = async (name: string) => {
    setCreating(true);
    try {
      const item = await create(name);
      await qc.invalidateQueries({ queryKey });
      toast.success(`Đã tạo “${item?.name ?? name}”`);
      pick({ id: item?.id ?? 0, name: item?.name ?? name });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCreating(false);
    }
  };
  return { creating, run };
}

export function CategoryPickerScreen() {
  const { level: raw } = useLocalSearchParams<{ level?: string }>();
  const level: CategoryLevel = raw === 'middle' || raw === 'child' ? raw : 'parent';
  const field = NAME_FIELD[level];
  const user = useSession((s) => s.user);
  const perms = productPerms(user);
  const selected = useProductDraft((s) => s.form?.[field] ?? '');
  const list = useCategories(level, perms.viewCategories);
  const pick = (item: NamedItem | null) => {
    patchDraft({ [field]: item?.name ?? '' });
    router.back();
  };
  const create = useCreateAndPick(['categories', level], (name) => createCategory(name, level), pick);
  const label = CATEGORY_LEVELS.find((l) => l.value === level)?.label ?? 'Nhóm hàng';
  return (
    <NamePickerView
      title={label}
      items={list.data ?? []}
      loading={list.isLoading}
      error={list.isError ? list.error : undefined}
      onRetry={() => void list.refetch()}
      selected={selected}
      clearLabel={`Bỏ chọn ${label.toLowerCase()}`}
      onPick={pick}
      onCreate={perms.createCategory ? (name) => void create.run(name) : undefined}
      creating={create.creating}
    />
  );
}

export function TrademarkPickerScreen() {
  const user = useSession((s) => s.user);
  const perms = productPerms(user);
  const selected = useProductDraft((s) => s.form?.tradeMark?.name ?? '');
  const list = useTrademarks(perms.viewTrademarks);
  const pick = (item: NamedItem | null) => {
    patchDraft({ tradeMark: item });
    router.back();
  };
  const create = useCreateAndPick(['trademarks'], createTrademark, pick);
  return (
    <NamePickerView
      title="Thương hiệu"
      items={list.data ?? []}
      loading={list.isLoading}
      error={list.isError ? list.error : undefined}
      onRetry={() => void list.refetch()}
      selected={selected}
      clearLabel="Bỏ chọn thương hiệu"
      onPick={pick}
      onCreate={perms.createTrademark ? (name) => void create.run(name) : undefined}
      creating={create.creating}
    />
  );
}

export function UnitPickerScreen() {
  const user = useSession((s) => s.user);
  const perms = productPerms(user);
  const selected = useProductDraft((s) => s.form?.unit ?? '');
  const list = useUnits(true);
  const pick = (item: NamedItem | null) => {
    patchDraft({ unit: item?.name ?? '' });
    router.back();
  };
  const create = useCreateAndPick(['units'], createUnit, pick);
  return (
    <NamePickerView
      title="Đơn vị tính"
      items={list.data ?? []}
      loading={list.isLoading}
      error={list.isError ? list.error : undefined}
      onRetry={() => void list.refetch()}
      selected={selected}
      onPick={(item) => (item ? pick(item) : undefined)}
      onCreate={perms.manageUnits ? (name) => void create.run(name) : undefined}
      creating={create.creating}
    />
  );
}

export interface ComponentPickerViewProps {
  title: string;
  search: string;
  onSearch: (s: string) => void;
  items: RawComponentProduct[];
  loading?: boolean;
  error?: unknown;
  added: number[];
  branchId: number | null;
  showCost: boolean;
  onPick: (p: RawComponentProduct) => void;
}

/** Sheet tìm hàng làm thành phần; bấm để thêm, thêm được nhiều lần liên tiếp. */
export function ComponentPickerView({ title, search, onSearch, items, loading, error, added, branchId, showCost, onPick }: ComponentPickerViewProps) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title={title} cancelLabel="Xong" />
      <View style={styles.search}>
        <SearchField value={search} onChangeText={onSearch} placeholder="Tìm mã, tên hàng" autoFocus />
      </View>
      {loading && !items.length ? (
        <ActivityIndicator color={C.brand} style={{ marginTop: 24 }} />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => String(p.id)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={<EmptyState icon="package-search" color="slate" title="Không tìm thấy hàng" message="Thử tìm bằng mã hoặc tên khác." />}
          renderItem={({ item }) => {
            const line = toComponentFromProduct(item, branchId, 0, 'piece');
            const inv = item.inventories?.find((i) => i.branchId === branchId);
            const done = added.includes(item.id);
            const sub = [
              item.code,
              showCost && line.cost !== null ? `Vốn ${money(line.cost)}` : null,
              inv ? `Tồn ${qty(num(inv.onHand))}${item.unit ? ` ${item.unit}` : ''}` : null,
            ].filter(Boolean);
            return (
              <PressableScale
                onPress={() => onPick(item)}
                disabled={done}
                accessibilityRole="button"
                accessibilityState={{ disabled: done }}
                accessibilityLabel={done ? `${item.name}, đã thêm` : `Thêm ${item.name}`}
                scaleTo={0.98}
                style={[styles.row, done ? { opacity: 0.55 } : null]}>
                <Thumb uri={line.image} size={44} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="body" weight="semibold" numberOfLines={2}>
                    {item.name}
                  </Txt>
                  <Txt variant="caption" color={C.muted} numeric numberOfLines={1}>
                    {sub.join(' · ')}
                  </Txt>
                </View>
                {done ? (
                  <Txt variant="caption" weight="semibold" color={C.muted}>
                    Đã thêm
                  </Txt>
                ) : (
                  <Icon name="circle-plus" size={24} color={C.brand} />
                )}
              </PressableScale>
            );
          }}
        />
      )}
    </View>
  );
}

export function ComponentPickerScreen() {
  const { formula } = useLocalSearchParams<{ formula?: string }>();
  const form = useProductDraft((s) => s.form);
  const productId = useProductDraft((s) => s.productId);
  const branchId = useSession((s) => s.branchId);
  const user = useSession((s) => s.user);
  const perms = productPerms(user);
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 300);
  const result = useComponentSearch(term, productId, !!form);
  const mfg = form?.type === 4;
  const target = mfg ? form?.formulas.find((f) => f.key === formula) : null;
  const added = (mfg ? target?.components : form?.components)?.map((c) => c.productId) ?? [];

  const pick = (p: RawComponentProduct) => {
    if (!form) return;
    if (mfg) {
      if (!target) return;
      const base = toComponentFromProduct(p, branchId, 0, 'gram');
      // Giống web: hàng tính theo chiếc / chưa có khối lượng thì nhập theo chiếc.
      const line = base.isPieceUnit || base.weightGrams <= 0 ? { ...base, inputMode: 'piece' as const, quantity: 1 } : base;
      patchDraft((f) => ({
        formulas: f.formulas.map((x) => (x.key === target.key ? { ...x, components: [...x.components, line] } : x)),
      }));
    } else {
      patchDraft((f) => ({ components: [...f.components, toComponentFromProduct(p, branchId, 1, 'gram')] }));
    }
    toast.success(`Đã thêm ${p.name}`);
  };

  return (
    <ComponentPickerView
      title={mfg ? 'Thêm nguyên liệu' : 'Thêm thành phần'}
      search={search}
      onSearch={setSearch}
      items={result.data ?? []}
      loading={result.isLoading || result.isFetching}
      error={result.isError ? result.error : undefined}
      added={added}
      branchId={branchId}
      showCost={perms.viewCost}
      onPick={pick}
    />
  );
}

const styles = StyleSheet.create({
  search: { padding: 16, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    backgroundColor: C.card,
  },
});
