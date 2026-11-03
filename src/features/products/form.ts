/** Form thêm / sửa hàng hóa: dữ liệu form, kiểm tra, dữ liệu gửi backend (không gọi mạng). */
import {
  asType,
  comboTotals,
  formulaCost,
  num,
  toComponentLine,
  type CargoType,
  type ComponentLine,
  type ProductType,
  type RawProduct,
} from './model';

export const MAX_IMAGES = 8;

/** Ảnh: `remote` = ảnh đã có trên máy chủ, ngược lại là ảnh vừa chọn trên máy. */
export interface FormImage {
  key: string;
  uri: string;
  remote: boolean;
}

export interface FormAttribute {
  key: string;
  name: string;
  value: string;
}

export interface FormFormula {
  key: string;
  id?: number;
  name: string;
  isDefault: boolean;
  components: ComponentLine[];
}

export interface ProductForm {
  type: ProductType;
  code: string;
  name: string;
  images: FormImage[];
  parentName: string;
  middleName: string;
  childName: string;
  tradeMark: { id: number; name: string } | null;
  cargoType: CargoType;
  /** Giá vốn ở chi nhánh đang chọn. */
  cost: number;
  basePrice: number;
  stock: number;
  min: number;
  max: number;
  weight: number;
  weightUnit: 'kg' | 'g';
  isPieceUnit: boolean;
  shippingWeight: number;
  shippingWeightUnit: 'g' | 'kg';
  unit: string;
  conversionValue: number;
  vat: number;
  attributes: FormAttribute[];
  isDirectSale: boolean;
  description: string;
  orderTemplate: string;
  /** Combo. */
  components: ComponentLine[];
  /** Hàng sản xuất. */
  formulas: FormFormula[];
  /** Hàng sản xuất: người dùng tự gõ giá vốn (không tính theo công thức). */
  manualCost: boolean;
}

/** Phạm vi áp dụng giá vốn mới (giống hộp thoại trên web). */
export interface CostScope {
  scope: 'all' | 'specific';
  branchIds?: number[];
}

let seq = 0;
export const newKey = (prefix = 'k') => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const emptyFormula = (name: string, isDefault: boolean): FormFormula => ({
  key: newKey('f'),
  name,
  isDefault,
  components: [],
});

export function newForm(type: ProductType): ProductForm {
  return {
    type,
    code: '',
    name: '',
    images: [],
    parentName: '',
    middleName: '',
    childName: '',
    tradeMark: null,
    cargoType: 'NORMAL',
    cost: 0,
    basePrice: 0,
    stock: 0,
    min: 0,
    max: 0,
    weight: 0,
    weightUnit: 'kg',
    isPieceUnit: false,
    shippingWeight: 0,
    shippingWeightUnit: 'g',
    unit: '',
    conversionValue: 1,
    vat: 8,
    attributes: [],
    isDirectSale: false,
    description: '',
    orderTemplate: '',
    components: [],
    formulas: type === 4 ? [emptyFormula('Công thức 1', true)] : [],
    manualCost: false,
  };
}

/** Hàng đang có → form (giá vốn / tồn / định mức theo chi nhánh đang chọn). */
export function toProductForm(p: RawProduct, branchId: number | null): ProductForm {
  const type = asType(p.type);
  const inv = p.inventories?.find((i) => i.branchId === branchId);
  return {
    type,
    code: p.code,
    name: p.name,
    images: (p.images ?? [])
      .map((i) => i.image)
      .filter((x): x is string => !!x)
      .map((uri, i) => ({ key: `r${i}`, uri, remote: true })),
    parentName: p.parentName ?? '',
    middleName: p.middleName ?? '',
    childName: p.childName ?? '',
    tradeMark: p.tradeMark ? { id: p.tradeMark.id, name: p.tradeMark.name } : null,
    cargoType: p.cargoType === 'COLD' ? 'COLD' : 'NORMAL',
    cost: num(inv?.cost),
    basePrice: num(p.basePrice),
    stock: num(inv?.onHand),
    min: num(inv?.minQuality),
    max: num(inv?.maxQuality),
    weight: num(p.weight),
    weightUnit: p.weightUnit === 'g' ? 'g' : 'kg',
    isPieceUnit: !!p.isPieceUnit,
    shippingWeight: num(p.shippingWeight),
    shippingWeightUnit: p.shippingWeightUnit === 'kg' ? 'kg' : 'g',
    unit: p.unit ?? '',
    conversionValue: Math.max(1, Math.floor(num(p.conversionValue) || 1)),
    vat: p.vat === null || p.vat === undefined ? 8 : num(p.vat),
    attributes: (p.attributes ?? [])
      .filter((a) => a.name && a.value)
      .map((a, i) => ({ key: `a${i}`, name: a.name as string, value: a.value as string })),
    isDirectSale: !!p.isDirectSale,
    description: p.description ?? '',
    orderTemplate: p.orderTemplate ?? '',
    components: type === 1 ? (p.comboComponents ?? []).map((c) => toComponentLine(c, branchId)) : [],
    formulas:
      type === 4
        ? (p.formulas ?? []).map((f) => ({
            key: `f${f.id}`,
            id: f.id,
            name: f.name,
            isDefault: !!f.isDefault,
            components: (f.components ?? []).map((c) => toComponentLine(c, branchId)),
          }))
        : [],
    manualCost: false,
  };
}

