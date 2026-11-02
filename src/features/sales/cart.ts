import { create } from 'zustand';
import { computeTotals, discountAmount, type Discount, NO_DISCOUNT } from './totals';

export type SaleMode = 'order' | 'invoice';
export type PayKind = 'cash' | 'transfer';

/** Hàng hóa đủ để bán (rút gọn từ `/products`). */
export interface SaleProduct {
  id: number;
  code: string;
  name: string;
  unit?: string | null;
  basePrice: number;
  /** Số đơn vị cơ bản trong 1 thùng (>1 mới có thùng). */
  conversionValue?: number | null;
  image?: string | null;
  /** Tồn tại chi nhánh đang chọn. */
  onHand?: number | null;
  /** Khối lượng 1 đơn vị (gram) để tính khối lượng giao hàng. */
  weightGrams?: number | null;
}

/** Thông tin gốc của dòng lấy từ đơn đặt hàng, giữ nguyên khi lưu lại đơn. */
export interface LineOrigin {
  conditionType: 'normal' | 'damaged' | 'near_expiry';
  soldExpiryDate: string | null;
  quantityUnit: 'base' | 'carton';
  conversionValueSnapshot: number;
  lineType: 'normal' | 'gift' | 'discounted_buy';
  promotionName: string | null;
}

export interface CartLine {
  rowId: string;
  product: SaleProduct;
  /** Luôn tính theo đơn vị cơ bản. */
  quantity: number;
  /** Đơn giá theo bảng giá lúc thêm. */
  price: number;
  /** Giảm giá trên 1 đơn vị (VND), giống web. */
  discount: number;
  note: string;
  /** Chỉ có ở dòng lấy từ đơn đặt hàng đang sửa. */
  origin?: LineOrigin;
}

/** Dòng hàng thường (không phải hàng lỗi/cận date/khuyến mãi): được cộng dồn khi thêm. */
const isPlainLine = (l: CartLine) => !l.origin || (l.origin.conditionType === 'normal' && l.origin.lineType === 'normal');

export interface CustomerAddress {
  id: number;
  label?: string | null;
  receiver?: string | null;
  contactNumber?: string | null;
  address?: string | null;
  wardName?: string | null;
  cityName?: string | null;
  newWardName?: string | null;
  newCityName?: string | null;
  locationName?: string | null;
  isDefault?: boolean;
}

export interface SaleCustomer {
  id: number;
  code: string;
  name: string;
  phone?: string | null;
  contactNumber?: string | null;
  totalDebt?: number | null;
  parentName?: string | null;
  requireFullPayment?: boolean;
  addresses?: CustomerAddress[];
}

export interface Delivery {
  receiver: string;
  contactNumber: string;
  address: string;
  locationName: string;
  wardName: string;
  noteForDriver: string;
}

export const EMPTY_DELIVERY: Delivery = {
  receiver: '',
  contactNumber: '',
  address: '',
  locationName: '',
  wardName: '',
  noteForDriver: '',
};

export interface CartState {
  mode: SaleMode;
  lines: CartLine[];
  customer: SaleCustomer | null;
  delivery: Delivery;
  /** null/0 = "Bảng giá chung". */
  priceBookId: number | null;
  priceBookName: string | null;
  orderDiscount: Discount;
  shippingFee: number;
  /** Khách sẽ trả bằng gì (bắt buộc chọn, giống web). */
  payKind: PayKind | null;
  /** Số tiền mặt khách đưa (khi trả tiền mặt). */
  cashAmount: number;
  /** Tiền khách trả ngay (ghi nhận thanh toán / đặt cọc). */
  paidAmount: number;
  /** Tài khoản nhận khi trả ngay bằng chuyển khoản. */
  accountId: number | null;
  note: string;
}

export const EMPTY_CART: CartState = {
  mode: 'order',
  lines: [],
  customer: null,
  delivery: EMPTY_DELIVERY,
  priceBookId: null,
  priceBookName: null,
  orderDiscount: NO_DISCOUNT,
  shippingFee: 0,
  payKind: null,
  cashAmount: 0,
  paidAmount: 0,
  accountId: null,
  note: '',
};

let seq = 0;
const newRowId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Địa chỉ mặc định (hoặc địa chỉ đầu tiên) → thông tin giao hàng. */
export function addressToDelivery(customer: SaleCustomer, address?: CustomerAddress): Delivery {
  const a = address ?? customer.addresses?.find((x) => x.isDefault) ?? customer.addresses?.[0];
  if (!a) {
    return { ...EMPTY_DELIVERY, receiver: customer.name, contactNumber: customer.contactNumber ?? customer.phone ?? '' };
  }
  return {
    receiver: a.receiver || customer.name,
    contactNumber: a.contactNumber || customer.contactNumber || customer.phone || '',
    address: a.address ?? '',
    locationName: a.newCityName || a.locationName || a.cityName || '',
    wardName: a.newWardName || a.wardName || '',
    noteForDriver: '',
  };
}

