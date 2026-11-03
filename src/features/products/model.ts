/** Hàng hóa: kiểu dữ liệu, nhãn, đổi dữ liệu API sang dạng app (không gọi mạng). */
import { canDo, type PermissionHolder } from '@/core/can';
import type { Query } from '@/core/request';
import type { Tone } from '@/ui';

/** Prisma Decimal về dạng chuỗi → số. */
export const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Giá vốn bị backend ẩn (thiếu quyền) thì không có trường `cost`. */
const costOf = (v: unknown): number | null => (v === undefined || v === null ? null : num(v));

export const PAGE_SIZE = 20;
export const LOG_PAGE_SIZE = 15;

// ---------- Loại hàng, nhãn ----------

/** 1 Combo, 2 Hàng hóa, 3 Dịch vụ, 4 Hàng sản xuất. */
export type ProductType = 1 | 2 | 3 | 4;

/** Thứ tự giống web. */
export const PRODUCT_TYPES: { value: ProductType; label: string; short: string }[] = [
  { value: 2, label: 'Hàng hóa', short: 'Hàng hóa' },
  { value: 3, label: 'Dịch vụ', short: 'Dịch vụ' },
  { value: 1, label: 'Combo - đóng gói', short: 'Combo' },
  { value: 4, label: 'Hàng sản xuất', short: 'Sản xuất' },
];

export const asType = (v: unknown): ProductType => {
  const n = Number(v);
  return n === 1 || n === 3 || n === 4 ? n : 2;
};

export const typeLabel = (t: ProductType, short = false) => {
  const hit = PRODUCT_TYPES.find((x) => x.value === t);
  return (short ? hit?.short : hit?.label) ?? 'Hàng hóa';
};

export type CargoType = 'NORMAL' | 'COLD';
export const CARGO_TYPES: { value: CargoType; label: string }[] = [
  { value: 'NORMAL', label: 'Hàng thường' },
  { value: 'COLD', label: 'Hàng lạnh' },
];

/** Ba cấp nhóm hàng trên web: Loại hàng › Nguồn gốc › Danh mục. */
export type CategoryLevel = 'parent' | 'middle' | 'child';
export const CATEGORY_LEVELS: { value: CategoryLevel; label: string }[] = [
  { value: 'parent', label: 'Loại hàng' },
  { value: 'middle', label: 'Nguồn gốc' },
  { value: 'child', label: 'Danh mục' },
];

// ---------- Dữ liệu API ----------

export interface RawInventory {
  branchId: number;
  branchName?: string | null;
  branch?: { name?: string | null; isActive?: boolean | null } | null;
  cost?: string | number | null;
  onHand?: string | number | null;
  reserved?: string | number | null;
  onOrder?: string | number | null;
  minQuality?: string | number | null;
  maxQuality?: string | number | null;
  damagedQuantity?: string | number | null;
  nearExpiryQuantity?: string | number | null;
  promoQuantity?: string | number | null;
}

export interface RawComponentProduct {
  id: number;
  code: string;
  name: string;
  type?: number | null;
  unit?: string | null;
  basePrice?: string | number | null;
  conversionValue?: string | number | null;
  weight?: string | number | null;
  weightUnit?: string | null;
  isPieceUnit?: boolean | null;
  images?: { image?: string | null }[];
  inventories?: RawInventory[];
}

export interface RawComponent {
  id?: number;
  componentProductId: number;
  quantity?: string | number | null;
  inputMode?: string | null;
  componentProduct?: RawComponentProduct | null;
}

export interface RawFormula {
  id: number;
  name: string;
  isDefault?: boolean | null;
  components?: RawComponent[];
}

export interface RawProduct {
  id: number;
  code: string;
  name: string;
  fullName?: string | null;
  description?: string | null;
  orderTemplate?: string | null;
  parentName?: string | null;
  middleName?: string | null;
  childName?: string | null;
  tradeMarkId?: number | null;
  tradeMark?: { id: number; name: string } | null;
  type?: number | null;
  basePrice?: string | number | null;
  unit?: string | null;
  conversionValue?: string | number | null;
  weight?: string | number | null;
  weightUnit?: string | null;
  isPieceUnit?: boolean | null;
  shippingWeight?: string | number | null;
  shippingWeightUnit?: string | null;
  vat?: string | number | null;
  isActive?: boolean | null;
  isDirectSale?: boolean | null;
  cargoType?: string | null;
  createdAt?: string | null;
  images?: { id?: number; image?: string | null }[];
  inventories?: RawInventory[];
  attributes?: { id?: number; name?: string | null; value?: string | null }[];
  comboComponents?: RawComponent[];
  formulas?: RawFormula[];
}

