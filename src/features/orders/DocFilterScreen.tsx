import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveRange } from '@/core/period';
import { useSession } from '@/core/session';
import { Button, C, Divider, MultiSelect, PeriodField, SheetHeader, type SelectOption } from '@/ui';
import { useStaff } from '../customers/api';
import { FormCard } from '../products/formParts';
import { setDocFilters, useDocFilters } from './filters';
import {
  alertsFor,
  DEFAULT_DOC_FILTERS,
  DOC_PERIODS,
  docFilterCount,
  kindFromSlug,
  type DocAlert,
  type DocKind,
  type DocListFilters,
  type DocPeriod,
} from './model';

export interface DocFilterViewProps {
  kind: DocKind;
  draft: DocListFilters;
  /** Nhân viên để chọn người bán / người tạo (`/users/for-filter`, như web). */
  staff: { items: { id: number; name: string }[]; loading: boolean };
  /** Tài khoản chỉ xem chứng từ mình tạo: backend bỏ qua lọc người tạo nên ẩn dòng này. */
  ownOnly: boolean;
  onChange: (patch: Partial<DocListFilters>) => void;
  onApply: () => void;
  onReset: () => void;
  onCancel?: () => void;
  now?: Date;
}

/**
 * Sheet lọc đơn đặt hàng / hóa đơn, theo sidebar lọc của web (`OrdersSidebar`, `InvoicesSidebar`):
 * cảnh báo, thời gian (hóa đơn: mua hàng + tạo), người tạo, người bán. Mỗi danh sách là 1 dòng chọn.
 */
export function DocFilterView(p: DocFilterViewProps) {
  const insets = useSafeAreaInsets();
  const count = docFilterCount(p.kind, p.draft);
  const invoice = p.kind === 'invoice';
  const defs = alertsFor(p.kind);
  const alertOptions: SelectOption<DocAlert>[] = defs.map((a) => ({
    value: a.value,
    label: a.label,
    icon: { name: a.icon, color: a.color, fill: a.fill },
  }));
  const shownAlerts = p.draft.alerts.filter((a) => defs.some((d) => d.value === a));
  // Giữ các cảnh báo chỉ có ở loại kia (vd "Hủy còn giao hàng" của hóa đơn) khi sửa ở loại này.
  const pickAlerts = (picked: DocAlert[]) =>
    p.onChange({ alerts: [...p.draft.alerts.filter((a) => !defs.some((d) => d.value === a)), ...picked] });
  const staff: SelectOption<number>[] = p.staff.items.map((u) => ({ value: u.id, label: u.name }));
  const staffHint = p.staff.loading ? 'Đang tải…' : staff.length ? 'Tất cả' : 'Chưa có dữ liệu';
  const staffOff = p.staff.loading || staff.length === 0;
  const period = (label: string, value: DocPeriod, onPick: (v: DocPeriod) => void) => (
    <PeriodField label={label} options={DOC_PERIODS} value={value} onChange={onPick} initialRange={resolveRange(value, p.now)} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title={invoice ? 'Lọc hóa đơn' : 'Lọc đặt hàng'} onCancel={p.onCancel} actionLabel="Áp dụng" onAction={p.onApply} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <FormCard
          title={invoice ? 'Cảnh báo hóa đơn' : 'Cảnh báo đơn hàng'}
          hint={`Chọn nhiều loại thì hiện ${invoice ? 'hóa đơn' : 'đơn'} có ít nhất 1 cảnh báo đã chọn.`}>
          <MultiSelect label="Cảnh báo" options={alertOptions} value={shownAlerts} onChange={pickAlerts} />
        </FormCard>

        <FormCard title="Thời gian">
          {invoice ? (
            <>
              {period('Thời gian mua hàng', p.draft.period, (v) => p.onChange({ period: v }))}
              <Divider />
              {period('Thời gian tạo', p.draft.createdPeriod, (v) => p.onChange({ createdPeriod: v }))}
            </>
          ) : (
            period('Thời gian', p.draft.period, (v) => p.onChange({ period: v }))
          )}
        </FormCard>

        <FormCard title="Nhân viên">
          {p.ownOnly ? null : (
            <>
              <MultiSelect
                label="Người tạo"
                options={staff}
                value={p.draft.creatorIds}
                onChange={(creatorIds) => p.onChange({ creatorIds })}
                placeholder={staffHint}
                disabled={staffOff}
              />
              <Divider />
            </>
          )}
          <MultiSelect
            label="Người bán"
            options={staff}
            value={p.draft.sellerIds}
            onChange={(sellerIds) => p.onChange({ sellerIds })}
            placeholder={staffHint}
            disabled={staffOff}
          />
        </FormCard>

        {count > 0 ? <Button title={`Xóa ${count} bộ lọc`} icon="x" variant="outline" size="medium" onPress={p.onReset} /> : null}
      </ScrollView>
    </View>
  );
}

export default function DocFilterScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = kindFromSlug(params.kind);
  const user = useSession((s) => s.user);
  const staff = useStaff(true);
  const [draft, setDraft] = useState(() => useDocFilters.getState().filters);
  return (
    <DocFilterView
      kind={kind}
      draft={draft}
      staff={{ items: staff.data ?? [], loading: staff.isLoading }}
      ownOnly={user?.canViewOtherStaffData === false}
      onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      // Thời gian chính có nút riêng trên danh sách (không tính vào số bộ lọc) nên giữ nguyên.
      onReset={() => setDraft((d) => ({ ...DEFAULT_DOC_FILTERS, period: d.period }))}
      onApply={() => {
        setDocFilters(draft);
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 18 },
});
