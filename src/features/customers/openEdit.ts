import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { errorMessage, http } from '@/core/http';
import { toast } from '@/ui';
import type { SaleCustomer } from '../sales/cart';
import { toSaleCustomer } from '../sales/mappers';
import { startCustomerDraft } from './draft';
import { toCustomerForm } from './form';
import type { RawCustomer } from './model';

/** Form sửa khách phủ lên trên màn đang làm (xem `CustomerEditStack`). */
export const EDIT_CUSTOMER_OVER_PATH = '/sua-khach/[id]';

/** Tải mới hồ sơ khách (cùng bộ nhớ đệm với màn chi tiết khách). */
const fetchFresh = (qc: QueryClient, id: number) =>
  qc.fetchQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const raw = await http.get<RawCustomer | null>(`/customers/${id}`);
      if (!raw) throw new Error('Không tìm thấy khách hàng');
      return raw;
    },
    staleTime: 0,
  });

/**
 * Sửa hồ sơ khách từ giỏ hàng, xử lý đơn hoặc chi tiết đơn. Tải hồ sơ mới
 * nhất rồi mở form; lưu xong gọi `onSaved` với thông tin khách mới để màn đó
 * cập nhật khách trên đơn đang làm.
 */
export function useCustomerEditor() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const open = async (id: number, onSaved?: (customer: SaleCustomer) => void) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const raw = await fetchFresh(qc, id);
      const afterSave = onSaved
        ? () => {
            fetchFresh(qc, id)
              .then((fresh) => onSaved(toSaleCustomer(fresh)))
              // Không tải lại được: đơn giữ thông tin cũ, hồ sơ khách vẫn đã lưu.
              .catch(() => undefined);
          }
        : null;
      startCustomerDraft(toCustomerForm(raw), id, 'customers', afterSave);
      router.push({ pathname: EDIT_CUSTOMER_OVER_PATH, params: { id: String(id) } } as never);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return { open, busy };
}