/**
 * Hàng đang có → form. Hàng sản xuất có giá vốn khác giá tính theo công thức
 * (đã tự gõ trước đó) thì giữ giá đang lưu và coi là tự gõ.
 */
export function toEditForm(p: RawProduct, branchId: number | null): ProductForm {
  const f = toProductForm(p, branchId);
  if (f.type === 4 && f.cost > 0 && Math.abs((computedCost(f) ?? 0) - f.cost) > 1) return { ...f, manualCost: true };
  return f;
}

// ---------- Theo loại hàng ----------

/** Hàng hóa và hàng sản xuất có tồn kho, định mức; dịch vụ, combo thì không. */
export const hasStock = (t: ProductType) => t === 2 || t === 4;
/** Dịch vụ không có khối lượng, quy cách đóng gói. */
export const hasPhysical = (t: ProductType) => t !== 3;

export const defaultFormula = (f: ProductForm) => f.formulas.find((x) => x.isDefault) ?? f.formulas[0];

/** Giá vốn tự tính: combo theo thành phần, hàng sản xuất theo công thức mặc định. */
export function computedCost(f: ProductForm): number | null {
  if (f.type === 1) return Math.round(comboTotals(f.components).cost);
  if (f.type === 4) {
    const d = defaultFormula(f);
    return d ? Math.round(formulaCost(d.components)) : 0;
  }
  return null;
}

/** Giá vốn sẽ lưu (combo luôn tự tính; hàng sản xuất tự tính trừ khi tự gõ). */
export function effectiveCost(f: ProductForm): number {
  const auto = computedCost(f);
  if (auto === null || (f.type === 4 && f.manualCost)) return f.cost;
  return auto;
}

export const comboTotalsOf = (f: ProductForm) => comboTotals(f.components);

/** Combo để trống giá bán: lấy tổng giá bán thành phần (giống web). */
export function effectiveBasePrice(f: ProductForm): number {
  if (f.type === 1 && !f.basePrice) return comboTotals(f.components).price;
  return f.basePrice;
}

// ---------- So sánh ----------

const trimEq = (a: string, b: string) => a.trim() === b.trim();
const cleanAttributes = (list: FormAttribute[]) =>
  list.map((a) => ({ name: a.name.trim(), value: a.value.trim() })).filter((a) => a.name && a.value);
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const comboPayload = (list: ComponentLine[]) => list.map((c) => ({ componentProductId: c.productId, quantity: c.quantity }));
const formulasPayload = (list: FormFormula[]) =>
  list.map((f) => ({
    ...(f.id ? { id: f.id } : {}),
    name: f.name.trim(),
    isDefault: f.isDefault,
    components: f.components.map((c) => ({ componentProductId: c.productId, quantity: c.quantity, inputMode: c.inputMode })),
  }));
const imageList = (list: FormImage[]) => list.map((i) => (i.remote ? i.uri : `local:${i.key}`));

/** Các nhóm trường đã đổi so với lúc mở form. */
export function formChanges(f: ProductForm, o: ProductForm) {
  const c = {
    code: !trimEq(f.code, o.code),
    name: !trimEq(f.name, o.name),
    images: !sameJson(imageList(f.images), imageList(o.images)),
    parentName: !trimEq(f.parentName, o.parentName),
    middleName: !trimEq(f.middleName, o.middleName),
    childName: !trimEq(f.childName, o.childName),
    tradeMark: (f.tradeMark?.id ?? 0) !== (o.tradeMark?.id ?? 0),
    cargoType: f.cargoType !== o.cargoType,
    cost: effectiveCost(f) !== effectiveCost(o),
    basePrice: effectiveBasePrice(f) !== effectiveBasePrice(o),
    stock: f.stock !== o.stock,
    limits: f.min !== o.min || f.max !== o.max,
    weight: f.weight !== o.weight || f.weightUnit !== o.weightUnit,
    isPieceUnit: f.isPieceUnit !== o.isPieceUnit,
    shippingWeight: f.shippingWeight !== o.shippingWeight || f.shippingWeightUnit !== o.shippingWeightUnit,
    unit: !trimEq(f.unit, o.unit),
    conversionValue: f.conversionValue !== o.conversionValue,
    vat: f.vat !== o.vat,
    attributes: !sameJson(cleanAttributes(f.attributes), cleanAttributes(o.attributes)),
    isDirectSale: f.isDirectSale !== o.isDirectSale,
    description: !trimEq(f.description, o.description),
    orderTemplate: !trimEq(f.orderTemplate, o.orderTemplate),
    components: !sameJson(comboPayload(f.components), comboPayload(o.components)),
    formulas: !sameJson(formulasPayload(f.formulas), formulasPayload(o.formulas)),
    manualCost: f.manualCost !== o.manualCost,
  };
  return { ...c, any: Object.values(c).some(Boolean) };
}

