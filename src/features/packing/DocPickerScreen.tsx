import { router } from 'expo-router';
import { useState } from 'react';
import { dateVN, money } from '@/core/format';
import { useDebounced } from '@/core/useDebounced';
import { toast } from '@/ui';
import { PickList } from '../customers/PickerScreens';
import { useDocCandidates } from './api';
import { addDocsToDraft, usePackDraft } from './draft';
import { PACK_TYPES, withDocs, type DocItem } from './model';

const keyOf = (d: { kind: string; id: number }) => `${d.kind}-${d.id}`;

/** Chọn nhiều hóa đơn / phiếu ký gửi cho phiếu đang nhập; bấm "Xong" để áp dụng. */
export default function DocPickerScreen() {
  const form = usePackDraft((s) => s.form);
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 300);
  const [picked, setPicked] = useState<Map<string, DocItem>>(() => new Map((form?.docs ?? []).map((d) => [keyOf(d), d])));
  const list = useDocCandidates(form?.type ?? 'giao-hang', form?.docMode ?? 'invoice', form?.branchId ?? null, term, !!form);
  const word = form?.docMode === 'consignment' ? 'phiếu ký gửi' : 'hóa đơn';
  const done = form ? PACK_TYPES[form.type].doneLabel : '';

  const items = (list.data ?? []).map((d) => ({
    key: keyOf(d),
    title: `${d.code}${d.customerName ? ` · ${d.customerName}` : ''}`,
    sub: [
      d.date ? dateVN(d.date) : null,
      d.payNote?.cash ? `Thu TM ${money(d.payNote.amount)}` : null,
      d.coldCount ? `Hàng lạnh ${d.coldCount}` : null,
      d.packingCount ? `${done} ${d.packingCount} lần` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  }));

  const apply = () => {
    if (!form) return router.back();
    // Bỏ những chứng từ đã bỏ chọn, rồi thêm chứng từ mới (kiểm tra cùng chi nhánh).
    usePackDraft.setState((st) => (st.form ? { form: withDocs(st.form, st.form.docs.filter((d) => picked.has(keyOf(d)))) } : {}));
    const fresh = [...picked.values()].filter((d) => !form.docs.some((x) => keyOf(x) === keyOf(d)));
    const res = addDocsToDraft(fresh);
    if (res.error) toast.error(res.error);
    router.back();
  };

  return (
    <PickList
      title={`Chọn ${word}`}
      placeholder="Tìm mã, tên khách"
      items={items}
      selected={[...picked.keys()]}
      onPick={(key) => {
        const hit = (list.data ?? []).find((d) => keyOf(d) === key);
        setPicked((cur) => {
          const next = new Map(cur);
          if (next.has(key)) next.delete(key);
          else if (hit) next.set(key, hit);
          return next;
        });
      }}
      search={search}
      onSearch={setSearch}
      loading={list.isLoading}
      error={list.isError ? list.error : undefined}
      onRetry={() => void list.refetch()}
      empty={term ? `Không có ${word} nào khớp “${term}”.` : `Chi nhánh này chưa có ${word} nào cần báo.`}
      action={{ label: picked.size ? `Xong (${picked.size})` : 'Xong', onPress: apply }}
    />
  );
}
