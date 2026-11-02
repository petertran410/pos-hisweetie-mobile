import { createContext, useContext } from 'react';
import { useCart, type CartActions, type CartState, type CartStore } from './cart';

/**
 * Giỏ mà các màn bán hàng (chọn hàng, sửa dòng, khách, giao hàng, giảm giá,
 * bảng giá, quét mã) đang đọc/ghi: giỏ của tab Bán hàng, hoặc đơn đặt hàng
 * đang xử lý ở tab Đơn hàng. Mỗi nơi có đường dẫn màn phụ riêng.
 */
export interface SaleScope {
  store: CartStore;
  /** Đang sửa đơn đặt hàng có sẵn (không nhớ bảng giá, không tạo đơn mới). */
  editing: boolean;
  paths: {
    /** Màn giỏ hàng / đơn đang sửa. */
    cart: string;
    customer: string;
    /** Có tham số `[rowId]`. */
    line: string;
    delivery: string;
    discount: string;
    priceBook: string;
    scan: string;
  };
}

export const SALES_SCOPE: SaleScope = {
  store: useCart,
  editing: false,
  paths: {
    cart: '/ban-hang/gio-hang',
    customer: '/ban-hang/khach-hang',
    line: '/ban-hang/dong/[rowId]',
    delivery: '/ban-hang/giao-hang',
    discount: '/ban-hang/giam-gia',
    priceBook: '/ban-hang/bang-gia',
    scan: '/ban-hang/quet-ma',
  },
};

const ScopeContext = createContext<SaleScope>(SALES_SCOPE);

export const SaleScopeProvider = ScopeContext.Provider;

export const useSaleScope = () => useContext(ScopeContext);

/** Đọc giỏ đang mở (theo phạm vi). */
export function useScopedCart<T>(selector: (s: CartState & CartActions) => T): T {
  // Đặt tên `use…` để React Compiler nhận ra đây là hook.
  const { store: useStore } = useSaleScope();
  return useStore(selector);
}
