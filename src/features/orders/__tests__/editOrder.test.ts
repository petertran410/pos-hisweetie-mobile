import { describe, expect, it } from '@jest/globals';
import {
  buildInvoiceUpdate,
  buildOrderUpdate,
  editChanges,
  editPaymentNote,
  hasOrderFields,
  invoiceEditProblem,
  toInvoiceEdit,
  toOrderEdit,
  validateOrderEdit,
  type RawInvoiceForEdit,
  type RawOrderForEdit,
} from '../editOrder';

const raw = (over: Partial<RawOrderForEdit> = {}): RawOrderForEdit => ({
  id: 7,
  code: 'DH000007',
  status: 5,
  branchId: 1,
  updatedAt: '2026-11-01T10:00:00.000Z',
  customer: { id: 3, code: 'KH03', name: 'Chị Lan', contactNumber: '0900', addresses: [] },
  priceBookId: 2,
  priceBookName: 'Giá sỉ',
  discount: '10000',
  discountRatio: '0',
  shippingFee: '30000',
  description: 'Giao sáng',
  items: [
    {
      id: 11,
      productId: 100,
      productCode: 'SIRO',
      productName: 'Siro dâu',
      quantity: '2',
      quantityUnit: 'carton',
      conversionValueSnapshot: '12',
      price: '50000',
      discount: '5000',
      discountRatio: '0',
      note: null,
      conditionType: 'normal',
      lineType: 'normal',
      product: { id: 100, code: 'SIRO', name: 'Siro dâu (mới)', basePrice: '52000', inventories: [{ branchId: 1, onHand: '40' }] },
    },
    {
      id: 12,
      productId: 200,
      productCode: 'BOT',
      productName: 'Bột kem',
      quantity: '1',
      price: '80000',
      discount: '0',
      discountRatio: '10',
      conditionType: 'near_expiry',
      soldExpiryDate: '2026-12-01T00:00:00.000Z',
      product: null,
    },
  ],
  payments: [
    { amount: '20000', status: 0 },
    { amount: '99000', status: 2 },
  ],
  paymentNotes: [{ paymentType: 'cash', amount: '100000' }, { paymentType: 'transfer' }],
  delivery: { receiver: 'Lan', contactNumber: '0900', address: '1 Lê Lợi', weight: '1500', weightUnit: 'g', length: '20' },
  invoices: [],
  ...over,
});

