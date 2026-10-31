/** Giảm giá: theo số tiền hoặc theo %. */
export interface Discount {
  type: 'amount' | 'percent';
  value: number;
}

export const NO_DISCOUNT: Discount = { type: 'amount', value: 0 };

/** Số tiền được giảm (không âm, không vượt quá `base`). */
export function discountAmount(base: number, d: Discount | undefined): number {
  if (!d || !(d.value > 0) || !(base > 0)) return 0;
  const raw = d.type === 'percent' ? (base * Math.min(d.value, 100)) / 100 : d.value;
  return Math.round(Math.min(raw, base));
}

export interface LineInput {
  price: number;
  quantity: number;
  discount?: Discount;
}

/** Thành tiền 1 dòng = (đơn giá − giảm/đơn vị) × số lượng. */
export function lineUnitDiscount(line: LineInput): number {
  return discountAmount(line.price, line.discount);
}

export function lineTotal(line: LineInput): number {
  const unit = Math.max(0, line.price - lineUnitDiscount(line));
  return Math.round(unit * line.quantity);
}

export interface Totals {
  /** Tổng số lượng hàng. */
  itemCount: number;
  /** Tổng tiền hàng (sau giảm từng dòng). */
  subtotal: number;
  /** Giảm giá cả đơn. */
  orderDiscount: number;
  /** Khách cần trả. */
  total: number;
}

export function computeTotals(lines: LineInput[], orderDiscount?: Discount): Totals {
  const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const off = discountAmount(subtotal, orderDiscount);
  return { itemCount, subtotal, orderDiscount: off, total: Math.max(0, subtotal - off) };
}

/** Tiền thừa trả khách (dương) hoặc còn nợ (âm). */
export function changeDue(total: number, paid: number): number {
  return Math.round(paid - total);
}
