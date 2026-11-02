import { describe, expect, it } from '@jest/globals';
import {
  buildFromOrderPayload,
  defaultQuantities,
  draftTotals,
  hasShortfall,
  paymentNoteFor,
  toInvoiceDraft,
  validateDraft,
  type RawOrderForInvoice,
} from '../fromOrder';

const order: RawOrderForInvoice = {
  id: 7,
  code: 'DH000007',
  status: 5,
  branchId: 2,
  discount: '20000',
  discountRatio: '0',
  shippingFee: '30000',
  customer: { name: 'Quán A', code: 'KH01' },
  items: [
    { id: 11, productId: 1, productCode: 'SP1', productName: 'Trà', quantity: '4', price: '100000', discount: '10000', product: { unit: 'Gói' } },
    { id: 12, productId: 2, productCode: 'SP2', productName: 'Siro', quantity: '2', price: '50000', discount: '0', conditionType: 'near_expiry' },
    { id: 13, productId: 3, productCode: 'SP3', productName: 'Ly', quantity: '1', price: '0', discount: '0', isGift: true, lineType: 'gift', promotionId: 5 },
  ],
  payments: [{ amount: '100000', status: 1 }, { amount: '50000', status: 2 }],
  paymentNotes: [{ paymentType: 'transfer' }],
  invoices: [],
};

describe('toInvoiceDraft', () => {
  it('đơn chưa xuất hóa đơn: toàn bộ hàng, giảm giá, phí ship và tiền cọc còn hiệu lực', () => {
    const d = toInvoiceDraft(order);
    expect(d.lines.map((l) => [l.key, l.remaining])).toEqual([
      ['11', 4],
      ['12', 2],
      ['13', 1],
    ]);
    expect(d.lines[1].condition).toBe('near_expiry');
    expect(d.lines[2].gift).toBe(true);
    expect(d).toMatchObject({ remainingDiscount: 20000, remainingShipping: 30000, paidOnOrder: 100000, payKind: 'transfer', branchId: 2 });
  });

  it('đã có hóa đơn: trừ số đã xuất, giảm giá/phí ship đã dùng; tiền cọc không tính lại; bỏ qua hóa đơn đã hủy', () => {
    const d = toInvoiceDraft({
      ...order,
      invoices: [
        { status: 3, discount: '20000', shippingFee: '10000', details: [{ productId: 1, quantity: '3' }, { productId: 2, quantity: '2' }] },
        { status: 2, discount: '0', shippingFee: '30000', details: [{ productId: 3, quantity: '1' }] },
      ],
    });
    expect(d.lines.map((l) => [l.key, l.remaining])).toEqual([
      ['11', 1],
      ['13', 1],
    ]);
    expect(d).toMatchObject({ remainingDiscount: 0, remainingShipping: 20000, paidOnOrder: 0 });
  });
});

describe('tính tiền và gửi', () => {
  const d = toInvoiceDraft(order);
  const full = defaultQuantities(d);

  it('tổng tiền giống backend', () => {
    // (100k-10k)*4 + 50k*2 = 460k; giảm 20k; ship 30k → 470k; đã cọc 100k
    expect(draftTotals(d, full, 0)).toMatchObject({ subtotal: 460000, discount: 20000, shipping: 30000, total: 470000, left: 370000 });
    expect(draftTotals(d, full, 370000).left).toBe(0);
  });

  it('giảm theo %: tính trên tiền hàng của hóa đơn này và gửi % cho backend', () => {
    const p = toInvoiceDraft({ ...order, discountRatio: '10' });
    expect(draftTotals(p, full, 0).discount).toBe(46000);
    expect(buildFromOrderPayload(p, { qty: full, payKind: 'cash', cashAmount: 0, paidNow: 0 }, false)).toMatchObject({
      discountRatio: 10,
      discountAmount: 46000,
    });
  });

  it('không đổi số lượng: không gửi danh sách hàng, để backend tự lấy phần còn lại', () => {
    const body = buildFromOrderPayload(d, { qty: full, payKind: 'transfer', cashAmount: 0, paidNow: 0 }, false);
    expect(body).toEqual({
      additionalPayment: 0,
      payments: [],
      paymentNoteType: 'transfer',
      paymentType: 'transfer',
      forceComplete: false,
      skipPromotions: true,
    });
    expect(hasShortfall(d, full)).toBe(false);
  });

  it('xuất 1 phần: gửi đúng các dòng còn số lượng, giữ quà tặng và tình trạng hàng', () => {
    const qty = { ...full, '11': 2, '12': 0 };
    expect(hasShortfall(d, qty)).toBe(true);
    const body = buildFromOrderPayload(d, { qty, payKind: 'cash', cashAmount: 0, paidNow: 50000 }, true) as Record<string, unknown>;
    expect(body.forceComplete).toBe(true);
    expect(body.payments).toEqual([{ method: 'cash', amount: 50000 }]);
    expect(body.items).toEqual([
      expect.objectContaining({ productId: 1, quantity: 2, price: 100000, discount: 10000, totalPrice: 180000, conditionType: 'normal', isGift: false }),
      expect.objectContaining({ productId: 3, quantity: 1, lineType: 'gift', isGift: true, promotionId: 5 }),
    ]);
  });

  it('kiểm tra trước khi gửi', () => {
    expect(validateDraft(d, { qty: { '11': 0, '12': 0, '13': 0 }, payKind: 'cash', cashAmount: 0, paidNow: 0 })).toBe(
      'Chọn ít nhất 1 món để xuất hóa đơn',
    );
    expect(validateDraft(d, { qty: full, payKind: null, cashAmount: 0, paidNow: 0 })).toMatch('hình thức thanh toán');
    expect(validateDraft(d, { qty: full, payKind: 'transfer', cashAmount: 0, paidNow: 0 })).toBeNull();
  });

  it('ghi chú thanh toán', () => {
    expect(paymentNoteFor({ qty: full, payKind: 'cash', cashAmount: 370000, paidNow: 0 })).toEqual({ paymentType: 'cash', amount: 370000 });
    expect(paymentNoteFor({ qty: full, payKind: 'transfer', cashAmount: 0, paidNow: 0 })).toEqual({ paymentType: 'transfer' });
  });
});