export function cartTotals(state: Pick<CartState, 'lines' | 'orderDiscount' | 'shippingFee'>) {
  const base = computeTotals(
    state.lines.map((l) => ({ price: l.price, quantity: l.quantity, discount: { type: 'amount', value: l.discount } })),
    state.orderDiscount,
  );
  const shipping = Math.max(0, state.shippingFee);
  return { ...base, shipping, total: base.total + shipping };
}

export interface CartActions {
  reset: (keep?: Partial<CartState>) => void;
  load: (state: CartState) => void;
  setMode: (mode: SaleMode) => void;
  add: (product: SaleProduct, price: number, quantity?: number) => void;
  setQuantity: (rowId: string, quantity: number) => void;
  updateLine: (rowId: string, patch: Partial<Pick<CartLine, 'quantity' | 'price' | 'discount' | 'note'>>) => void;
  remove: (rowId: string) => void;
  setCustomer: (customer: SaleCustomer | null) => void;
  setDelivery: (patch: Partial<Delivery>) => void;
  setPriceBook: (id: number | null, name: string | null, prices?: Map<number, number>) => void;
  setOrderDiscount: (d: Discount) => void;
  setShippingFee: (fee: number) => void;
  setPayKind: (kind: PayKind) => void;
  setCashAmount: (amount: number) => void;
  setPaid: (amount: number, accountId?: number | null) => void;
  setAccount: (accountId: number | null) => void;
  setNote: (note: string) => void;
}

/** Tạo 1 giỏ hàng riêng (giỏ Bán hàng, đơn đang sửa...). */
export const createCartStore = () =>
  create<CartState & CartActions>((set, get) => ({
    ...EMPTY_CART,
    reset: (keep) => set({ ...EMPTY_CART, ...keep }),
    load: (state) => set({ ...EMPTY_CART, ...state }),
    setMode: (mode) => set({ mode }),
    add: (product, price, quantity = 1) => {
      const lines = get().lines;
      // Cùng sản phẩm, cùng giá, chưa giảm/ghi chú → cộng dồn (gọn hơn trên điện thoại).
      const same = lines.find((l) => l.product.id === product.id && l.price === price && l.discount === 0 && !l.note && isPlainLine(l));
      if (same) {
        set({ lines: lines.map((l) => (l === same ? { ...l, quantity: round4(l.quantity + quantity) } : l)) });
        return;
      }
      set({ lines: [{ rowId: newRowId(), product, quantity, price, discount: 0, note: '' }, ...lines] });
    },
    setQuantity: (rowId, quantity) => {
      if (quantity <= 0) return get().remove(rowId);
      set({ lines: get().lines.map((l) => (l.rowId === rowId ? { ...l, quantity: round4(quantity) } : l)) });
    },
    updateLine: (rowId, patch) =>
      set({
        lines: get().lines.map((l) => {
          if (l.rowId !== rowId) return l;
          const next = { ...l, ...patch };
          next.quantity = round4(Math.max(0, next.quantity));
          next.price = Math.max(0, Math.round(next.price));
          next.discount = discountAmount(next.price, { type: 'amount', value: next.discount });
          return next;
        }),
      }),
    remove: (rowId) => set({ lines: get().lines.filter((l) => l.rowId !== rowId) }),
    setCustomer: (customer) => set({ customer, delivery: customer ? addressToDelivery(customer) : EMPTY_DELIVERY }),
    setDelivery: (patch) => set({ delivery: { ...get().delivery, ...patch } }),
    setPriceBook: (id, name, prices) =>
      set({
        priceBookId: id,
        priceBookName: name,
        lines: prices
          ? get().lines.map((l) => {
              const price = prices.get(l.product.id) ?? l.price;
              return { ...l, price, discount: Math.min(l.discount, price) };
            })
          : get().lines,
      }),
    setOrderDiscount: (orderDiscount) => set({ orderDiscount }),
    setShippingFee: (fee) => set({ shippingFee: Math.max(0, Math.round(fee)) }),
    setPayKind: (payKind) => {
      const total = cartTotals(get()).total;
      set({ payKind, cashAmount: payKind === 'cash' ? total : 0 });
    },
    setCashAmount: (cashAmount) => set({ cashAmount: Math.max(0, Math.round(cashAmount)) }),
    setPaid: (amount, accountId) =>
      set({ paidAmount: Math.max(0, Math.round(amount)), ...(accountId !== undefined ? { accountId } : null) }),
    setAccount: (accountId) => set({ accountId }),
    setNote: (note) => set({ note }),
  }));

/** Giỏ của tab Bán hàng. */
export const useCart = createCartStore();
export type CartStore = typeof useCart;

function round4(n: number) {
  return Math.round(n * 10_000) / 10_000;
}

/** Phần dữ liệu giỏ cần lưu lại (để tắt app mở lại vẫn còn). */
export function cartSnapshot(s: CartState): CartState {
  const {
    mode,
    lines,
    customer,
    delivery,
    priceBookId,
    priceBookName,
    orderDiscount,
    shippingFee,
    payKind,
    cashAmount,
    paidAmount,
    accountId,
    note,
  } = s;
  return {
    mode,
    lines,
    customer,
    delivery,
    priceBookId,
    priceBookName,
    orderDiscount,
    shippingFee,
    payKind,
    cashAmount,
    paidAmount,
    accountId,
    note,
  };
}