// ---------- Tồn kho ----------

export interface StockLevel {
  branchId: number;
  branchName: string;
  onHand: number;
  /** Hàng tốt = tồn − bục rách − cận date − khuyến mãi. */
  good: number;
  damaged: number;
  nearExpiry: number;
  promo: number;
  /** Khách đặt. */
  reserved: number;
  /** Đặt nhà cung cấp. */
  onOrder: number;
  min: number;
  max: number;
  /** null = không có quyền xem giá vốn. */
  cost: number | null;
}

export function toStockLevel(i: RawInventory): StockLevel {
  const onHand = num(i.onHand);
  const damaged = num(i.damagedQuantity);
  const nearExpiry = num(i.nearExpiryQuantity);
  const promo = num(i.promoQuantity);
  return {
    branchId: i.branchId,
    branchName: i.branch?.name || i.branchName || `Chi nhánh ${i.branchId}`,
    onHand,
    good: onHand - damaged - nearExpiry - Math.max(promo, 0),
    damaged,
    nearExpiry,
    promo,
    reserved: num(i.reserved),
    onOrder: num(i.onOrder),
    min: num(i.minQuality),
    max: num(i.maxQuality),
    cost: costOf(i.cost),
  };
}

/** Tồn của chi nhánh đang chọn (không có chi nhánh thì lấy dòng đầu). */
const branchInventory = (list: RawInventory[] | undefined, branchId: number | null) =>
  list?.find((i) => i.branchId === branchId) ?? (branchId ? undefined : list?.[0]);

const firstImage = (images: RawProduct['images']) => images?.find((i) => !!i.image)?.image ?? null;

// ---------- Dòng danh sách ----------

export interface ProductRow {
  id: number;
  code: string;
  name: string;
  type: ProductType;
  isActive: boolean;
  image: string | null;
  /** Nhóm hàng sâu nhất có giá trị (Danh mục → Nguồn gốc → Loại hàng). */
  category: string | null;
  unit: string | null;
  basePrice: number;
  cost: number | null;
  /** null = chưa có dòng tồn ở chi nhánh này. */
  onHand: number | null;
  damaged: number;
  nearExpiry: number;
}

/** Combo: giá vốn = Σ giá vốn thành phần × số lượng (giống web). */
function comboCost(components: RawComponent[] | undefined, branchId: number | null): number | null {
  if (!components?.length) return 0;
  let sum = 0;
  for (const c of components) {
    const inv = branchInventory(c.componentProduct?.inventories, branchId);
    const cost = costOf(inv?.cost);
    if (inv && cost === null) return null;
    sum += (cost ?? 0) * num(c.quantity);
  }
  return sum;
}

export function toProductRow(p: RawProduct, branchId: number | null): ProductRow {
  const type = asType(p.type);
  const inv = branchInventory(p.inventories, branchId);
  return {
    id: p.id,
    code: p.code,
    name: p.fullName || p.name,
    type,
    isActive: p.isActive !== false,
    image: firstImage(p.images),
    category: p.childName || p.middleName || p.parentName || null,
    unit: p.unit || null,
    basePrice: num(p.basePrice),
    cost: type === 1 ? comboCost(p.comboComponents, branchId) : inv ? costOf(inv.cost) : null,
    onHand: inv ? num(inv.onHand) : null,
    damaged: inv ? num(inv.damagedQuantity) : 0,
    nearExpiry: inv ? num(inv.nearExpiryQuantity) : 0,
  };
}

// ---------- Chi tiết ----------

