import type { ComponentType } from 'react';
import { create } from 'zustand';
import { createCartStore, type CartState } from '../sales/cart';
import { SaleScopeProvider, type SaleScope } from '../sales/scope';
import type { OrderEditMeta } from './editOrder';

/** Giỏ riêng của đơn đang xử lý (không đụng giỏ của tab Bán hàng). */
export const useOrderEditCart = createCartStore();

/** Thông tin đơn đang xử lý; null khi chưa mở đơn nào. */
export const useOrderEditMeta = create<{ meta: OrderEditMeta | null }>(() => ({ meta: null }));

export const ORDER_EDIT_PATH = '/don-hang/xu-ly';
export const ORDER_EDIT_PICKER = '/don-hang/xu-ly/them-hang';

export const ORDER_EDIT_SCOPE: SaleScope = {
  store: useOrderEditCart,
  editing: true,
  paths: {
    cart: ORDER_EDIT_PATH,
    customer: '/don-hang/xu-ly/khach-hang',
    line: '/don-hang/xu-ly/dong/[rowId]',
    delivery: '/don-hang/xu-ly/giao-hang',
    discount: '/don-hang/xu-ly/giam-gia',
    priceBook: '/don-hang/xu-ly/bang-gia',
    scan: '/don-hang/xu-ly/quet-ma',
  },
};

/** Nạp đơn vừa tải vào giỏ xử lý đơn. */
export function startOrderEdit(cart: CartState, meta: OrderEditMeta) {
  useOrderEditCart.getState().load(cart);
  useOrderEditMeta.setState({ meta });
}

/** Cho 1 màn bán hàng (chọn khách, sửa dòng...) làm việc trên đơn đang xử lý. */
export function withOrderEdit<P extends object>(Screen: ComponentType<P>) {
  function OrderEditScoped(props: P) {
    return (
      <SaleScopeProvider value={ORDER_EDIT_SCOPE}>
        <Screen {...props} />
      </SaleScopeProvider>
    );
  }
  return OrderEditScoped;
}
