/** Chuyển dữ liệu hàng hóa / khách hàng của API sang dạng app dùng để bán hàng (không gọi mạng). */
import type { CustomerAddress, SaleCustomer, SaleProduct } from './cart';

/** Prisma Decimal về dạng chuỗi → số. */
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export interface RawProduct {
  id: number;
  code: string;
  name: string;
  unit?: string | null;
  basePrice?: string | number | null;
  conversionValue?: string | number | null;
  weight?: string | number | null;
  weightUnit?: string | null;
  shippingWeight?: string | number | null;
  shippingWeightUnit?: string | null;
  images?: { image?: string | null }[];
  inventories?: { branchId: number; onHand?: string | number | null }[];
}

/** Đổi khối lượng về gram (giống web: ưu tiên khối lượng giao hàng). */
export function toGrams(value: unknown, unit: string | null | undefined): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = (unit ?? '').toLowerCase();
  if (u === 'kg') return n * 1000;
  return n;
}

export function toSaleProduct(p: RawProduct, branchId: number | null): SaleProduct {
  const inv = p.inventories?.find((i) => i.branchId === branchId) ?? (branchId ? undefined : p.inventories?.[0]);
  const conv = num(p.conversionValue);
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    unit: p.unit ?? null,
    basePrice: num(p.basePrice),
    conversionValue: conv > 1 ? conv : null,
    // Ảnh đầu tiên có link (ảnh đầu danh sách có thể trống).
    image: p.images?.find((i) => !!i.image)?.image ?? null,
    onHand: inv ? num(inv.onHand) : null,
    weightGrams: toGrams(p.shippingWeight, p.shippingWeightUnit ?? 'g') ?? toGrams(p.weight, p.weightUnit ?? 'kg'),
  };
}

export interface RawCustomer {
  id: number;
  code?: string | null;
  name?: string | null;
  contactNumber?: string | null;
  phone?: string | null;
  totalDebt?: string | number | null;
  debtPolicy?: { isActive?: boolean | null; requireFullPaymentForInvoice?: boolean | null } | null;
  parent?: { code?: string | null; name?: string | null } | null;
  addresses?: (Omit<CustomerAddress, 'id' | 'isDefault'> & {
    id?: number | null;
    isDefault?: boolean | null;
  })[] | null;
}

export function toSaleCustomer(c: RawCustomer): SaleCustomer {
  return {
    id: c.id,
    code: c.code ?? '',
    name: c.name?.trim() || 'Không tên',
    phone: c.phone ?? null,
    contactNumber: c.contactNumber ?? null,
    totalDebt: num(c.totalDebt),
    parentName: c.parent?.name ?? null,
    requireFullPayment: c.debtPolicy?.isActive !== false && c.debtPolicy?.requireFullPaymentForInvoice === true,
    addresses: (c.addresses ?? []).map(({ isDefault, ...a }, index) => ({
      ...a,
      id: a.id ?? -(index + 1),
      isDefault: isDefault ?? undefined,
    })),
  };
}

/** 1 lần khách mua món hàng (lịch sử giá trong màn Sửa hàng). */
export interface RawPriceHistory {
  code?: string | null;
  date?: string | null;
  price?: number | string | null;
  discount?: number | string | null;
  quantity?: number | string | null;
  finalPrice?: number | string | null;
}

export interface PriceHistoryRow {
  code: string;
  date: string | null;
  /** Giá bán sau giảm. */
  finalPrice: number;
  /** Giảm trên mỗi đơn vị (0 = không giảm). */
  discount: number;
  quantity: number;
}

export function toPriceHistoryRow(r: RawPriceHistory): PriceHistoryRow {
  const price = num(r.price);
  const discount = num(r.discount);
  return {
    code: r.code ?? '',
    date: r.date ?? null,
    finalPrice: r.finalPrice != null ? num(r.finalPrice) : price - discount,
    discount,
    quantity: num(r.quantity),
  };
}