describe('toOrderEdit', () => {
  it('nạp đơn vào giỏ: dòng hàng, khách, giao hàng, giảm giá, ghi chú thanh toán', () => {
    const { cart, meta } = toOrderEdit(raw(), 1);
    expect(cart.lines).toHaveLength(2);
    const [a, b] = cart.lines;
    expect(a).toMatchObject({ rowId: 'o11', quantity: 2, price: 50000, discount: 5000, note: '' });
    // Tên/mã theo đơn, tồn kho theo chi nhánh.
    expect(a.product).toMatchObject({ id: 100, code: 'SIRO', name: 'Siro dâu', onHand: 40, basePrice: 52000 });
    expect(a.origin).toMatchObject({ quantityUnit: 'carton', conversionValueSnapshot: 12, conditionType: 'normal', lineType: 'normal' });
    // Giảm % của dòng gộp vào giảm theo tiền.
    expect(b).toMatchObject({ price: 80000, discount: 8000 });
    expect(b.origin).toMatchObject({ conditionType: 'near_expiry', soldExpiryDate: '2026-12-01T00:00:00.000Z' });
    expect(cart.customer).toMatchObject({ id: 3, name: 'Chị Lan' });
    expect(cart.delivery).toMatchObject({ receiver: 'Lan', address: '1 Lê Lợi', locationName: '' });
    expect(cart.orderDiscount).toEqual({ type: 'amount', value: 10000 });
    expect(cart).toMatchObject({
      shippingFee: 30000,
      payKind: 'cash',
      cashAmount: 100000,
      paidAmount: 0,
      note: 'Giao sáng',
      priceBookId: 2,
    });
    expect(meta).toMatchObject({ kind: 'order', docId: 7, status: 5, promoLocked: false, invoiced: false, paidBefore: 20000 });
    expect(meta.parcel).toEqual({ weight: 1500, weightUnit: 'g', length: 20, width: 10, height: 10 });
  });

  it('giảm theo % của đơn giữ dạng %', () => {
    expect(toOrderEdit(raw({ discountRatio: '5', discount: '9000' }), 1).cart.orderDiscount).toEqual({ type: 'percent', value: 5 });
  });

  it('đơn có quà tặng / dòng khuyến mãi thì khóa sửa hàng', () => {
    const gift = raw({
      items: [
        {
          id: 1,
          productId: 1,
          quantity: '1',
          price: '0',
          lineType: 'gift',
          isGift: true,
          promotionId: 9,
          promotion: { name: 'Mua 2 tặng 1' },
        },
      ],
    });
    const { cart, meta } = toOrderEdit(gift, 1);
    expect(meta.promoLocked).toBe(true);
    expect(cart.lines[0].origin).toMatchObject({ lineType: 'gift', promotionName: 'Mua 2 tặng 1' });
    expect(toOrderEdit(raw({ items: [{ id: 1, productId: 1, quantity: '1', price: '10', promotionId: 4 }] }), 1).meta.promoLocked).toBe(
      true,
    );
  });

  it('đơn đã có hóa đơn chưa hủy', () => {
    expect(toOrderEdit(raw({ invoices: [{ status: 2 }] }), 1).meta.invoiced).toBe(false);
    expect(toOrderEdit(raw({ invoices: [{ status: 3 }] }), 1).meta.invoiced).toBe(true);
  });
});

