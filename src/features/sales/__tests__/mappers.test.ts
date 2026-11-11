import { describe, expect, it } from '@jest/globals';
import { toSaleCustomer } from '../mappers';

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
