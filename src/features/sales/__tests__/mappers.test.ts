import { describe, expect, it } from '@jest/globals';
import { toPriceHistoryRow, toSaleCustomer } from '../mappers';

describe('toPriceHistoryRow', () => {
  it('đổi số Decimal, lấy giá sau giảm của backend', () => {
    expect(
      toPriceHistoryRow({ code: 'HD01', date: '2026-07-04T03:00:00.000Z', price: '61000', discount: '1600', quantity: '2400', finalPrice: 59400 }),
    ).toEqual({ code: 'HD01', date: '2026-07-04T03:00:00.000Z', finalPrice: 59400, discount: 1600, quantity: 2400 });
  });

  it('thiếu giá sau giảm thì tự tính giá − giảm', () => {
    expect(toPriceHistoryRow({ code: 'HD02', price: 50000, discount: 5000, quantity: 1 }).finalPrice).toBe(45000);
  });
});

describe('toSaleCustomer', () => {
  it('chuyển khách vừa tạo thành khách của giỏ hàng, giữ chính sách trả trước và địa chỉ', () => {
    expect(
      toSaleCustomer({
        id: 12,
        code: 'KH0012',
        name: 'Quán Mới',
        contactNumber: '0900000012',
        totalDebt: '0',
        debtPolicy: { isActive: true, requireFullPaymentForInvoice: true },
        addresses: [
          {
            id: 31,
            receiver: 'Chị Mai',
            contactNumber: '0900000012',
            address: '12 Lê Lợi',
            newWardName: 'Phường Bến Thành',
            newCityName: 'TP Hồ Chí Minh',
            isDefault: true,
          },
        ],
      }),
    ).toMatchObject({
      id: 12,
      code: 'KH0012',
      name: 'Quán Mới',
      totalDebt: 0,
      requireFullPayment: true,
      addresses: [{ id: 31, address: '12 Lê Lợi', isDefault: true }],
    });
  });
});