/** Cách nhập số lượng thành phần của hàng sản xuất. */
export type InputMode = 'gram' | 'quantity' | 'piece' | 'carton';
export const INPUT_MODES: { value: InputMode; label: string; unit: string }[] = [
  { value: 'gram', label: 'Gram', unit: 'g' },
  { value: 'quantity', label: 'Số lượng', unit: '' },
  { value: 'piece', label: 'Chiếc', unit: 'chiếc' },
  { value: 'carton', label: 'Thùng', unit: 'thùng' },
];
export const asInputMode = (v: unknown): InputMode =>
  v === 'quantity' || v === 'piece' || v === 'carton' ? v : 'gram';

export interface ComponentLine {
  productId: number;
  code: string;
  name: string;
  unit: string | null;
  image: string | null;
  /**
   * Số đang lưu (giống web): gram / số lượng lưu theo gram; chiếc / thùng
   * lưu theo đơn vị tính. Combo: số lượng thành phần.
   */
  quantity: number;
  inputMode: InputMode;
  basePrice: number;
  /** "Định lượng đóng gói": 1 thùng = N đơn vị tính. */
  conversionValue: number;
  /** Khối lượng 1 đơn vị (gram); 0 = chưa khai báo. */
  weightGrams: number;
  isPieceUnit: boolean;
  /** Giá vốn 1 đơn vị ở chi nhánh đang chọn; null = không có quyền xem / chưa có tồn. */
  cost: number | null;
}

export function toComponentFromProduct(
  p: RawComponentProduct,
  branchId: number | null,
  quantity: number,
  inputMode: InputMode,
): ComponentLine {
  const inv = branchInventory(p.inventories, branchId);
  const w = num(p.weight);
  return {
    productId: p.id,
    code: p.code ?? '',
    name: p.name ?? `#${p.id}`,
    unit: p.unit || null,
    image: firstImage(p.images),
    quantity,
    inputMode,
    basePrice: num(p.basePrice),
    conversionValue: Math.max(1, num(p.conversionValue) || 1),
    weightGrams: w > 0 ? ((p.weightUnit ?? 'g').toLowerCase() === 'kg' ? w * 1000 : w) : 0,
    isPieceUnit: !!p.isPieceUnit,
    cost: inv ? costOf(inv.cost) : null,
  };
}

export function toComponentLine(c: RawComponent, branchId: number | null): ComponentLine {
  const p = c.componentProduct ?? { id: c.componentProductId, code: '', name: `#${c.componentProductId}` };
  return toComponentFromProduct(p, branchId, num(c.quantity), asInputMode(c.inputMode));
}

/**
 * Cách nhập thật sự dùng để tính (giống web): nguyên liệu tính theo chiếc
 * hoặc chưa khai báo khối lượng thì gram / số lượng đổi thành chiếc.
 */
export function effectiveMode(c: Pick<ComponentLine, 'inputMode' | 'isPieceUnit' | 'weightGrams'>): InputMode {
  if (c.inputMode === 'piece' || c.inputMode === 'carton') return c.inputMode;
  return c.isPieceUnit || c.weightGrams <= 0 ? 'piece' : c.inputMode;
}

/** Số hiển thị theo cách nhập: gram → g, số lượng/chiếc → đơn vị tính, thùng → số thùng. */
export function displayQty(c: ComponentLine): { value: number; suffix: string } {
  const mode = effectiveMode(c);
  if (mode === 'gram') return { value: c.quantity, suffix: 'g' };
  if (mode === 'quantity') return { value: c.quantity / c.weightGrams, suffix: c.unit ?? '' };
  if (mode === 'carton') return { value: c.quantity / c.conversionValue, suffix: 'thùng' };
  return { value: c.quantity, suffix: c.unit ?? '' };
}

/** Đổi số người dùng nhập (theo cách nhập) sang số lưu. */
export function storedQty(c: Pick<ComponentLine, 'inputMode' | 'isPieceUnit' | 'weightGrams' | 'conversionValue'>, input: number): number {
  const mode = effectiveMode(c);
  if (mode === 'quantity') return input * c.weightGrams;
  if (mode === 'carton') return input * c.conversionValue;
  return input;
}

