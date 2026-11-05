import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession, type Branch } from '@/core/session';
import { Button, C, Divider, MultiSelect, Select, SheetHeader } from '@/ui';
import { FormCard, SwitchRow, TextRow } from '../products/formParts';
import { setPackFilters, usePackFilters } from './filters';
import { packFilterCount, type PackFilters, type PayFilter } from './model';

/** Chừa chỗ bằng mũi tên ">" của các dòng chọn để giá trị các dòng thẳng một cột. */
const CHEVRON_GAP = <View style={{ width: 16 }} />;

const PAYS: { value: Exclude<PayFilter, 'all'>; label: string }[] = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'transfer', label: 'Chuyển khoản' },
];

export interface PackFilterViewProps {
  draft: PackFilters;
  /** Chi nhánh của tài khoản; hơn 1 thì cho lọc nhiều chi nhánh (giống web). */
  branches: Branch[];
  /** Chi nhánh đang chọn của app: lọc mặc định khi chưa chọn chi nhánh nào. */
  branchId: number | null;
  onChange: (patch: Partial<PackFilters>) => void;
  onApply: () => void;
  onReset: () => void;
  onCancel?: () => void;
}

/** Sheet lọc báo đơn: chi nhánh, mã hóa đơn, tên khách, thanh toán và cảnh báo tiền mặt (phiếu giao hàng). */
export function PackFilterView({ draft, branches, branchId, onChange, onApply, onReset, onCancel }: PackFilterViewProps) {
  const insets = useSafeAreaInsets();
  const count = packFilterCount(draft);
  // Chưa lọc chi nhánh = đang xem chi nhánh đang chọn: hiện tên và tick sẵn chi nhánh đó.
  const shownBranches = draft.branchIds.length ? draft.branchIds : branchId ? [branchId] : [];
  const pickBranches = (ids: number[]) =>
    onChange({ branchIds: ids.length === 0 || (ids.length === 1 && ids[0] === branchId) ? [] : ids });
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Bộ lọc" onCancel={onCancel} actionLabel="Áp dụng" onAction={onApply} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <FormCard>
          {branches.length > 1 ? (
            <>
              <MultiSelect
                label="Chi nhánh"
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
                value={shownBranches}
                onChange={pickBranches}
                placeholder="Chọn chi nhánh"
                clearLabel={null}
              />
              <Divider />
            </>
          ) : null}
          <TextRow label="Mã hóa đơn" value={draft.invoiceSearch} onChange={(invoiceSearch) => onChange({ invoiceSearch })} placeholder="VD: HD000123" autoCapitalize="characters" align="right" right={CHEVRON_GAP} />
          <Divider />
          <TextRow label="Tên khách" value={draft.customerSearch} onChange={(customerSearch) => onChange({ customerSearch })} placeholder="Tên khách hàng" align="right" right={CHEVRON_GAP} />
          <Divider />
          <Select
            label="Thanh toán"
            options={PAYS}
            value={draft.pay === 'all' ? null : draft.pay}
            onChange={(v) => onChange({ pay: v ?? 'all' })}
            clearLabel="Tất cả"
          />
        </FormCard>
        <FormCard title="Cảnh báo">
          <SwitchRow
            label="Chỉ phiếu lệch tiền mặt"
            sub="Phiếu giao hàng có tiền mặt cần thu khác hóa đơn"
            value={draft.cashWarning}
            onChange={(cashWarning) => onChange({ cashWarning })}
          />
        </FormCard>
        {count > 0 ? <Button title={`Xóa ${count} bộ lọc`} icon="x" variant="outline" size="medium" onPress={onReset} /> : null}
      </ScrollView>
    </View>
  );
}

export default function PackFilterScreen() {
  const branches = useSession((s) => s.branches);
  const branchId = useSession((s) => s.branchId);
  const [draft, setDraft] = useState(() => usePackFilters.getState().filters);
  return (
    <PackFilterView
      draft={draft}
      branches={branches}
      branchId={branchId}
      onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      onReset={() => setDraft((d) => ({ ...d, invoiceSearch: '', customerSearch: '', pay: 'all', branchIds: [], cashWarning: false }))}
      onApply={() => {
        setPackFilters({
          invoiceSearch: draft.invoiceSearch,
          customerSearch: draft.customerSearch,
          pay: draft.pay,
          branchIds: draft.branchIds,
          cashWarning: draft.cashWarning,
        });
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 18 },
});
