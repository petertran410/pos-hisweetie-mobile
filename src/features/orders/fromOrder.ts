/**
 * Tạo hóa đơn từ đơn đặt hàng ("Xử lý đơn hàng" trên web).
 * Cách tính giống backend `POST /invoices/pos/from-order/:id`: hàng còn lại,
 * giảm giá và phí giao hàng chưa phân bổ, tiền cọc chỉ tính cho hóa đơn đầu.
 */

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export type PayKind = 'cash' | 'transfer';

interface RawOrderItem {
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
  product?: { code?: string | null; name?: string | null; unit?: string | null } | null;
}

/** Phần dữ liệu `GET /orders/:id` cần để tạo hóa đơn. */
export interface RawOrderForInvoice {
  id: number;
  code: string;
  status?: number;
  branchId?: number | null;
  discount?: string | number;
  discountRatio?: string | number;
  shippingFee?: string | number;
  customer?: { name?: string | null; code?: string | null } | null;
  items?: RawOrderItem[];
  payments?: { amount?: string | number; status?: number | null }[];
  paymentNotes?: { paymentType?: string | null }[];
  invoices?: {
    status: number;
    discount?: string | number;
    shippingFee?: string | number;
    details?: { productId: number | null; quantity?: string | number }[];
  }[];
}

export interface DraftLine {
  key: string;
  productId: number;
  code: string;
  name: string;
  unit: string | null;
  /** Số còn được xuất (đã trừ các hóa đơn trước). */
  remaining: number;
  ordered: number;
  price: number;
  discount: number;
  gift: boolean;
  condition: 'normal' | 'damaged' | 'near_expiry';
  /** Dữ liệu gốc của dòng để gửi lại khi xuất 1 phần. */
  raw: RawOrderItem;
}

export interface InvoiceDraft {
  orderId: number;
  orderCode: string;
  orderStatus: number;
  branchId: number | null;
  customerName: string;
  customerCode: string | null;
  lines: DraftLine[];
  /** Tổng đặt theo sản phẩm (để biết còn thiếu hay đã đủ). */
  ordered: Record<number, number>;
  /** Đã xuất ở các hóa đơn trước theo sản phẩm. */
  invoiced: Record<number, number>;
  discountRatio: number;
  remainingDiscount: number;
  remainingShipping: number;
  /** Tiền đã trả trên đơn, chỉ trừ vào hóa đơn đầu tiên. */
  paidOnOrder: number;
  /** Hình thức thanh toán ghi trên đơn (gần nhất). */
  payKind: PayKind | null;
}

export function toInvoiceDraft(r: RawOrderForInvoice): InvoiceDraft {
  const live = (r.invoices ?? []).filter((i) => i.status !== 2);
  const invoiced: Record<number, number> = {};
  for (const inv of live) {
    for (const d of inv.details ?? []) {
      if (d.productId == null) continue;
      invoiced[d.productId] = round4((invoiced[d.productId] ?? 0) + num(d.quantity));
    }
  }
  const ordered: Record<number, number> = {};
  for (const it of r.items ?? []) ordered[it.productId] = round4((ordered[it.productId] ?? 0) + num(it.quantity));

  const lines: DraftLine[] = (r.items ?? [])
    .map((it) => {
      const quantity = num(it.quantity);
      const condition: DraftLine['condition'] =
        it.conditionType === 'damaged' || it.conditionType === 'near_expiry' ? it.conditionType : 'normal';
      return {
        key: String(it.id),
        productId: it.productId,
        code: it.productCode || it.product?.code || '',
        name: it.productName || it.product?.name || '',
        unit: it.product?.unit ?? null,
        // Giống backend: mỗi dòng trừ toàn bộ số đã xuất của sản phẩm đó.
        remaining: round4(quantity - (invoiced[it.productId] ?? 0)),
        ordered: quantity,
        price: num(it.price),
        discount: num(it.discount),
        gift: !!it.isGift || it.lineType === 'gift',
        condition,
        raw: it,
      };
    })
    .filter((l) => l.remaining > 0);

  const usedDiscount = live.reduce((s, i) => s + num(i.discount), 0);
  const usedShipping = live.reduce((s, i) => s + num(i.shippingFee), 0);
  const note = r.paymentNotes?.[0]?.paymentType;
  return {
    orderId: r.id,
    orderCode: r.code,
    orderStatus: num(r.status),
    branchId: r.branchId ?? null,
    customerName: r.customer?.name || 'Khách vãng lai',
    customerCode: r.customer?.code ?? null,
    lines,
    ordered,
    invoiced,
    discountRatio: num(r.discountRatio),
    remainingDiscount: Math.max(0, num(r.discount) - usedDiscount),
    remainingShipping: Math.max(0, num(r.shippingFee) - usedShipping),
    paidOnOrder:
      live.length === 0 ? (r.payments ?? []).filter((p) => p.status !== 2).reduce((s, p) => s + num(p.amount), 0) : 0,
    payKind: note === 'cash' || note === 'transfer' ? note : null,
  };
}