/** Đổi cách nhập nhưng giữ nguyên lượng nguyên liệu cho 1 thành phẩm (giống web). */
export function switchMode(c: ComponentLine, next: InputMode): ComponentLine {
  const from = effectiveMode(c);
  const units = from === 'piece' || from === 'carton' ? c.quantity : c.quantity / c.weightGrams;
  const wg = c.weightGrams;
  const quantity = next === 'gram' || next === 'quantity' ? (wg > 0 ? units * wg : c.quantity) : units;
  return { ...c, inputMode: next, quantity };
}

/** Các cách nhập dùng được cho 1 nguyên liệu. */
export function modesFor(c: Pick<ComponentLine, 'isPieceUnit' | 'weightGrams' | 'conversionValue' | 'unit'>): InputMode[] {
  const byWeight = !c.isPieceUnit && c.weightGrams > 0;
  const carton = c.conversionValue > 1 && (c.unit ?? '').trim().toLowerCase() !== 'thùng';
  return [...(byWeight ? (['gram', 'quantity'] as InputMode[]) : []), 'piece', ...(carton ? (['carton'] as InputMode[]) : [])];
}

/** Giá vốn 1 thành phẩm theo công thức (giống `calculateManufacturingCost` của backend). */
export function formulaCost(components: ComponentLine[]): number {
  return components.reduce((sum, c) => {
    const cost = c.cost ?? 0;
    const mode = effectiveMode(c);
    if (mode === 'piece' || mode === 'carton') return sum + cost * c.quantity;
    return c.weightGrams > 0 ? sum + (cost / c.weightGrams) * c.quantity : sum;
  }, 0);
}

/** Giá vốn combo = Σ giá vốn × số lượng; giá bán gợi ý = Σ giá bán × số lượng. */
export const comboTotals = (components: ComponentLine[]) => ({
  cost: components.reduce((s, c) => s + (c.cost ?? 0) * c.quantity, 0),
  price: components.reduce((s, c) => s + c.basePrice * c.quantity, 0),
});

export interface FormulaView {
  id: number;
  name: string;
  isDefault: boolean;
  components: ComponentLine[];
}

export interface ProductDetail extends ProductRow {
  baseName: string;
  description: string | null;
  orderTemplate: string | null;
  parentName: string | null;
  middleName: string | null;
  childName: string | null;
  tradeMark: { id: number; name: string } | null;
  conversionValue: number;
  weight: number | null;
  weightUnit: string;
  isPieceUnit: boolean;
  shippingWeight: number | null;
  shippingWeightUnit: string;
  vat: number;
  isDirectSale: boolean;
  cargoType: CargoType;
  createdAt: string | null;
  images: string[];
  attributes: { name: string; value: string }[];
  /** Combo: thành phần; hàng sản xuất: thành phần của công thức mặc định. */
  components: ComponentLine[];
  formulas: FormulaView[];
  /** Tồn của chi nhánh đang chọn. */
  stock: StockLevel | null;
  /** Tồn mọi chi nhánh còn hoạt động. */
  stocks: StockLevel[];
}

export function toProductDetail(p: RawProduct, branchId: number | null): ProductDetail {
  const row = toProductRow(p, branchId);
  const stocks = (p.inventories ?? []).filter((i) => i.branch?.isActive !== false).map(toStockLevel);
  const weight = p.weight === null || p.weight === undefined ? null : num(p.weight);
  const shippingWeight = p.shippingWeight === null || p.shippingWeight === undefined ? null : num(p.shippingWeight);
  return {
    ...row,
    baseName: p.name,
    description: p.description || null,
    orderTemplate: p.orderTemplate || null,
    parentName: p.parentName || null,
    middleName: p.middleName || null,
    childName: p.childName || null,
    tradeMark: p.tradeMark ? { id: p.tradeMark.id, name: p.tradeMark.name } : null,
    conversionValue: Math.max(1, num(p.conversionValue) || 1),
    weight: weight && weight > 0 ? weight : null,
    weightUnit: p.weightUnit || 'kg',
    isPieceUnit: !!p.isPieceUnit,
    shippingWeight: shippingWeight && shippingWeight > 0 ? shippingWeight : null,
    shippingWeightUnit: p.shippingWeightUnit || 'g',
    vat: p.vat === null || p.vat === undefined ? 8 : num(p.vat),
    isDirectSale: !!p.isDirectSale,
    cargoType: p.cargoType === 'COLD' ? 'COLD' : 'NORMAL',
    createdAt: p.createdAt ?? null,
    images: (p.images ?? []).map((i) => i.image).filter((x): x is string => !!x),
    attributes: (p.attributes ?? [])
      .filter((a) => a.name && a.value)
      .map((a) => ({ name: a.name as string, value: a.value as string })),
    components: (p.comboComponents ?? []).map((c) => toComponentLine(c, branchId)),
    formulas: (p.formulas ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      isDefault: !!f.isDefault,
      components: (f.components ?? []).map((c) => toComponentLine(c, branchId)),
    })),
    stock: stocks.find((s) => s.branchId === branchId) ?? null,
    stocks,
  };
}

