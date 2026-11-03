import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/core/session';
import { Button, C, PressableScale, SheetHeader, Txt } from '@/ui';
import { useCategories, useTrademarks, type NamedItem } from './api';
import { ToggleChips } from './components';
import { setProductFilters, useProductFilters } from './filters';
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

/** Danh sách dài chỉ hiện vài mục đầu, bấm để xem hết. */
const PREVIEW = 12;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Txt variant="label" weight="semibold" color={C.muted}>
        {title}
      </Txt>
      {children}
    </View>
  );
}

/** Bỏ chọn nếu đã chọn, không thì thêm vào. */
const toggle = <T,>(list: readonly T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function LongChips<T extends string | number>({
  title,
  items,
  selected,
  onToggle,
  loading,
}: {
  title: string;
  items: { value: T; label: string }[];
  selected: readonly T[];
  onToggle: (v: T) => void;
  loading?: boolean;
}) {
  const [all, setAll] = useState(false);
  // Mục đã chọn luôn hiện, kể cả khi nằm ngoài phần xem trước.
  const shown = all ? items : items.filter((it, i) => i < PREVIEW || selected.includes(it.value));
  return (
    <Group title={title}>
      {loading ? (
        <ActivityIndicator color={C.brand} style={{ alignSelf: 'flex-start' }} />
      ) : items.length === 0 ? (
        <Txt variant="caption" color={C.faint}>
          Chưa có dữ liệu
        </Txt>
      ) : (
        <>
          <ToggleChips options={shown} selected={selected} onToggle={onToggle} label={title} />
          {items.length > shown.length || (all && items.length > PREVIEW) ? (
            <PressableScale onPress={() => setAll((v) => !v)} hitSlop={8} scaleTo={0.95} accessibilityRole="button">
              <Txt variant="label" weight="semibold" color={C.brand}>
                {all ? 'Thu gọn' : `Xem tất cả (${items.length})`}
              </Txt>
            </PressableScale>
          ) : null}
        </>
      )}
    </Group>
  );
}

const byName = (list: NamedItem[] | undefined) => (list ?? []).map((c) => ({ value: c.name, label: c.name }));
const byId = (list: NamedItem[] | undefined) => (list ?? []).map((c) => ({ value: c.id, label: c.name }));

const NAME_KEY: Record<CategoryLevel, 'parentNames' | 'middleNames' | 'childNames'> = {
  parent: 'parentNames',
  middle: 'middleNames',
  child: 'childNames',
};

export interface ProductFilterViewProps {
  draft: ProductFilters;
  onChange: (patch: Partial<ProductFilters>) => void;
  categories?: Record<CategoryLevel, { items: NamedItem[]; loading: boolean }>;
  trademarks?: { items: NamedItem[]; loading: boolean };
  onApply: () => void;
  onReset: () => void;
  onCancel?: () => void;
}

/** Sheet bộ lọc hàng hóa (giống bộ lọc bên trái của web). */
export function ProductFilterView({ draft, onChange, categories, trademarks, onApply, onReset, onCancel }: ProductFilterViewProps) {
  const insets = useSafeAreaInsets();
  const count = activeFilterCount(draft);
  const single = <K extends keyof ProductFilters>(key: K, value: ProductFilters[K]) =>
    onChange({ [key]: draft[key] === value ? null : value } as Partial<ProductFilters>);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Bộ lọc" onCancel={onCancel} actionLabel="Áp dụng" onAction={onApply} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <Group title="Loại sản phẩm">
          <ToggleChips
            options={PRODUCT_TYPES}
            selected={draft.types}
            onToggle={(t) => onChange({ types: toggle(draft.types, t) })}
            label="Loại sản phẩm"
          />
        </Group>

        {categories
          ? CATEGORY_LEVELS.map((lv) => (
              <LongChips
                key={lv.value}
                title={lv.label}
                items={byName(categories[lv.value].items)}
                loading={categories[lv.value].loading}
                selected={draft[NAME_KEY[lv.value]]}
                onToggle={(name) => onChange({ [NAME_KEY[lv.value]]: toggle(draft[NAME_KEY[lv.value]], name) })}
              />
            ))
          : null}

        {trademarks ? (
          <LongChips
            title="Thương hiệu"
            items={byId(trademarks.items)}
            loading={trademarks.loading}
            selected={draft.tradeMarkIds}
            onToggle={(id) => onChange({ tradeMarkIds: toggle(draft.tradeMarkIds, id) })}
          />
        ) : null}

        <Group title="Tồn kho">
          <ToggleChips
            options={STOCK_FILTERS}
            selected={draft.stock ? [draft.stock] : []}
            onToggle={(v) => single('stock', v)}
            label="Tồn kho"
          />
        </Group>
        <Group title="Tình trạng tồn">
          <ToggleChips
            options={CONDITION_FILTERS}
            selected={draft.condition ? [draft.condition] : []}
            onToggle={(v) => single('condition', v)}
            label="Tình trạng tồn"
          />
        </Group>
        <Group title="Bán trực tiếp">
          <ToggleChips
            options={[
              { value: 'yes', label: 'Có' },
              { value: 'no', label: 'Không' },
            ]}
            selected={draft.directSale === null ? [] : [draft.directSale ? 'yes' : 'no']}
            onToggle={(v) => single('directSale', v === 'yes')}
            label="Bán trực tiếp"
          />
        </Group>
        <Group title="Loại vận chuyển">
          <ToggleChips
            options={CARGO_TYPES}
            selected={draft.cargoType ? [draft.cargoType] : []}
            onToggle={(v) => single('cargoType', v)}
            label="Loại vận chuyển"
          />
        </Group>

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
  body: { padding: 16, gap: 22 },
  group: { gap: 10 },
});
