import { describe, expect, it } from '@jest/globals';
import { changeDue, computeTotals, discountAmount, lineTotal } from '../totals';

describe('discountAmount', () => {
  it('giảm theo số tiền, không vượt quá giá gốc', () => {
    expect(discountAmount(100_000, { type: 'amount', value: 20_000 })).toBe(20_000);
    expect(discountAmount(100_000, { type: 'amount', value: 150_000 })).toBe(100_000);
  });

  it('giảm theo %, tối đa 100%', () => {
    expect(discountAmount(250_000, { type: 'percent', value: 10 })).toBe(25_000);
    expect(discountAmount(250_000, { type: 'percent', value: 150 })).toBe(250_000);
  });

  it('bỏ qua giá trị âm hoặc rỗng', () => {
    expect(discountAmount(100_000, { type: 'amount', value: -5 })).toBe(0);
    expect(discountAmount(100_000, undefined)).toBe(0);
  });
});

describe('computeTotals', () => {
  it('cộng thành tiền từng dòng rồi trừ giảm giá cả đơn', () => {
    const lines = [
      { price: 50_000, quantity: 2 },
      { price: 120_000, quantity: 1, discount: { type: 'amount' as const, value: 20_000 } },
      { price: 10_000, quantity: 2.5 },
    ];
    expect(lineTotal(lines[1])).toBe(100_000);
    const t = computeTotals(lines, { type: 'percent', value: 10 });
    expect(t.subtotal).toBe(225_000);
    expect(t.orderDiscount).toBe(22_500);
    expect(t.total).toBe(202_500);
    expect(t.itemCount).toBe(5.5);
  });

  it('giỏ trống thì mọi số bằng 0', () => {
    expect(computeTotals([])).toEqual({ itemCount: 0, subtotal: 0, orderDiscount: 0, total: 0 });
  });
});

describe('changeDue', () => {
  it('dương là tiền thừa, âm là khách còn nợ', () => {
    expect(changeDue(180_000, 200_000)).toBe(20_000);
    expect(changeDue(180_000, 100_000)).toBe(-80_000);
  });
});