export type FormChanges = ReturnType<typeof formChanges>;

/** Lưu cần hỏi phạm vi giá vốn: thêm mới có giá vốn, hoặc sửa làm đổi giá vốn. */
export function needsCostScope(f: ProductForm, o: ProductForm | null, viewCost: boolean): boolean {
  if (!viewCost) return false;
  return o ? effectiveCost(f) !== effectiveCost(o) : effectiveCost(f) > 0;
}

// ---------- Kiểm tra ----------

/** Lỗi đầu tiên cần sửa trước khi lưu (giống câu báo của backend), không có thì null. */
export function validateProductForm(f: ProductForm, editing: boolean): string | null {
  if (editing && !f.code.trim()) return 'Vui lòng nhập mã hàng';
  if (!f.name.trim()) return 'Vui lòng nhập tên hàng';
  if (!Number.isInteger(f.conversionValue) || f.conversionValue < 1) return 'Định lượng đóng gói phải là số nguyên từ 1 trở lên';
  if (f.vat < 0 || f.vat > 100) return 'VAT phải từ 0 đến 100%';
  if (hasStock(f.type) && f.max > 0 && f.min > f.max) return 'Định mức tồn thấp nhất không được lớn hơn cao nhất';
  const half = f.attributes.find((a) => !a.name.trim() !== !a.value.trim());
  if (half) return half.name.trim() ? `Thuộc tính “${half.name.trim()}” chưa có giá trị` : 'Có thuộc tính chưa có tên';
  if (f.type === 1) {
    if (!f.components.length) return 'Combo cần ít nhất 1 hàng thành phần';
    if (f.components.some((c) => !(c.quantity > 0))) return 'Số lượng thành phần phải lớn hơn 0';
  }
  if (f.type === 4) {
    if (!f.formulas.length) return 'Hàng sản xuất cần ít nhất 1 công thức';
    const names = new Set<string>();
    for (const [i, x] of f.formulas.entries()) {
      const name = x.name.trim() || `Công thức ${i + 1}`;
      if (names.has(name.toLowerCase())) return `Trùng tên công thức "${name}"`;
      names.add(name.toLowerCase());
      if (!x.components.length) return `Công thức "${name}" chưa có thành phần`;
      if (new Set(x.components.map((c) => c.productId)).size !== x.components.length) return `Công thức "${name}" có thành phần bị trùng`;
      if (x.components.some((c) => !(c.quantity > 0))) return `Công thức "${name}" có thành phần chưa nhập số lượng`;
    }
    if (f.formulas.filter((x) => x.isDefault).length > 1) return 'Chỉ được chọn 1 công thức mặc định';
  }
  return null;
}

// ---------- Dữ liệu gửi backend ----------

export interface SaveContext {
  branchId: number | null;
  viewCost: boolean;
  viewSale: boolean;
  /** Ảnh sau khi tải lên (đúng thứ tự trong form). */
  imageUrls: string[];
  costScope?: CostScope | null;
}

const costScopeFields = (s: CostScope | null | undefined) =>
  s ? { costScope: s.scope, ...(s.scope === 'specific' ? { costBranchIds: s.branchIds ?? [] } : {}) } : {};

const opt = (s: string) => s.trim() || undefined;

/**
 * Thêm mới (`POST /products`). Mã để trống thì hệ thống tự tạo. Giá vốn /
 * giá bán chỉ gửi khi người dùng xem được. Không gửi `cost`, `image`,
 * `collaboratorPrice`, `misa_*`, `initialInventory`.
 */
