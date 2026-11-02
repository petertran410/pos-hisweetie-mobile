/**
 * "Xử lý đơn hàng" (giống web): mở đơn đặt hàng ra sửa rồi Lưu, hoặc chuyển
 * sang tạo hóa đơn. Đơn được nạp vào 1 giỏ riêng, không đụng giỏ Bán hàng.
 *
 * Khi lưu chỉ gửi phần đã đổi: backend (`PUT /orders/:id`) gửi lại `items`
 * là tính lại khuyến mãi, gửi lại bảng giá là tra lại bảng giá. Đơn có
 * khuyến mãi thì app không sửa hàng/khách (app chưa áp dụng khuyến mãi).
 */
import { toSaleCustomer, toSaleProduct, type RawCustomer, type RawProduct } from '../sales/mappers';
import { cartTotals, EMPTY_CART, EMPTY_DELIVERY, type CartLine, type CartState, type Delivery, type LineOrigin } from '../sales/cart';
import type { Discount } from '../sales/totals';

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

interface RawEditItem {
  id: number;
  productId: number;
  productCode?: string | null;
  productName?: string | null;
  quantity?: string | number;
  quantityUnit?: string | null;
  conversionValueSnapshot?: string | number | null;
  price?: string | number;
  discount?: string | number;
  discountRatio?: string | number;
  note?: string | null;
  conditionType?: string | null;
  soldExpiryDate?: string | null;
  lineType?: string | null;
  isGift?: boolean | null;
  promotionId?: number | null;
  promotion?: { name?: string | null } | null;
  product?: RawProduct | null;
}

/** Phần dữ liệu `GET /orders/:id` cần để sửa đơn. */
export interface RawOrderForEdit {
  id: number;
  code: string;
  status?: number;
  branchId?: number | null;
  updatedAt?: string | null;
  customer?: RawCustomer | null;
  priceBookId?: number | null;
  priceBookName?: string | null;
  discount?: string | number;
  discountRatio?: string | number;
  shippingFee?: string | number;
  description?: string | null;
  items?: RawEditItem[];
  payments?: { amount?: string | number; status?: number | null }[];
  paymentNotes?: { paymentType?: string | null; amount?: string | number | null }[];
  delivery?: {
    receiver?: string | null;
    contactNumber?: string | null;
    address?: string | null;
    locationName?: string | null;
    wardName?: string | null;
    noteForDriver?: string | null;
    weight?: string | number | null;
    weightUnit?: string | null;
    length?: string | number | null;
    width?: string | number | null;
    height?: string | number | null;
  } | null;
  invoices?: { status: number }[];
}

export interface OrderEditMeta {
  orderId: number;
  code: string;
  status: number;
  branchId: number | null;
  updatedAt: string | null;
  /** Đơn có khuyến mãi: app không sửa hàng và khách (sửa trên web). */
  promoLocked: boolean;
  /** Đã có hóa đơn chưa hủy: không sửa đơn nữa, chỉ tạo tiếp hóa đơn (giống web). */
  invoiced: boolean;
  /** Tiền khách đã trả/đặt cọc trên đơn. */
  paidBefore: number;
  /** Kiện hàng: giữ nguyên khi lưu lại thông tin giao hàng. */
  parcel: { weight: number; weightUnit: string; length: number; width: number; height: number };
  /** Đơn lúc mở, để biết người dùng đã sửa gì. */
  original: CartState;
}

function toLine(it: RawEditItem, branchId: number | null): CartLine {
  const price = num(it.price);
  const ratio = num(it.discountRatio);
  // Gộp giảm % của dòng (đơn cũ) vào giảm theo tiền như app đang dùng.
  const discount = ratio > 0 ? Math.min(price, Math.round(num(it.discount) + (price * ratio) / 100)) : num(it.discount);
  const base = it.product
    ? toSaleProduct(it.product, branchId)
    : {
        id: it.productId,
        code: '',
        name: '',
        unit: null,
        basePrice: price,
        conversionValue: null,
        image: null,
        onHand: null,
        weightGrams: null,
      };
  const origin: LineOrigin = {
    conditionType: it.conditionType === 'damaged' || it.conditionType === 'near_expiry' ? it.conditionType : 'normal',
    soldExpiryDate: it.soldExpiryDate ?? null,
    quantityUnit: it.quantityUnit === 'carton' ? 'carton' : 'base',
    conversionValueSnapshot: num(it.conversionValueSnapshot) > 0 ? num(it.conversionValueSnapshot) : 1,
    lineType: it.lineType === 'discounted_buy' ? 'discounted_buy' : it.isGift || it.lineType === 'gift' ? 'gift' : 'normal',
    promotionName: it.promotion?.name ?? null,
  };
  return {
    rowId: `o${it.id}`,
    // Tên/mã theo đơn (giống phiếu), hàng hóa hiện tại cho giá gốc, tồn kho.
    product: { ...base, id: it.productId, code: it.productCode || base.code, name: it.productName || base.name },
    quantity: num(it.quantity),
    price,
    discount,
    note: it.note ?? '',
    origin,
  };
}

