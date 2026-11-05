import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDebounced } from '@/core/useDebounced';
import { C, EmptyState, ErrorState, Icon, LoadingState, PressableScale, SearchField, SheetHeader, toneColors, Txt } from '@/ui';
import { useCustomerGroups, useParentSearch, useStaff } from './api';
import { patchAddressDraft, patchCustomerDraft, useAddressDraft, useCustomerDraft } from './draft';
import type { Named } from './form';
import { fold, oldDistrictsOf, oldProvinces, oldWardsOf, PROVINCES, searchPlaces, wardsOf, type Place } from './locations';

interface Item {
  key: string;
  title: string;
  sub?: string | null;
  /** Dòng cần chú ý (chữ đậm, màu cam), vd "Thu tiền mặt 850.000". */
  note?: string | null;
}

/** Danh sách chọn có ô tìm (dùng chung cho các sheet chọn). */
export function PickList({
  title,
  placeholder,
  items,
  selected,
  onPick,
  search,
  onSearch,
  loading,
  error,
  onRetry,
  empty,
  action,
}: {
  title: string;
  placeholder: string;
  items: Item[];
  selected: readonly string[];
  onPick: (key: string) => void;
  search: string;
  onSearch: (t: string) => void;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty: string;
  /** Nút bên phải đầu sheet (vd "Xong" khi chọn nhiều). */
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title={title} actionLabel={action?.label} onAction={action?.onPress} />
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <SearchField value={search} onChangeText={onSearch} placeholder={placeholder} autoFocus={!action} />
      </View>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        <FlashList
          data={items}
          keyExtractor={(it) => it.key}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          ListEmptyComponent={<EmptyState icon="search" color="slate" title="Không có kết quả" message={empty} />}
          renderItem={({ item }) => {
            const on = selected.includes(item.key);
            return (
              <PressableScale
                onPress={() => onPick(item.key)}
                haptic="selection"
                accessibilityRole={action ? 'checkbox' : 'button'}
                accessibilityState={action ? { checked: on } : { selected: on }}
                accessibilityLabel={[item.title, item.sub, item.note].filter(Boolean).join(', ')}
                scaleTo={0.985}
                style={[styles.row, on ? styles.rowOn : null]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="body" weight={on ? 'semibold' : 'medium'} numberOfLines={2}>
                    {item.title}
                  </Txt>
                  {item.sub ? (
                    <Txt variant="caption" color={C.muted} numberOfLines={1}>
                      {item.sub}
                    </Txt>
                  ) : null}
                  {item.note ? (
                    <Txt variant="caption" weight="bold" color={toneColors.warning.fg} numeric numberOfLines={1}>
                      {item.note}
                    </Txt>
                  ) : null}
                </View>
                {on ? <Icon name="check" size={20} color={C.brand} strokeWidth={2.4} /> : null}
              </PressableScale>
            );
          }}
        />
      )}
    </View>
  );
}

function Missing({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title={title} />
      {children ?? <EmptyState icon="info" color="slate" title="Không có gì để chọn" message="Quay lại rồi mở lại màn này." />}
    </View>
  );
}

// ---------- Tỉnh / xã ----------

export function ProvincePickerScreen() {
  const current = useAddressDraft((s) => s.address?.newCityCode ?? null);
  const [search, setSearch] = useState('');
  return (
    <PickList
      title="Tỉnh / thành phố"
      placeholder="Tìm tỉnh, thành phố"
      items={searchPlaces(PROVINCES, search).map((p) => ({ key: p.code, title: p.name }))}
      selected={current ? [current] : []}
      search={search}
      onSearch={setSearch}
      empty="Thử gõ tên khác, ví dụ “Hồ Chí Minh”."
      onPick={(code) => {
        const p = PROVINCES.find((x) => x.code === code);
        if (p && p.code !== current) {
          patchAddressDraft({ newCityCode: p.code, newCityName: p.name, newWardCode: null, newWardName: null });
        }
        router.back();
      }}
    />
  );
}

export function WardPickerScreen() {
  const address = useAddressDraft((s) => s.address);
  const [search, setSearch] = useState('');
  if (!address?.newCityCode) {
    return (
      <Missing title="Phường / xã">
        <EmptyState icon="map-pin" color="slate" title="Chưa chọn tỉnh / thành" message="Chọn tỉnh / thành trước rồi mới chọn phường / xã." />
      </Missing>
    );
  }
  const wards = wardsOf(address.newCityCode);
  return (
    <PickList
      title="Phường / xã"
      placeholder={`Tìm trong ${address.newCityName ?? 'tỉnh đã chọn'}`}
      items={searchPlaces(wards, search).map((w) => ({ key: w.code, title: w.name }))}
      selected={address.newWardCode ? [address.newWardCode] : []}
      search={search}
      onSearch={setSearch}
      empty="Thử gõ tên khác (không cần dấu)."
      onPick={(code) => {
        const w = wards.find((x) => x.code === code);
        if (w) patchAddressDraft({ newWardCode: w.code, newWardName: w.name });
        router.back();
      }}
    />
  );
}

// ---------- Địa chỉ cũ (3 cấp) ----------

function OldPlacePicker({
  title,
  places,
  current,
  placeholder,
  onPick,
}: {
  title: string;
  places: Place[];
  current: string | null | undefined;
  placeholder: string;
  onPick: (p: Place) => void;
}) {
  const [search, setSearch] = useState('');
  return (
    <PickList
      title={title}
      placeholder={placeholder}
      items={searchPlaces(places, search).map((p) => ({ key: p.code, title: p.name }))}
      selected={current ? [String(current)] : []}
      search={search}
      onSearch={setSearch}
      empty="Thử gõ tên khác (không cần dấu)."
      onPick={(code) => {
        const p = places.find((x) => x.code === code);
        if (p) onPick(p);
        router.back();
      }}
    />
  );
}

