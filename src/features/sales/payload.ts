import { cartTotals, type CartState } from './cart';
import { lineTotal } from './totals';

/** Lỗi trước khi gửi (đúng thứ tự kiểm tra của web). */
export function validateCheckout(cart: CartState, opts: { branchId: number | null; canPay: boolean }): string | null {
  const t = cartTotals(cart);
  if (!opts.branchId) return 'Vui lòng chọn chi nhánh trước khi bán hàng';
  if (!cart.customer) return 'Vui lòng chọn khách hàng';
  if (cart.lines.length === 0) return 'Giỏ hàng đang trống';
  if (!cart.payKind) return 'Vui lòng chọn hình thức thanh toán: chuyển khoản hoặc tiền mặt';
  if (cart.payKind === 'cash' && !(cart.cashAmount >= 0)) return 'Số tiền mặt không hợp lệ';
  const paid = opts.canPay ? cart.paidAmount : 0;
  if (paid > 0 && cart.payKind === 'transfer' && !cart.accountId) return 'Vui lòng chọn tài khoản nhận chuyển khoản';
  // Khách trả trước: hóa đơn chuyển khoản phải trả đủ (tính cả tiền khách đã gửi trước).
  if (cart.mode === 'invoice' && cart.payKind === 'transfer' && cart.customer.requireFullPayment) {
    const credit = Math.max(0, -(cart.customer.totalDebt ?? 0));
    if (paid + credit < t.total - 1) {
      return 'Khách này phải thanh toán đủ trước khi xuất hóa đơn. Nhập đủ số tiền khách trả hoặc chọn tiền mặt.';
    }
  }
  return null;
}

const totalWeight = (cart: CartState) =>
  Math.round(cart.lines.reduce((sum, l) => sum + (l.product.weightGrams ?? 0) * l.quantity, 0));

function deliveryOf(cart: CartState) {
  const d = cart.delivery;
  return {
    receiver: d.receiver,
    contactNumber: d.contactNumber,
    address: d.address,
    locationName: d.locationName || undefined,
    wardName: d.wardName || undefined,
    weight: totalWeight(cart),
    weightUnit: 'g',
    length: 10,
    width: 10,
    height: 10,
    noteForDriver: d.noteForDriver || undefined,
  };
}

function common(cart: CartState, ctx: { branchId: number; userId: number }) {
  const t = cartTotals(cart);
  const percent = cart.orderDiscount.type === 'percent' && cart.orderDiscount.value > 0;
  return {
    customerId: cart.customer?.id,
    branchId: ctx.branchId,
    soldById: ctx.userId,
    discountAmount: t.orderDiscount,
    discountRatio: percent ? Math.min(100, cart.orderDiscount.value) : 0,
    shippingFee: t.shipping,
    priceBookId: cart.priceBookId ?? 0,
    description: cart.note.trim() || undefined,
    // App chưa áp dụng khuyến mãi: báo rõ cho backend để không tự cộng khuyến mãi
    // mà người bán không thấy trên màn hình.
    skipPromotions: true,
  };
}

function payments(cart: CartState, paid: number) {
  if (paid <= 0 || !cart.payKind) return [];
  return [
    {
      method: cart.payKind,
      amount: paid,
      ...(cart.payKind === 'transfer' && cart.accountId ? { accountId: cart.accountId } : null),
    },
  ];
}

/** Body cho `POST /invoices/pos`. */
export function buildInvoicePayload(cart: CartState, ctx: { branchId: number; userId: number; paid: number; now?: Date }) {
  const pays = payments(cart, ctx.paid);
  return {
    ...common(cart, ctx),
    purchaseDate: (ctx.now ?? new Date()).toISOString(),
    paidAmount: ctx.paid,
    ...(pays.length ? { payments: pays } : null),
    ...(cart.payKind ? { paymentNoteType: cart.payKind, paymentType: cart.payKind } : null),
    items: cart.lines.map((l) => ({
      productId: l.product.id,
      productCode: l.product.code,
      productName: l.product.name,
      quantity: l.quantity,
      quantityUnit: 'base',
      conversionValueSnapshot: Math.max(1, l.product.conversionValue ?? 1),
      price: l.price,
      discount: l.discount,
      discountRatio: 0,
      totalPrice: lineTotal({ price: l.price, quantity: l.quantity, discount: { type: 'amount', value: l.discount } }),
      note: l.note,
      conditionType: 'normal',
      soldExpiryDate: null,
      enabledPromotionIds: [],
    })),
    delivery: deliveryOf(cart),
  };
}

/** Body cho `POST /orders` (đặt cọc ghi riêng qua `/order-payments`). */
export function buildOrderPayload(cart: CartState, ctx: { branchId: number; userId: number; paid: number; now?: Date }) {
  return {
    ...common(cart, ctx),
    orderDate: (ctx.now ?? new Date()).toISOString(),
    orderStatus: 'pending',
    depositAmount: ctx.paid,
    items: cart.lines.map((l) => ({
      productId: l.product.id,
      quantity: l.quantity,
      quantityUnit: 'base',
      conversionValueSnapshot: Math.max(1, l.product.conversionValue ?? 1),
      unitPrice: l.price,
      discount: l.discount,
      discountRatio: 0,
      note: l.note,
      conditionType: 'normal',
      soldExpiryDate: null,
      enabledPromotionIds: [],
    })),
    delivery: deliveryOf(cart),
  };
}

/** Ghi chú thanh toán sau khi tạo (tiền mặt kèm số tiền). */
export function paymentNoteOf(cart: CartState): { paymentType: string; amount?: number } | null {
  if (!cart.payKind) return null;
  return cart.payKind === 'cash' ? { paymentType: 'cash', amount: cart.cashAmount } : { paymentType: 'transfer' };
}
