import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/core/session';
import { Button, C, Divider, MultiSelect, Select, SheetHeader } from '@/ui';
import { useCategories, useTrademarks, type NamedItem } from './api';
import { setProductFilters, useProductFilters } from './filters';
import { FormCard } from './formParts';
import {
  activeFilterCount,
  CARGO_TYPES,
  CATEGORY_LEVELS,
  CONDITION_FILTERS,
  DEFAULT_FILTERS,
  PRODUCT_TYPES,
  productPerms,
  STOCK_FILTERS,
  type CategoryLevel,
  type ProductFilters,
} from './model';

const byName = (list: NamedItem[]) => list.map((c) => ({ value: c.name, label: c.name }));
const byId = (list: NamedItem[]) => list.map((c) => ({ value: c.id, label: c.name }));

const NAME_KEY: Record<CategoryLevel, 'parentNames' | 'middleNames' | 'childNames'> = {
  parent: 'parentNames',
  middle: 'middleNames',
  child: 'childNames',
};

const DIRECT_SALE = [
  { value: 'yes' as const, label: 'Có' },
  { value: 'no' as const, label: 'Không' },
];

/** Chữ hiện ở dòng chọn danh sách đang tải / rỗng. */
const listHint = (s: { items: NamedItem[]; loading: boolean }) => (s.loading ? 'Đang tải…' : s.items.length ? 'Tất cả' : 'Chưa có dữ liệu');

export interface ProductFilterViewProps {
  draft: ProductFilters;
  onChange: (patch: Partial<ProductFilters>) => void;
  categories?: Record<CategoryLevel, { items: NamedItem[]; loading: boolean }>;
  trademarks?: { items: NamedItem[]; loading: boolean };
  onApply: () => void;
  onReset: () => void;
  onCancel?: () => void;
}

/** Sheet bộ lọc hàng hóa (giống bộ lọc bên trái của web), gọn thành các dòng chọn. */
export function ProductFilterView({ draft, onChange, categories, trademarks, onApply, onReset, onCancel }: ProductFilterViewProps) {
  const insets = useSafeAreaInsets();
  const count = activeFilterCount(draft);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Bộ lọc" onCancel={onCancel} actionLabel="Áp dụng" onAction={onApply} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <FormCard title="Phân loại">
          <MultiSelect label="Loại sản phẩm" options={PRODUCT_TYPES} value={draft.types} onChange={(types) => onChange({ types })} />
          {categories
            ? CATEGORY_LEVELS.map((lv) => {
                const src = categories[lv.value];
                return (
                  <View key={lv.value}>
                    <Divider />
                    <MultiSelect
                      label={lv.label}
                      options={byName(src.items)}
                      value={draft[NAME_KEY[lv.value]]}
                      onChange={(names) => onChange({ [NAME_KEY[lv.value]]: names })}
                      placeholder={listHint(src)}
                      disabled={src.loading || src.items.length === 0}
                    />
                  </View>
                );
              })
            : null}
          {trademarks ? (
            <>
              <Divider />
              <MultiSelect
                label="Thương hiệu"
                options={byId(trademarks.items)}
                value={draft.tradeMarkIds}
                onChange={(tradeMarkIds) => onChange({ tradeMarkIds })}
                placeholder={listHint(trademarks)}
                disabled={trademarks.loading || trademarks.items.length === 0}
              />
            </>
          ) : null}
        </FormCard>

        <FormCard title="Tồn kho và bán hàng">
          <Select label="Tồn kho" options={STOCK_FILTERS} value={draft.stock} onChange={(stock) => onChange({ stock })} clearLabel="Tất cả" />
          <Divider />
          <Select
            label="Tình trạng tồn"
            options={CONDITION_FILTERS}
            value={draft.condition}
            onChange={(condition) => onChange({ condition })}
            clearLabel="Tất cả"
          />
          <Divider />
          <Select
            label="Bán trực tiếp"
            options={DIRECT_SALE}
            value={draft.directSale === null ? null : draft.directSale ? 'yes' : 'no'}
            onChange={(v) => onChange({ directSale: v === null ? null : v === 'yes' })}
            clearLabel="Tất cả"
          />
          <Divider />
          <Select
            label="Loại vận chuyển"
            options={CARGO_TYPES}
            value={draft.cargoType}
            onChange={(cargoType) => onChange({ cargoType })}
            clearLabel="Tất cả"
          />
        </FormCard>

        {count > 0 ? <Button title={`Xóa ${count} bộ lọc`} icon="x" variant="outline" size="medium" onPress={onReset} style={{ marginTop: 8 }} /> : null}
      </ScrollView>
    </View>
  );
}

export default function ProductFilterScreen() {
  const user = useSession((s) => s.user);
  const perms = productPerms(user);
  const [draft, setDraft] = useState(() => useProductFilters.getState().filters);
  const parent = useCategories('parent', perms.viewCategories);
  const middle = useCategories('middle', perms.viewCategories);
  const child = useCategories('child', perms.viewCategories);
  const marks = useTrademarks(perms.viewTrademarks);

  return (
    <ProductFilterView
      draft={draft}
      onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      categories={
        perms.viewCategories
          ? {
              parent: { items: parent.data ?? [], loading: parent.isLoading },
              middle: { items: middle.data ?? [], loading: middle.isLoading },
              child: { items: child.data ?? [], loading: child.isLoading },
            }
          : undefined
      }
      trademarks={perms.viewTrademarks ? { items: marks.data ?? [], loading: marks.isLoading } : undefined}
      onReset={() => setDraft((d) => ({ ...DEFAULT_FILTERS, status: d.status, sort: d.sort }))}
      onApply={() => {
        setProductFilters(draft);
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 18 },
});