export function OldProvincePickerScreen() {
  const current = useAddressDraft((s) => s.address?.cityCode ?? null);
  return (
    <OldPlacePicker
      title="Tỉnh / thành (cũ)"
      places={oldProvinces()}
      current={current}
      placeholder="Tìm tỉnh, thành phố"
      onPick={(p) => {
        if (p.code === current) return;
        patchAddressDraft({ cityCode: p.code, cityName: p.name, districtCode: null, districtName: null, wardCode: null, wardName: null });
      }}
    />
  );
}

export function DistrictPickerScreen() {
  const address = useAddressDraft((s) => s.address);
  if (!address?.cityCode) {
    return (
      <Missing title="Quận / huyện">
        <EmptyState icon="map-pin" color="slate" title="Chưa chọn tỉnh / thành cũ" message="Chọn tỉnh / thành trước rồi mới chọn quận / huyện." />
      </Missing>
    );
  }
  return (
    <OldPlacePicker
      title="Quận / huyện"
      places={oldDistrictsOf(address.cityCode)}
      current={address.districtCode}
      placeholder={`Tìm trong ${address.cityName ?? 'tỉnh đã chọn'}`}
      onPick={(p) => {
        if (p.code === address.districtCode) return;
        patchAddressDraft({ districtCode: p.code, districtName: p.name, wardCode: null, wardName: null });
      }}
    />
  );
}

export function OldWardPickerScreen() {
  const address = useAddressDraft((s) => s.address);
  if (!address?.cityCode || !address.districtCode) {
    return (
      <Missing title="Phường / xã (cũ)">
        <EmptyState icon="map-pin" color="slate" title="Chưa chọn quận / huyện" message="Chọn tỉnh / thành và quận / huyện trước." />
      </Missing>
    );
  }
  return (
    <OldPlacePicker
      title="Phường / xã (cũ)"
      places={oldWardsOf(address.cityCode, address.districtCode)}
      current={address.wardCode}
      placeholder={`Tìm trong ${address.districtName ?? 'quận / huyện đã chọn'}`}
      onPick={(p) => patchAddressDraft({ wardCode: p.code, wardName: p.name })}
    />
  );
}

// ---------- Nhóm khách (chọn nhiều) ----------

export function GroupPickerScreen() {
  const initial = useCustomerDraft((s) => s.form?.groups);
  const groups = useCustomerGroups(true);
  const [picked, setPicked] = useState<Named[]>(initial ?? []);
  const [search, setSearch] = useState('');
  if (!initial) return <Missing title="Nhóm khách hàng" />;
  const key = fold(search);
  const items = (groups.data ?? []).filter((g) => !key || fold(g.name).includes(key));
  return (
    <PickList
      title="Nhóm khách hàng"
      placeholder="Tìm nhóm"
      items={items.map((g) => ({ key: String(g.id), title: g.name }))}
      selected={picked.map((g) => String(g.id))}
      search={search}
      onSearch={setSearch}
      loading={groups.isLoading}
      error={groups.isError ? groups.error : undefined}
      onRetry={() => void groups.refetch()}
      empty="Chưa có nhóm khách hàng nào. Tạo nhóm trên web."
      action={{
        label: 'Xong',
        onPress: () => {
          patchCustomerDraft({ groups: picked });
          router.back();
        },
      }}
      onPick={(id) => {
        const g = groups.data?.find((x) => String(x.id) === id);
        if (!g) return;
        setPicked((list) => (list.some((x) => x.id === g.id) ? list.filter((x) => x.id !== g.id) : [...list, g]));
      }}
    />
  );
}

// ---------- Khách cha ----------

export function ParentPickerScreen() {
  const customerId = useCustomerDraft((s) => s.customerId);
  const current = useCustomerDraft((s) => s.form?.parent?.id ?? null);
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 300);
  const result = useParentSearch(term, customerId);
  return (
    <PickList
      title="Chọn khách cha"
      placeholder="Tên, mã hoặc số điện thoại"
      items={(result.data ?? []).map((c) => ({ key: String(c.id), title: c.name, sub: [c.code, c.phone].filter(Boolean).join(' · ') }))}
      selected={current ? [String(current)] : []}
      search={search}
      onSearch={setSearch}
      loading={result.isLoading}
      error={result.isError ? result.error : undefined}
      onRetry={() => void result.refetch()}
      empty="Chỉ chọn được khách đang hoạt động và chưa thuộc khách nào khác."
      onPick={(id) => {
        const c = result.data?.find((x) => String(x.id) === id);
        if (c) patchCustomerDraft({ parent: { id: c.id, code: c.code, name: c.name } });
        router.back();
      }}
    />
  );
}

// ---------- Sale PIC ----------

export function SalePicPickerScreen() {
  const current = useCustomerDraft((s) => s.form?.salePic?.id ?? null);
  const staff = useStaff(true);
  const [search, setSearch] = useState('');
  const key = fold(search);
  const items = (staff.data ?? []).filter((u) => !key || fold(u.name).includes(key));
  return (
    <PickList
      title="Sale PIC"
      placeholder="Tìm nhân viên"
      items={items.map((u) => ({ key: String(u.id), title: u.name }))}
      selected={current ? [String(current)] : []}
      search={search}
      onSearch={setSearch}
      loading={staff.isLoading}
      error={staff.isError ? staff.error : undefined}
      onRetry={() => void staff.refetch()}
      empty="Không có nhân viên nào khớp."
      onPick={(id) => {
        const u = staff.data?.find((x) => String(x.id) === id);
        if (u) patchCustomerDraft({ salePic: u });
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  rowOn: { borderColor: C.brand, borderWidth: 1.5 },
});