export function toOrderEdit(r: RawOrderForEdit, branchId: number | null): { cart: CartState; meta: OrderEditMeta } {
  const items = r.items ?? [];
  const lines = items.map((it) => toLine(it, branchId));
  const ratio = num(r.discountRatio);
  const orderDiscount: Discount = ratio > 0 ? { type: 'percent', value: ratio } : { type: 'amount', value: num(r.discount) };
  const d = r.delivery;
  const delivery: Delivery = d
    ? {
        receiver: d.receiver ?? '',
        contactNumber: d.contactNumber ?? '',
        address: d.address ?? '',
        locationName: d.locationName ?? '',
        wardName: d.wardName ?? '',
        noteForDriver: d.noteForDriver ?? '',
      }
    : EMPTY_DELIVERY;
  const note = r.paymentNotes?.[0];
  const payKind = note?.paymentType === 'cash' || note?.paymentType === 'transfer' ? note.paymentType : null;
  const cart: CartState = {
    ...EMPTY_CART,
    mode: 'order',
    lines,
    customer: r.customer ? toSaleCustomer(r.customer) : null,
    delivery,
    priceBookId: r.priceBookId ?? null,
    priceBookName: r.priceBookName ?? null,
    orderDiscount,
    shippingFee: num(r.shippingFee),
    payKind,
    cashAmount: payKind === 'cash' ? num(note?.amount) : 0,
    paidAmount: 0,
    accountId: null,
    note: r.description ?? '',
  };
  return {
    cart,
    meta: {
      orderId: r.id,
      code: r.code,
      status: num(r.status),
      branchId: r.branchId ?? null,
      updatedAt: r.updatedAt ?? null,
      promoLocked: lines.some((l) => l.origin?.lineType !== 'normal') || items.some((it) => it.promotionId != null),
      invoiced: (r.invoices ?? []).some((i) => i.status !== 2),
      paidBefore: (r.payments ?? []).filter((p) => p.status !== 2).reduce((s, p) => s + num(p.amount), 0),
      parcel: {
        weight: num(d?.weight),
        weightUnit: d?.weightUnit || 'g',
        length: num(d?.length) || 10,
        width: num(d?.width) || 10,
        height: num(d?.height) || 10,
      },
      original: cart,
    },
  };
}

const lineKey = (l: CartLine) =>
  [l.product.id, l.quantity, l.price, l.discount, l.note.trim(), l.origin?.conditionType ?? 'normal', l.origin?.soldExpiryDate ?? ''].join(
    '|',
  );

const sameDelivery = (a: Delivery, b: Delivery) =>
  (Object.keys(EMPTY_DELIVERY) as (keyof Delivery)[]).every((k) => (a[k] ?? '').trim() === (b[k] ?? '').trim());

const sameDiscount = (a: Discount, b: Discount) => a.type === b.type && a.value === b.value;

/** Những phần người dùng đã sửa so với đơn lúc mở. */
export function editChanges(cart: CartState, original: CartState) {
  const lines = cart.lines.length !== original.lines.length || cart.lines.some((l, i) => lineKey(l) !== lineKey(original.lines[i]));
  const changes = {
    lines,
    customer: cart.customer?.id !== original.customer?.id,
    delivery: !sameDelivery(cart.delivery, original.delivery),
    priceBook: (cart.priceBookId ?? 0) !== (original.priceBookId ?? 0),
    discount: !sameDiscount(cart.orderDiscount, original.orderDiscount),
    shipping: cart.shippingFee !== original.shippingFee,
    note: cart.note.trim() !== original.note.trim(),
    payNote: cart.payKind !== original.payKind || (cart.payKind === 'cash' && cart.cashAmount !== original.cashAmount),
    paid: cart.paidAmount > 0,
  };
  return { ...changes, any: Object.values(changes).some(Boolean) };
}