/** Số lượng xuất mặc định: toàn bộ phần còn lại. */
export const defaultQuantities = (d: InvoiceDraft): Record<string, number> =>
  Object.fromEntries(d.lines.map((l) => [l.key, l.remaining]));

export const isChanged = (d: InvoiceDraft, qty: Record<string, number>) =>
  d.lines.some((l) => (qty[l.key] ?? 0) !== l.remaining);

export function draftTotals(d: InvoiceDraft, qty: Record<string, number>, paidNow: number) {
  const subtotal = Math.round(d.lines.reduce((s, l) => s + (l.price - l.discount) * (qty[l.key] ?? 0), 0));
  // Giống backend: giảm theo tiền thì dồn toàn bộ phần giảm giá còn lại vào hóa đơn này.
  const discount = d.discountRatio > 0 ? Math.round((subtotal * d.discountRatio) / 100) : d.remainingDiscount;
  const shipping = d.remainingShipping;
  const total = subtotal - discount + shipping;
  const paid = d.paidOnOrder + paidNow;
  const itemCount = round4(d.lines.reduce((s, l) => s + (qty[l.key] ?? 0), 0));
  return { subtotal, discount, shipping, total, paid, left: total - paid, itemCount };
}

/** Xuất thiếu so với số đặt (sau hóa đơn này đơn vẫn còn hàng chưa xuất). */
export function hasShortfall(d: InvoiceDraft, qty: Record<string, number>): boolean {
  const out: Record<number, number> = { ...d.invoiced };
  for (const l of d.lines) out[l.productId] = round4((out[l.productId] ?? 0) + (qty[l.key] ?? 0));
  return Object.entries(d.ordered).some(([pid, q]) => (out[Number(pid)] ?? 0) < q);
}

export interface DraftForm {
  qty: Record<string, number>;
  payKind: PayKind | null;
  /** Tiền mặt cần thu (ghi chú thanh toán). */
  cashAmount: number;
  /** Khách trả thêm lúc tạo hóa đơn (backend chưa ghi tài khoản nhận cho khoản này). */
  paidNow: number;
}

export function validateDraft(d: InvoiceDraft, f: DraftForm): string | null {
  if (!d.lines.some((l) => (f.qty[l.key] ?? 0) > 0)) return 'Chọn ít nhất 1 món để xuất hóa đơn';
  if (!f.payKind) return 'Vui lòng chọn hình thức thanh toán: chuyển khoản hoặc tiền mặt';
  return null;
}

/** Body cho `POST /invoices/pos/from-order/:id`. */
export function buildFromOrderPayload(d: InvoiceDraft, f: DraftForm, forceComplete: boolean) {
  const t = draftTotals(d, f.qty, f.paidNow);
  const pay = f.payKind as PayKind;
  return {
    additionalPayment: f.paidNow,
    payments: f.paidNow > 0 ? [{ method: pay, amount: f.paidNow }] : [],
    paymentNoteType: pay,
    paymentType: pay,
    forceComplete,
    // Giữ nguyên các dòng (kể cả quà tặng) như trên đơn, không áp lại khuyến mãi.
    skipPromotions: true,
    // Giảm theo %: gửi % để backend quy đổi theo tiền hàng của hóa đơn này.
    // Giảm theo tiền: không gửi, backend tự dùng phần giảm giá còn lại của đơn.
    ...(d.discountRatio > 0 ? { discountRatio: d.discountRatio, discountAmount: t.discount } : null),
    // Không đổi số lượng: để backend tự lấy toàn bộ hàng còn lại.
    ...(isChanged(d, f.qty)
      ? {
          items: d.lines
            .filter((l) => (f.qty[l.key] ?? 0) > 0)
            .map((l) => {
              const q = f.qty[l.key];
              return {
                productId: l.productId,
                productCode: l.code,
                productName: l.name,
                quantity: q,
                quantityUnit: l.raw.quantityUnit || 'base',
                conversionValueSnapshot: Math.max(1, num(l.raw.conversionValueSnapshot) || 1),
                price: l.price,
                discount: l.discount,
                discountRatio: num(l.raw.discountRatio),
                totalPrice: (l.price - l.discount) * q,
                note: l.raw.note || '',
                conditionType: l.condition,
                soldExpiryDate: l.raw.soldExpiryDate ?? null,
                lineType: l.raw.lineType || (l.gift ? 'gift' : 'normal'),
                isGift: l.gift,
                ...(l.raw.promotionId != null ? { promotionId: l.raw.promotionId } : null),
              };
            }),
        }
      : null),
  };
}

/** Ghi chú thanh toán cho hóa đơn vừa tạo (tiền mặt kèm số tiền cần thu). */
export const paymentNoteFor = (f: DraftForm) =>
  f.payKind === 'cash' ? { paymentType: 'cash', amount: f.cashAmount } : { paymentType: 'transfer' };