export function buildProductCreate(f: ProductForm, ctx: SaveContext): Record<string, unknown> {
  const body: Record<string, unknown> = {
    code: f.code.trim(),
    name: f.name.trim(),
    type: f.type,
    branchId: ctx.branchId ?? undefined,
    description: opt(f.description),
    orderTemplate: opt(f.orderTemplate),
    parentName: opt(f.parentName),
    middleName: opt(f.middleName),
    childName: opt(f.childName),
    tradeMarkId: f.tradeMark?.id,
    imageUrls: ctx.imageUrls,
    isDirectSale: f.isDirectSale,
    cargoType: f.cargoType,
    vat: f.vat,
    unit: opt(f.unit),
    attributes: cleanAttributes(f.attributes),
  };
  if (ctx.viewSale) body.basePrice = effectiveBasePrice(f);
  if (ctx.viewCost) {
    body.purchasePrice = effectiveCost(f);
    if (f.type === 4) body.manualCostOverride = f.manualCost;
    Object.assign(body, costScopeFields(ctx.costScope));
  }
  if (hasStock(f.type)) {
    body.stockQuantity = f.stock;
    body.minStockAlert = f.min;
    body.maxStockAlert = f.max;
  }
  if (hasPhysical(f.type)) {
    body.isPieceUnit = f.isPieceUnit;
    if (!f.isPieceUnit && f.weight > 0) body.weight = f.weight;
    body.weightUnit = f.weightUnit;
    if (f.shippingWeight > 0) body.shippingWeight = f.shippingWeight;
    body.shippingWeightUnit = f.shippingWeightUnit;
    body.conversionValue = f.conversionValue;
  }
  if (f.type === 1) body.components = comboPayload(f.components);
  if (f.type === 4) body.formulas = formulasPayload(f.formulas);
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
}

/**
 * Sửa (`PUT /products/:id`): CHỈ gửi trường đã đổi (trường không gửi giữ
 * nguyên). Lưu ý backend:
 * - `imageUrls` / `attributes` / `components` / `formulas` thay cả danh sách.
 * - Đổi tồn kho tạo phiếu kiểm kho → chỉ gửi khi tồn đổi, kèm `branchId`.
 * - Định mức chỉ được lưu khi có `purchasePrice` → gửi kèm giá vốn hiện tại.
 * - Không bao giờ gửi `cost`, `image`, `collaboratorPrice` (backend lỗi).
 */
export function buildProductUpdate(f: ProductForm, o: ProductForm, ctx: SaveContext): Record<string, unknown> {
  const c = formChanges(f, o);
  const body: Record<string, unknown> = {};
  if (c.code) body.code = f.code.trim();
  if (c.name) body.name = f.name.trim();
  if (c.description) body.description = f.description.trim();
  if (c.orderTemplate) body.orderTemplate = f.orderTemplate.trim();
  // Chuỗi rỗng = bỏ nhóm hàng (backend lưu null).
  if (c.parentName) body.parentName = f.parentName.trim();
  if (c.middleName) body.middleName = f.middleName.trim();
  if (c.childName) body.childName = f.childName.trim();
  // 0 = bỏ thương hiệu.
  if (c.tradeMark) body.tradeMarkId = f.tradeMark?.id ?? 0;
  if (c.cargoType) body.cargoType = f.cargoType;
  if (c.isDirectSale) body.isDirectSale = f.isDirectSale;
  if (c.vat) body.vat = f.vat;
  if (c.unit && f.unit.trim()) body.unit = f.unit.trim();
  if (c.images) body.imageUrls = ctx.imageUrls;
  if (c.attributes) body.attributes = cleanAttributes(f.attributes);
  if (hasPhysical(f.type)) {
    if (c.isPieceUnit) body.isPieceUnit = f.isPieceUnit;
    if (c.weight) {
      if (!f.isPieceUnit) body.weight = f.weight;
      body.weightUnit = f.weightUnit;
    }
    if (c.shippingWeight) {
      body.shippingWeight = f.shippingWeight;
      body.shippingWeightUnit = f.shippingWeightUnit;
    }
    if (c.conversionValue) body.conversionValue = f.conversionValue;
  }
  if (ctx.viewSale && c.basePrice) body.basePrice = effectiveBasePrice(f);

  const limits = hasStock(f.type) && c.limits;
  if (ctx.viewCost && (c.cost || limits || (f.type === 4 && c.manualCost))) {
    body.purchasePrice = effectiveCost(f);
    if (f.type === 4) body.manualCostOverride = f.manualCost;
    if (c.cost) Object.assign(body, costScopeFields(ctx.costScope));
  }
  if (ctx.viewCost && limits) {
    body.minStockAlert = f.min;
    body.maxStockAlert = f.max;
  }
  if (hasStock(f.type) && c.stock) body.stockQuantity = f.stock;
  if (body.purchasePrice !== undefined || body.stockQuantity !== undefined) body.branchId = ctx.branchId ?? undefined;

  if (f.type === 1 && c.components) body.components = comboPayload(f.components);
  if (f.type === 4 && c.formulas) body.formulas = formulasPayload(f.formulas);
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
}
