import { router } from 'expo-router';
import { useState } from 'react';
import { useDebounced } from '@/core/useDebounced';
import { PickList } from '../customers/PickerScreens';
import { useKhoCustomerSearch } from './api';
import { setKhoCustomers, useKhoDraft } from './draft';
import type { KhoCustomer } from './model';

/** Chọn khách hàng cho phiếu tiền mặt (chọn nhiều, giống web); bấm "Xong" để áp dụng. */
export default function KhoCustomerPickScreen() {
  const current = useKhoDraft((s) => s.form?.customers ?? []);
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 300);
  const [picked, setPicked] = useState<Map<number, KhoCustomer>>(() => new Map(current.map((c) => [c.id, c])));
  const list = useKhoCustomerSearch(term);
  // Chưa gõ tìm: hiện các khách đã chọn để bỏ bớt.
  const rows = term ? (list.data ?? []) : [...picked.values()];

  return (
    <PickList
      title="Chọn khách hàng"
      placeholder="Tìm tên hoặc mã khách"
      items={rows.map((c) => ({ key: String(c.id), title: c.name, sub: c.code }))}
      selected={[...picked.keys()].map(String)}
      onPick={(key) => {
        const id = Number(key);
        const hit = rows.find((c) => c.id === id);
        setPicked((cur) => {
          const next = new Map(cur);
          if (next.has(id)) next.delete(id);
          else if (hit) next.set(id, hit);
          return next;
        });
      }}
      search={search}
      onSearch={setSearch}
      loading={!!term && list.isLoading}
      error={list.isError ? list.error : undefined}
      onRetry={() => void list.refetch()}
      empty={term ? `Không có khách hàng nào khớp “${term}”.` : 'Gõ tên hoặc mã để tìm khách hàng.'}
      action={{
        label: picked.size ? `Xong (${picked.size})` : 'Xong',
        onPress: () => {
          setKhoCustomers([...picked.values()]);
          router.back();
        },
      }}
    />
  );
}