/** "Loại hàng › Nguồn gốc › Danh mục" (bỏ cấp trống). */
export const categoryPath = (d: Pick<ProductDetail, 'parentName' | 'middleName' | 'childName'>) =>
  [d.parentName, d.middleName, d.childName].filter(Boolean).join(' › ');

// ---------- Bộ lọc danh sách ----------

export type StatusFilter = 'active' | 'inactive' | 'all';
export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Đã ngừng' },
  { value: 'all', label: 'Tất cả' },
];

export type SortKey = 'newest' | 'price_desc' | 'price_asc' | 'stock_desc' | 'stock_asc' | 'cost_desc' | 'cost_asc';
export const SORTS: { value: SortKey; label: string; orderBy?: string; dir?: 'asc' | 'desc'; cost?: boolean }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'price_desc', label: 'Giá bán cao → thấp', orderBy: 'basePrice', dir: 'desc' },
  { value: 'price_asc', label: 'Giá bán thấp → cao', orderBy: 'basePrice', dir: 'asc' },
  { value: 'stock_desc', label: 'Tồn kho nhiều → ít', orderBy: 'onHand', dir: 'desc' },
  { value: 'stock_asc', label: 'Tồn kho ít → nhiều', orderBy: 'onHand', dir: 'asc' },
  { value: 'cost_desc', label: 'Giá vốn cao → thấp', orderBy: 'cost', dir: 'desc', cost: true },
  { value: 'cost_asc', label: 'Giá vốn thấp → cao', orderBy: 'cost', dir: 'asc', cost: true },
];

export type StockFilter = 'instock' | 'outstock';
export const STOCK_FILTERS: { value: StockFilter; label: string }[] = [
  { value: 'instock', label: 'Còn hàng' },
  { value: 'outstock', label: 'Hết hàng' },
];

export type ConditionFilter = 'damaged' | 'nearExpiry' | 'any';
export const CONDITION_FILTERS: { value: ConditionFilter; label: string }[] = [
  { value: 'damaged', label: 'Có hàng bục rách' },
  { value: 'nearExpiry', label: 'Có hàng cận date' },
  { value: 'any', label: 'Bục rách hoặc cận date' },
];

export interface ProductFilters {
  status: StatusFilter;
  types: ProductType[];
  parentNames: string[];
  middleNames: string[];
  childNames: string[];
  tradeMarkIds: number[];
  stock: StockFilter | null;
  condition: ConditionFilter | null;
  directSale: boolean | null;
  cargoType: CargoType | null;
  sort: SortKey;
}

export const DEFAULT_FILTERS: ProductFilters = {
  status: 'active',
  types: [],
  parentNames: [],
  middleNames: [],
  childNames: [],
  tradeMarkIds: [],
  stock: null,
  condition: null,
  directSale: null,
  cargoType: null,
  sort: 'newest',
};

/** Số nhóm lọc đang bật trong sheet bộ lọc (không tính trạng thái, sắp xếp). */
export function activeFilterCount(f: ProductFilters): number {
  return [
    f.types.length > 0,
    f.parentNames.length > 0,
    f.middleNames.length > 0,
    f.childNames.length > 0,
    f.tradeMarkIds.length > 0,
    f.stock !== null,
    f.condition !== null,
    f.directSale !== null,
    f.cargoType !== null,
  ].filter(Boolean).length;
}