describe('editChanges / buildOrderUpdate', () => {
  it('chưa sửa gì thì không gửi gì', () => {
    const { cart, meta } = toOrderEdit(raw(), 1);
    expect(editChanges(cart, meta.original).any).toBe(false);
    expect(hasOrderFields(buildOrderUpdate(cart, meta))).toBe(false);
    expect(editPaymentNote(cart, meta.original)).toBeNull();
  });

  it('chỉ xác nhận đơn', () => {
    const { cart, meta } = toOrderEdit(raw({ status: 1 }), 1);
    expect(buildOrderUpdate(cart, meta, { confirm: true })).toEqual({ orderStatus: 'confirmed' });
  });

  it('đổi số lượng: gửi lại toàn bộ dòng (giữ đơn vị thùng, cận date) và giảm giá', () => {
    const { cart, meta } = toOrderEdit(raw(), 1);
    const next = { ...cart, lines: cart.lines.map((l, i) => (i === 0 ? { ...l, quantity: 3 } : l)) };
    const c = editChanges(next, meta.original);
    expect(c).toMatchObject({ lines: true, customer: false, discount: false, any: true });
    const body = buildOrderUpdate(next, meta) as Record<string, unknown>;
    expect(body).toMatchObject({ skipPromotions: true, discountAmount: 10000, discountRatio: 0 });
    expect(body).not.toHaveProperty('priceBookId');
    expect(body).not.toHaveProperty('delivery');
    expect(body.items).toEqual([
      {
        productId: 100,
        quantity: 3,
        quantityUnit: 'carton',
        conversionValueSnapshot: 12,
        unitPrice: 50000,
        discount: 5000,
        discountRatio: 0,
        note: '',
        conditionType: 'normal',
        soldExpiryDate: null,
        enabledPromotionIds: [],
      },
      expect.objectContaining({ productId: 200, quantity: 1, discount: 8000, conditionType: 'near_expiry', quantityUnit: 'base' }),
    ]);
  });

  it('đơn có khuyến mãi: không bao giờ gửi dòng hàng', () => {
    const { cart, meta } = toOrderEdit(raw({ items: [{ id: 1, productId: 1, quantity: '1', price: '10', promotionId: 4 }] }), 1);
    const next = { ...cart, lines: cart.lines.map((l) => ({ ...l, quantity: 5 })), note: 'mới' };
    expect(buildOrderUpdate(next, meta)).toEqual({ description: 'mới' });
  });

  it('đổi khách: gửi khách và giao hàng mới (giữ kích thước kiện)', () => {
    const { cart, meta } = toOrderEdit(raw(), 1);
    const next = {
      ...cart,
      customer: { id: 9, code: 'KH09', name: 'Anh Minh' },
      delivery: { ...cart.delivery, receiver: 'Anh Minh', address: '2 Hai Bà Trưng' },
    };
    expect(buildOrderUpdate(next, meta)).toEqual({
      customerId: 9,
      delivery: {
        receiver: 'Anh Minh',
        contactNumber: '0900',
        address: '2 Hai Bà Trưng',
        locationName: undefined,
        wardName: undefined,
        noteForDriver: undefined,
        weight: 1500,
        weightUnit: 'g',
        length: 20,
        width: 10,
        height: 10,
      },
    });
  });

  it('đổi giảm giá, phí giao, bảng giá', () => {
    const { cart, meta } = toOrderEdit(raw(), 1);
    const next = { ...cart, orderDiscount: { type: 'percent' as const, value: 10 }, shippingFee: 0, priceBookId: null };
    expect(buildOrderUpdate(next, meta)).toEqual({ priceBookId: 0, discountAmount: 16200, discountRatio: 10, shippingFee: 0 });
  });

  it('ghi chú thanh toán chỉ khi đổi hình thức hoặc số tiền mặt; trả thêm cũng tính là có thay đổi', () => {
    const { cart, meta } = toOrderEdit(raw(), 1);
    expect(editPaymentNote({ ...cart, cashAmount: 50000 }, meta.original)).toEqual({ paymentType: 'cash', amount: 50000 });
    expect(editPaymentNote({ ...cart, payKind: 'transfer' }, meta.original)).toEqual({ paymentType: 'transfer' });
    expect(editChanges({ ...cart, paidAmount: 10000 }, meta.original)).toMatchObject({ paid: true, any: true });
  });
});

describe('validateOrderEdit', () => {
  const { cart } = toOrderEdit(raw(), 1);
  it('kiểm tra khách, hàng, hình thức thanh toán, tài khoản nhận', () => {
    expect(validateOrderEdit(cart, { canPay: true })).toBeNull();
    expect(validateOrderEdit({ ...cart, customer: null }, { canPay: true })).toMatch(/khách hàng/);
    expect(validateOrderEdit({ ...cart, lines: [] }, { canPay: true })).toMatch(/sản phẩm/);
    expect(validateOrderEdit({ ...cart, payKind: null }, { canPay: true })).toMatch(/phương thức thanh toán/);
    const transfer = { ...cart, payKind: 'transfer' as const, paidAmount: 5000, accountId: null };
    expect(validateOrderEdit(transfer, { canPay: true })).toMatch(/tài khoản nhận/);
    expect(validateOrderEdit(transfer, { canPay: false })).toBeNull();
  });
});

