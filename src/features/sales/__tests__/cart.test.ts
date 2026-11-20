import { describe, expect, it } from '@jest/globals';
import {
  addressToDelivery,
  createCartStore,
  EMPTY_CART,
  refreshedCustomer,
  type CustomerAddress,
  type SaleCustomer,
  type SaleProduct,
} from '../cart';

describe('removeProduct', () => {
  it('bỏ mọi dòng của sản phẩm đó, giữ hàng khác', () => {
    const store = createCartStore();
    const tea: SaleProduct = { id: 1, code: 'TRA', name: 'Trà', basePrice: 50_000 };
    const milk: SaleProduct = { id: 2, code: 'SUA', name: 'Sữa', basePrice: 30_000 };
    const s = store.getState();
    s.add(tea, 50_000, 2);
    s.add(tea, 45_000, 1); // khác giá → dòng riêng
    s.add(milk, 30_000, 3);
    store.getState().removeProduct(tea.id);
    expect(store.getState().lines.map((l) => l.product.id)).toEqual([milk.id]);
  });
});

const home: CustomerAddress = { id: 1, receiver: 'Chị Lan', contactNumber: '0900', address: '12 Lê Lợi', isDefault: true };
const lan: SaleCustomer = { id: 7, code: 'KH7', name: 'Chị Lan', contactNumber: '0900', addresses: [home] };
const moved: SaleCustomer = { ...lan, name: 'Chị Lan (Q1)', addresses: [{ ...home, address: '99 Hai Bà Trưng' }] };

describe('refreshedCustomer', () => {
  it('giao hàng còn theo địa chỉ cũ: lấy lại theo địa chỉ mới, giữ ghi chú tài xế', () => {
    const delivery = { ...addressToDelivery(lan), noteForDriver: 'Gọi trước' };
    const next = refreshedCustomer({ customer: lan, delivery }, moved);
    expect(next?.customer).toBe(moved);
    expect(next?.delivery).toMatchObject({ address: '99 Hai Bà Trưng', noteForDriver: 'Gọi trước' });
  });

  it('giao hàng đã tự sửa: giữ nguyên, chỉ thay thông tin khách', () => {
    const delivery = { ...addressToDelivery(lan), address: 'Kho chị Lan' };
    const next = refreshedCustomer({ customer: lan, delivery }, moved);
    expect(next?.customer).toBe(moved);
    expect(next?.delivery).toBe(delivery);
  });

  it('đơn đã đổi sang khách khác hoặc chưa có khách: bỏ qua', () => {
    expect(refreshedCustomer({ customer: { ...lan, id: 8 }, delivery: EMPTY_CART.delivery }, moved)).toBeNull();
    expect(refreshedCustomer({ customer: null, delivery: EMPTY_CART.delivery }, moved)).toBeNull();
  });
});