/**
 * Chọn 1 tên thì gửi `xxxName` (so khớp nguyên tên); nhiều tên thì gửi lặp
 * khóa `xxxNames` — backend không tách dấu phẩy khi nhận dạng mảng.
 */
function names(q: Query, single: string, list: string[]) {
  if (list.length === 1) q[single] = list[0];
  else if (list.length > 1) q[`${single}s`] = list;
}

/**
 * Tham số `GET /products` đúng tên trong `ProductQueryDto`.
 * Luôn gửi `limit` (backend không có mặc định, bỏ đi là tải toàn bộ hàng).
 * Không dùng `categoryIds` (backend lỗi 500).
 */
export function productListQuery(
  search: string,
  f: ProductFilters,
  branchId: number | null,
  page: number,
  canViewCost: boolean,
): Query {
  const q: Query = { page, limit: PAGE_SIZE, search: search.trim() || undefined, branchId: branchId ?? undefined };
  if (f.status !== 'all') q.isActive = f.status === 'active';
  if (f.types.length) q.types = f.types.join(',');
  names(q, 'parentName', f.parentNames);
  names(q, 'middleName', f.middleNames);
  names(q, 'childName', f.childNames);
  if (f.tradeMarkIds.length === 1) q.tradeMarkId = f.tradeMarkIds[0];
  else if (f.tradeMarkIds.length > 1) q.tradeMarkIds = f.tradeMarkIds.join(',');
  if (f.stock) q.stockStatus = f.stock;
  if (f.condition) q.conditionStatus = f.condition;
  if (f.directSale !== null) q.isDirectSale = f.directSale;
  if (f.cargoType) q.cargoType = f.cargoType;
  const sort = SORTS.find((s) => s.value === f.sort);
  if (sort?.orderBy && (!sort.cost || canViewCost)) {
    q.orderBy = sort.orderBy;
    q.orderDirection = sort.dir;
  }
  return q;
}

// ---------- Quyền ----------

export function productPerms(user: PermissionHolder | null | undefined) {
  const update = canDo(user, 'products:update');
  return {
    view: canDo(user, 'products:view'),
    create: canDo(user, 'products:create'),
    update,
    /** Web ẩn nút khi thiếu quyền xóa; backend kiểm quyền sửa → cần cả hai. */
    toggleActive: update && canDo(user, 'products:delete'),
    viewCost: canDo(user, 'products:view_cost_price'),
    viewSale: canDo(user, 'products:view_sale_price'),
    viewCategories: canDo(user, 'categories:view'),
    createCategory: canDo(user, 'categories:create'),
    viewTrademarks: canDo(user, 'trademarks:view'),
    createTrademark: canDo(user, 'trademarks:create'),
    manageUnits: canDo(user, 'units:manage'),
    viewInvoices: canDo(user, 'invoices:view'),
  };
}

export type ProductPerms = ReturnType<typeof productPerms>;

// ---------- Thẻ kho ----------

/** Nhãn loại giao dịch (giống web `ProductInventoryLogTab`). */
export const TX_LABELS: Record<string, string> = {
  PURCHASE: 'Nhập hàng',
  SALE: 'Bán hàng',
  TRANSFER_OUT: 'Chuyển hàng',
  TRANSFER_IN: 'Chuyển hàng',
  PRODUCTION_OUT: 'Sản xuất',
  PRODUCTION_IN: 'Sản xuất',
  DESTRUCTION: 'Xuất hủy',
  INTERNAL_USE: 'Xuất dùng nội bộ',
  INTERNAL_USE_CANCEL: 'Hủy xuất dùng nội bộ',
  INTERNAL_USE_RETURN_IN: 'Nhập lại từ xuất dùng nội bộ',
  INTERNAL_USE_RETURN_CANCEL: 'Hủy nhập lại từ xuất dùng nội bộ',
  RETURN: 'Trả hàng',
  RETURN_CANCEL: 'Hủy trả hàng',
  SUPPLIER_RETURN: 'Trả hàng nhập',
  SUPPLIER_RETURN_OUT: 'Trả hàng nhập',
  STOCK_AUDIT: 'Kiểm hàng',
  STOCK_AUDIT_CANCEL: 'Hủy kiểm hàng',
  CONSIGNMENT_OUT: 'Ký gửi',
  CONSIGNMENT_OUT_CANCEL: 'Hủy ký gửi',
  CONSIGNMENT_RETURN: 'Hoàn ký gửi',
  CONSIGNMENT_RETURN_CANCEL: 'Hủy hoàn ký gửi',
};