describe('sửa hóa đơn', () => {
  const rawInvoice = (over: Partial<RawInvoiceForEdit> = {}): RawInvoiceForEdit => {
    const { items, invoices: _invoices, ...rest } = raw();
    return { ...rest, id: 21, code: 'HD000021', status: 3, details: items, ...over };
  };

  it('nạp hóa đơn: dòng hàng từ `details`, loại chứng từ, tiền đã thu', () => {
    const { cart, meta } = toInvoiceEdit(rawInvoice(), 1);
    expect(cart.mode).toBe('invoice');
    expect(cart.lines).toHaveLength(2);
    expect(meta).toMatchObject({ kind: 'invoice', docId: 21, code: 'HD000021', invoiced: false, paidBefore: 20000 });
  });

  it('không đổi gì: không gửi gì', () => {
    const { cart, meta } = toInvoiceEdit(rawInvoice(), 1);
    expect(buildInvoiceUpdate(cart, meta)).toEqual({});
  });

  it('chỉ đổi ghi chú / phí giao / giao hàng: không gửi dòng hàng', () => {
    const { cart, meta } = toInvoiceEdit(rawInvoice(), 1);
    const next = { ...cart, note: 'Giao chiều', shippingFee: 20000, delivery: { ...cart.delivery, address: '9 Lý Thái Tổ' } };
    const body = buildInvoiceUpdate(next, meta);
    expect(body).toMatchObject({ description: 'Giao chiều', shippingFee: 20000, delivery: expect.objectContaining({ address: '9 Lý Thái Tổ', weight: 1500 }) });
    expect(body).not.toHaveProperty('items');
  });

  it('đổi số lượng: gửi đủ dòng hàng (tên trường hóa đơn) + giảm giá + bảng giá', () => {
    const { cart, meta } = toInvoiceEdit(rawInvoice(), 1);
    const next = { ...cart, lines: cart.lines.map((l, i) => (i === 0 ? { ...l, quantity: 3 } : l)) };
    const body = buildInvoiceUpdate(next, meta) as Record<string, unknown>;
    expect(body).toMatchObject({ priceBookId: 2, discountAmount: 10000, discountRatio: 0, skipPromotions: true });
    expect((body.items as unknown[])[0]).toEqual({
      productId: 100,
      productCode: 'SIRO',
      productName: 'Siro dâu',
      quantity: 3,
      quantityUnit: 'carton',
      conversionValueSnapshot: 12,
      price: 50000,
      discount: 5000,
      discountRatio: 0,
      totalPrice: 135000,
      note: '',
      conditionType: 'normal',
      enabledPromotionIds: [],
    });
    expect((body.items as Record<string, unknown>[])[1]).toMatchObject({ soldExpiryDate: '2026-12-01T00:00:00.000Z', conditionType: 'near_expiry' });
  });

  it('chỉ đổi ghi chú dòng: vẫn gửi dòng hàng', () => {
    const r = rawInvoice({ details: [{ id: 1, productId: 100, productCode: 'SIRO', productName: 'Siro', quantity: '2', price: '50000', discount: '0' }] });
    const { cart, meta } = toInvoiceEdit(r, 1);
    const next = { ...cart, lines: cart.lines.map((l) => ({ ...l, note: 'ít đá' })) };
    expect(buildInvoiceUpdate(next, meta)).toHaveProperty('items');
  });

  it('đổi giảm giá đơn: gửi kèm dòng hàng (backend chỉ lưu giảm giá cùng dòng hàng)', () => {
    const { cart, meta } = toInvoiceEdit(rawInvoice(), 1);
    const next = { ...cart, orderDiscount: { type: 'amount' as const, value: 15000 } };
    expect(buildInvoiceUpdate(next, meta)).toMatchObject({ discountAmount: 15000, items: expect.any(Array) });
  });

  it('hóa đơn có khuyến mãi: không gửi dòng hàng, chặn đổi giảm giá', () => {
    const r = rawInvoice({ details: [{ id: 1, productId: 1, productCode: 'A', productName: 'A', quantity: '1', price: '10', promotionId: 4 }] });
    const { cart, meta } = toInvoiceEdit(r, 1);
    expect(meta.promoLocked).toBe(true);
    const next = { ...cart, lines: cart.lines.map((l) => ({ ...l, quantity: 5 })), note: 'mới' };
    expect(buildInvoiceUpdate(next, meta)).toEqual({ description: 'mới' });
    expect(invoiceEditProblem({ ...cart, orderDiscount: { type: 'amount', value: 1 } }, meta)).toMatch(/khuyến mãi/);
    expect(invoiceEditProblem(next, meta)).toBeNull();
  });
});
