import { describe, expect, it } from '@jest/globals';
import { EMPTY_CART, type CartState } from '../cart';
import { buildInvoicePayload, buildOrderPayload, paymentNoteOf, validateCheckout } from '../payload';

const product = { id: 7, code: 'SP007', name: 'Trà đen 1kg', basePrice: 120_000, unit: 'gói', weightGrams: 1000 };

const cart = (patch: Partial<CartState> = {}): CartState => ({
  ...EMPTY_CART,
  customer: { id: 3, code: 'KH003', name: 'Quán mẫu', totalDebt: 0, addresses: [] },
  lines: [{ rowId: 'a', product, quantity: 2, price: 120_000, discount: 20_000, note: '' }],
  delivery: { ...EMPTY_CART.delivery, receiver: 'Quán mẫu', contactNumber: '0900000000', address: '1 Đường A' },
  payKind: 'transfer',
  ...patch,
});

const ctx = { branchId: 1, userId: 9, paid: 0, now: new Date('2026-11-01T03:00:00Z') };

describe('validateCheckout', () => {
  it('đòi đủ chi nhánh, khách, hàng và hình thức thanh toán', () => {
    expect(validateCheckout(cart(), { branchId: null, canPay: true })).toMatch(/chi nhánh/);
    expect(validateCheckout(cart({ customer: null }), { branchId: 1, canPay: true })).toMatch(/khách hàng/);
    expect(validateCheckout(cart({ lines: [] }), { branchId: 1, canPay: true })).toMatch(/trống/);
    expect(validateCheckout(cart({ payKind: null }), { branchId: 1, canPay: true })).toMatch(/hình thức/);
    expect(validateCheckout(cart(), { branchId: 1, canPay: true })).toBeNull();
  });

  it('trả ngay bằng chuyển khoản phải chọn tài khoản nhận', () => {
    expect(validateCheckout(cart({ paidAmount: 50_000 }), { branchId: 1, canPay: true })).toMatch(/tài khoản/);
    expect(validateCheckout(cart({ paidAmount: 50_000, accountId: 2 }), { branchId: 1, canPay: true })).toBeNull();
  });

  it('khách trả trước: hóa đơn chuyển khoản phải trả đủ, tiền mặt thì không', () => {
    const c = { id: 3, code: 'KH003', name: 'Quán mẫu', totalDebt: 0, requireFullPayment: true, addresses: [] };
    expect(validateCheckout(cart({ mode: 'invoice', customer: c }), { branchId: 1, canPay: true })).toMatch(/thanh toán đủ/);
    expect(
      validateCheckout(cart({ mode: 'invoice', customer: c, paidAmount: 200_000, accountId: 2 }), {
        branchId: 1,
        canPay: true,
      }),
    ).toBeNull();
    expect(validateCheckout(cart({ mode: 'invoice', customer: c, payKind: 'cash' }), { branchId: 1, canPay: true })).toBeNull();
    // Tiền khách gửi trước (nợ âm) được tính vào.
    expect(
      validateCheckout(cart({ mode: 'invoice', customer: { ...c, totalDebt: -500_000 } }), { branchId: 1, canPay: true }),
    ).toBeNull();
  });
});

describe('buildInvoicePayload', () => {
  it('đúng tên trường của POST /invoices/pos', () => {
    const body = buildInvoicePayload(cart({ paidAmount: 200_000, accountId: 2 }), { ...ctx, paid: 200_000 });
    expect(body).toMatchObject({
      customerId: 3,
      branchId: 1,
      soldById: 9,
      priceBookId: 0,
      paidAmount: 200_000,
      payments: [{ method: 'transfer', amount: 200_000, accountId: 2 }],
      paymentNoteType: 'transfer',
      paymentType: 'transfer',
      skipPromotions: true,
      purchaseDate: '2026-11-01T03:00:00.000Z',
    });
    expect(body.items[0]).toMatchObject({
      productId: 7,
      productCode: 'SP007',
      productName: 'Trà đen 1kg',
      quantity: 2,
      price: 120_000,
      discount: 20_000,
      totalPrice: 200_000,
      enabledPromotionIds: [],
    });
    expect(body.delivery).toMatchObject({ receiver: 'Quán mẫu', address: '1 Đường A', weight: 2000, weightUnit: 'g' });
  });

  it('không trả trước thì không gửi danh sách thanh toán', () => {
    const body = buildInvoicePayload(cart(), ctx);
    expect('payments' in body).toBe(false);
    expect(body.paidAmount).toBe(0);
  });

  it('giảm % cả đơn gửi cả số tiền và tỉ lệ', () => {
    const body = buildInvoicePayload(cart({ orderDiscount: { type: 'percent', value: 10 } }), ctx);
    expect(body.discountRatio).toBe(10);
    expect(body.discountAmount).toBe(20_000);
  });
});

describe('buildOrderPayload', () => {
  it('dòng hàng dùng unitPrice, không có mã/tên/thành tiền', () => {
    const body = buildOrderPayload(cart(), { ...ctx, paid: 50_000 });
    expect(body).toMatchObject({ orderStatus: 'pending', depositAmount: 50_000, orderDate: '2026-11-01T03:00:00.000Z' });
    expect(body.items[0]).toMatchObject({ productId: 7, unitPrice: 120_000, discount: 20_000 });
    expect(body.items[0]).not.toHaveProperty('price');
    expect(body.items[0]).not.toHaveProperty('productCode');
  });
});

describe('paymentNoteOf', () => {
  it('tiền mặt kèm số tiền, chuyển khoản thì không', () => {
    expect(paymentNoteOf(cart({ payKind: 'cash', cashAmount: 300_000 }))).toEqual({ paymentType: 'cash', amount: 300_000 });
    expect(paymentNoteOf(cart())).toEqual({ paymentType: 'transfer' });
  });
});