/** Nhãn giao dịch của loại tồn (giống web `ProductConditionTab`). */
export const CONDITION_TX_LABELS: Record<string, string> = {
  OPENING: 'Mở sổ',
  CLT_IN: 'Chuyển vào',
  CLT_OUT: 'Điều chỉnh giảm',
  CLT_CANCEL: 'Hủy phiếu CLT',
  SALE_OUT: 'Bán ra',
  SALE_CANCEL: 'Hủy bán',
  PURCHASE_IN: 'Nhập hàng',
  RETURN_IN: 'Nhập hàng trả',
  RETURN_CANCEL: 'Hủy trả hàng',
  SUPPLIER_RETURN_OUT: 'Trả hàng nhập',
  CONSIGNMENT_RETURN_IN: 'Hoàn ký gửi',
  CONSIGNMENT_RETURN_CANCEL: 'Hủy hoàn ký gửi',
  INTERNAL_USE: 'Xuất dùng nội bộ',
  INTERNAL_USE_RETURN_IN: 'Nhập lại từ xuất dùng nội bộ',
  INTERNAL_USE_RETURN_CANCEL: 'Hủy nhập lại từ xuất dùng nội bộ',
};

export type ConditionBucket = 'DAMAGED' | 'NEAR_EXPIRY' | 'PROMO';
export const BUCKETS: { value: ConditionBucket; label: string; tone: Tone }[] = [
  { value: 'DAMAGED', label: 'Bục rách', tone: 'danger' },
  { value: 'NEAR_EXPIRY', label: 'Cận date', tone: 'warning' },
  { value: 'PROMO', label: 'Khuyến mãi', tone: 'info' },
];

export interface RawStockLog {
  id: number;
  transactionType: string;
  refCode?: string | null;
  refType?: string | null;
  refId?: number | null;
  quantity?: string | number | null;
  costPrice?: string | number | null;
  transactionPrice?: string | number | null;
  partnerName?: string | null;
  expiryDate?: string | null;
  transactionDate?: string | null;
  createdAt?: string | null;
  tonCuoi?: string | number | null;
}

export interface StockMove {
  key: string;
  code: string;
  label: string;
  partner: string | null;
  date: string | null;
  quantity: number;
  balance: number;
  /** Giá vốn / giá giao dịch: chỉ hiện khi có quyền xem giá vốn. */
  costPrice: number;
  price: number | null;
  expiryDate: string | null;
  /** Chứng từ mở được trên app (hiện chỉ có hóa đơn bán). */
  invoiceId: number | null;
}

export function toStockMove(r: RawStockLog, labels: Record<string, string> = TX_LABELS): StockMove {
  const price = r.transactionPrice === null || r.transactionPrice === undefined ? null : num(r.transactionPrice);
  return {
    key: String(r.id),
    code: r.refCode || '',
    label: labels[r.transactionType] ?? r.transactionType,
    partner: r.partnerName || null,
    date: r.transactionDate ?? r.createdAt ?? null,
    quantity: num(r.quantity),
    balance: num(r.tonCuoi),
    costPrice: num(r.costPrice),
    price,
    expiryDate: r.expiryDate ?? null,
    invoiceId: r.transactionType === 'SALE' && r.refType === 'invoice' && r.refId ? r.refId : null,
  };
}

export interface ConditionSummary {
  onHand: number;
  good: number;
  damaged: number;
  nearExpiry: number;
  promo: number;
}

export const toConditionSummary = (r: Partial<Record<keyof ConditionSummary, unknown>> | null | undefined): ConditionSummary => ({
  onHand: num(r?.onHand),
  good: num(r?.good),
  damaged: num(r?.damaged),
  nearExpiry: num(r?.nearExpiry),
  promo: num(r?.promo),
});
