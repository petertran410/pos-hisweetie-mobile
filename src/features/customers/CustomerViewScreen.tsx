import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useOrderEditCart } from '../orders/editScope';
import { useCart } from '../sales/cart';
import { toSaleCustomer } from '../sales/mappers';
import { useCustomerDetail } from './api';
import CustomerDetailScreen from './CustomerDetailScreen';
import type { RawCustomer } from './model';

/**
 * Chi tiết khách mở từ giỏ hàng, màn xử lý đơn hoặc chi tiết chứng từ (ngăn
 * `/xem-khach`, xem `customerViewHref`). Mỗi lần hồ sơ khách tải lại (sửa hồ
 * sơ, địa chỉ, ghi chú, thu nợ...) thì cập nhật màn đã mở nó:
 * - giỏ bán hàng / đơn đang xử lý: thay khách trên giỏ để thẻ khách và địa chỉ
 *   giao hàng khớp (xem sang khách cha / con thì giỏ bỏ qua vì khác khách);
 * - chi tiết chứng từ: tải lại chứng từ khi hồ sơ khách đổi (lần tải đầu thì
 *   không, chứng từ vừa tải xong).
 */
export default function CustomerViewScreen() {
  const params = useLocalSearchParams<{ id: string; gio?: string }>();
  const qc = useQueryClient();
  const raw = useCustomerDetail(Number(params.id)).data;
  const seen = useRef<RawCustomer | undefined>(undefined);

  useEffect(() => {
    if (!raw) return;
    if (params.gio === 'chung-tu') {
      if (seen.current && seen.current !== raw) void qc.invalidateQueries({ queryKey: ['doc'] });
    } else {
      (params.gio === 'xu-ly' ? useOrderEditCart : useCart).getState().refreshCustomer(toSaleCustomer(raw));
    }
    seen.current = raw;
  }, [raw, params.gio, qc]);

  return <CustomerDetailScreen />;
}
