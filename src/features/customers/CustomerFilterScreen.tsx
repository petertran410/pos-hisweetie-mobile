import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolvePeriod } from '@/core/period';
import { useSession } from '@/core/session';
import { Button, C, Divider, MoneyField, MultiSelect, PeriodField, SheetHeader, Txt } from '@/ui';
import { FormCard, SwitchRow } from '../products/formParts';
import { useCustomerGroups } from './api';
import { setCustomerFilters, useCustomerFilters } from './filters';
import type { Named } from './form';
import { activeFilterCount, customerPerms, DEFAULT_FILTERS, PERIOD_OPTIONS, type CustomerFilters, type PeriodFilter } from './model';

/** Lọc theo thời gian: kỳ có sẵn hoặc khoảng ngày tự chọn. */
function PeriodSelect({ label, value, onChange }: { label: string; value: PeriodFilter; onChange: (p: PeriodFilter) => void }) {
  return <PeriodField label={label} options={PERIOD_OPTIONS} value={value} onChange={onChange} initialRange={resolvePeriod(value)} />;
}

function Range({
  title,
  from,
  to,
  onChange,
}: {
  title: string;
  from: number | null;
  to: number | null;
  onChange: (from: number | null, to: number | null) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="heading" style={{ marginTop: 6 }}>
        {title}
      </Txt>
      <View style={styles.range}>
        <View style={{ flex: 1 }}>
          <MoneyField label="Từ" value={from ?? 0} onChange={(n) => onChange(n || null, to)} placeholder="Không giới hạn" />
        </View>
        <View style={{ flex: 1 }}>
          <MoneyField label="Đến" value={to ?? 0} onChange={(n) => onChange(from, n || null)} placeholder="Không giới hạn" />
        </View>
      </View>
    </View>
  );
}

export interface CustomerFilterViewProps {
  draft: CustomerFilters;
  onChange: (patch: Partial<CustomerFilters>) => void;
  showDebt: boolean;
  groups?: { items: Named[]; loading: boolean };
  onApply: () => void;
  onReset: () => void;
  onCancel?: () => void;
}

/** Sheet bộ lọc khách hàng (giống bộ lọc bên trái của web), gọn thành các dòng chọn. */
export function CustomerFilterView({ draft, onChange, showDebt, groups, onApply, onReset, onCancel }: CustomerFilterViewProps) {
  const insets = useSafeAreaInsets();
  const count = activeFilterCount(draft, showDebt);
  const hasDebt = draft.debtFrom === 1 && draft.debtTo === null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Bộ lọc" onCancel={onCancel} actionLabel="Áp dụng" onAction={onApply} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <FormCard>
          {groups ? (
            <>
              <MultiSelect
                label="Nhóm khách hàng"
                options={groups.items.map((g) => ({ value: g.id, label: g.name }))}
                value={draft.groupIds}
                onChange={(groupIds) => onChange({ groupIds })}
                placeholder={groups.loading ? 'Đang tải…' : groups.items.length ? 'Tất cả' : 'Chưa có nhóm'}
                disabled={groups.loading || groups.items.length === 0}
              />
              <Divider />
            </>
          ) : null}
          <PeriodSelect label="Ngày tạo khách" value={draft.created} onChange={(created) => onChange({ created })} />
          <Divider />
          <PeriodSelect label="Có mua hàng trong" value={draft.lastTx} onChange={(lastTx) => onChange({ lastTx })} />
          {showDebt ? <Divider /> : null}
          {showDebt ? (
            <SwitchRow
              label="Chỉ khách đang nợ"
              value={hasDebt}
              onChange={(on) => onChange(on ? { debtFrom: 1, debtTo: null } : { debtFrom: null, debtTo: null })}
            />
          ) : null}
        </FormCard>

        <Range
          title="Tổng bán"
          from={draft.purchasedFrom}
          to={draft.purchasedTo}
          onChange={(purchasedFrom, purchasedTo) => onChange({ purchasedFrom, purchasedTo })}
        />

        {showDebt ? (
          <Range title="Công nợ" from={draft.debtFrom} to={draft.debtTo} onChange={(debtFrom, debtTo) => onChange({ debtFrom, debtTo })} />
        ) : null}

        {count > 0 ? (
          <Button title={`Xóa ${count} bộ lọc`} icon="x" variant="outline" size="medium" onPress={onReset} style={{ marginTop: 8 }} />
        ) : null}
      </ScrollView>
    </View>
  );
}

export default function CustomerFilterScreen() {
  const user = useSession((s) => s.user);
  const perms = customerPerms(user);
  const [draft, setDraft] = useState(() => useCustomerFilters.getState().filters);
  const groups = useCustomerGroups(perms.viewGroups);

  return (
    <CustomerFilterView
      draft={draft}
      onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      showDebt={perms.viewDebt}
      groups={perms.viewGroups ? { items: groups.data ?? [], loading: groups.isLoading } : undefined}
      onReset={() => setDraft((d) => ({ ...DEFAULT_FILTERS, status: d.status, sort: d.sort }))}
      onApply={() => {
        // Khoảng "từ" lớn hơn "đến" thì đổi chỗ cho đúng ý.
        const fix = (a: number | null, b: number | null): [number | null, number | null] => (a !== null && b !== null && a > b ? [b, a] : [a, b]);
        const [purchasedFrom, purchasedTo] = fix(draft.purchasedFrom, draft.purchasedTo);
        const [debtFrom, debtTo] = fix(draft.debtFrom, draft.debtTo);
        setCustomerFilters({ ...draft, purchasedFrom, purchasedTo, debtFrom, debtTo });
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 18 },
  range: { flexDirection: 'row', gap: 10 },
});