export type EditChanges = ReturnType<typeof editChanges>;

/** Lỗi trước khi lưu (thứ tự giống web). */
export function validateOrderEdit(cart: CartState, opts: { canPay: boolean }): string | null {
  if (!cart.customer) return 'Vui lòng chọn khách hàng trước khi lưu đơn hàng';
  if (cart.lines.length === 0) return 'Vui lòng thêm sản phẩm vào đơn hàng';
  if (!cart.payKind) return 'Vui lòng chọn phương thức thanh toán: chuyển khoản hoặc tiền mặt';
  if (cart.payKind === 'cash' && !(cart.cashAmount >= 0)) return 'Số tiền mặt không hợp lệ';
  const paid = opts.canPay ? cart.paidAmount : 0;
  if (paid > 0 && cart.payKind === 'transfer' && !cart.accountId) return 'Vui lòng chọn tài khoản nhận chuyển khoản';
  return null;
}

const toItem = (l: CartLine) => ({
  productId: l.product.id,
  quantity: l.quantity,
  quantityUnit: l.origin?.quantityUnit ?? 'base',
  conversionValueSnapshot: l.origin?.conversionValueSnapshot ?? Math.max(1, l.product.conversionValue ?? 1),
  unitPrice: l.price,
  discount: l.discount,
  discountRatio: 0,
  note: l.note,
  conditionType: l.origin?.conditionType ?? 'normal',
  soldExpiryDate: l.origin?.soldExpiryDate ?? null,
  enabledPromotionIds: [],
});

/**
 * Body cho `PUT /orders/:id`: chỉ những phần đã sửa. `confirm` chuyển đơn
 * Phiếu tạm sang Đã xác nhận (để tạo hóa đơn).
 */
export function buildOrderUpdate(cart: CartState, meta: OrderEditMeta, opts: { confirm?: boolean } = {}) {
  const c = editChanges(cart, meta.original);
  const t = cartTotals(cart);
  const percent = cart.orderDiscount.type === 'percent' && cart.orderDiscount.value > 0;
  const d = cart.delivery;
  const sendLines = c.lines && !meta.promoLocked;
  return {
    ...(c.customer && cart.customer ? { customerId: cart.customer.id } : null),
    ...(c.priceBook ? { priceBookId: cart.priceBookId ?? 0 } : null),
    // Đổi hàng thì gửi lại giảm giá để backend quy đổi % theo tiền hàng mới.
    ...(c.discount || sendLines
      ? { discountAmount: t.orderDiscount, discountRatio: percent ? Math.min(100, cart.orderDiscount.value) : 0 }
      : null),
    ...(c.shipping ? { shippingFee: t.shipping } : null),
    ...(c.note ? { description: cart.note.trim() } : null),
    ...(c.delivery || c.customer
      ? {
          delivery: {
            receiver: d.receiver.trim(),
            contactNumber: d.contactNumber.trim(),
            address: d.address.trim(),
            locationName: d.locationName || undefined,
            wardName: d.wardName || undefined,
            noteForDriver: d.noteForDriver.trim() || undefined,
            ...meta.parcel,
          },
        }
      : null),
    // App chưa áp dụng khuyến mãi: giữ đúng các dòng đang thấy trên màn hình.
    ...(sendLines ? { skipPromotions: true, items: cart.lines.map(toItem) } : null),
    ...(opts.confirm ? { orderStatus: 'confirmed' } : null),
  };
}

/** Có gì để gửi `PUT /orders/:id` không (ngoài tiền trả thêm và ghi chú thanh toán). */
export const hasOrderFields = (body: object) => Object.keys(body).length > 0;

/** Ghi chú thanh toán mới (chỉ khi đổi hình thức / số tiền mặt). */
export function editPaymentNote(cart: CartState, original: CartState): { paymentType: string; amount?: number } | null {
  if (!cart.payKind || !editChanges(cart, original).payNote) return null;
  return cart.payKind === 'cash' ? { paymentType: 'cash', amount: cart.cashAmount } : { paymentType: 'transfer' };
}
