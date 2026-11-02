import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { money } from '@/core/format';
import { useDebounced } from '@/core/useDebounced';
import { Avatar, C, EmptyState, ErrorState, LoadingState, Pill, PressableScale, SearchField, SheetHeader, Txt } from '@/ui';
import { useCustomerSearch } from './api';
import type { SaleCustomer } from './cart';
import { useSalePerms } from './perms';
import { useSaleScope, useScopedCart } from './scope';

export function CustomerPickerView({
  search,
  onSearch,
  customers,
  loading,
  error,
  onRetry,
  selectedId,
  showDebt,
  onPick,
}: {
  search: string;
  onSearch: (t: string) => void;
  customers: SaleCustomer[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  selectedId?: number;
  showDebt: boolean;
  onPick: (c: SaleCustomer) => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Chọn khách hàng" />
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <SearchField value={search} onChangeText={onSearch} placeholder="Tên, mã hoặc số điện thoại" autoFocus />
      </View>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        <FlashList
          data={customers}
          keyExtractor={(c) => String(c.id)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              color="slate"
              title="Không tìm thấy khách"
              message="Thử tìm bằng số điện thoại hoặc mã khách. Khách mới hãy tạo trên web."
            />
          }
          renderItem={({ item }) => {
            const debt = item.totalDebt ?? 0;
            const on = item.id === selectedId;
            return (
              <PressableScale
                onPress={() => onPick(item)}
                haptic="selection"
                accessibilityLabel={`${item.name}${on ? ', đang chọn' : ''}`}
                scaleTo={0.98}
                style={[styles.row, on ? styles.rowOn : null]}>
                <Avatar name={item.name} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="body" weight="semibold" numberOfLines={1}>
                    {item.name}
                  </Txt>
                  <Txt variant="caption" color={C.muted} numberOfLines={1}>
                    {[item.code, item.contactNumber || item.phone].filter(Boolean).join(' · ')}
                  </Txt>
                  {item.parentName ? (
                    <Txt variant="caption" color={C.muted} numberOfLines={1}>
                      Thuộc: {item.parentName}
                    </Txt>
                  ) : null}
                </View>
                {showDebt && debt > 0 ? <Pill label={`Nợ ${money(debt)}`} tone="danger" /> : null}
              </PressableScale>
            );
          }}
        />
      )}
    </View>
  );
}

export default function CustomerPickerScreen() {
  const perms = useSalePerms();
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 300);
  const result = useCustomerSearch(term);
  const { store } = useSaleScope();
  const selectedId = useScopedCart((s) => s.customer?.id);

  if (!perms.customers) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SheetHeader title="Chọn khách hàng" />
        <EmptyState icon="lock" color="slate" title="Chưa có quyền xem khách hàng" message="Nhờ quản trị viên cấp quyền “Xem khách hàng”." />
      </View>
    );
  }

  return (
    <CustomerPickerView
      search={search}
      onSearch={setSearch}
      customers={result.data ?? []}
      loading={result.isLoading}
      error={result.isError ? result.error : undefined}
      onRetry={() => void result.refetch()}
      selectedId={selectedId}
      showDebt={perms.viewDebt}
      onPick={(c) => {
        store.getState().setCustomer(c);
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
    padding: 12,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  rowOn: { borderColor: C.brand, borderWidth: 1.5 },
});
