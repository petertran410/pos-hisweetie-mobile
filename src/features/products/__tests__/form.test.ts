import { describe, expect, it } from '@jest/globals';
import {
  buildProductCreate,
  buildProductUpdate,
  effectiveCost,
  formChanges,
  needsCostScope,
  newForm,
  toEditForm,
  validateProductForm,
  type ProductForm,
  type SaveContext,
} from '../form';
import { displayQty, formulaCost, storedQty, switchMode, toComponentFromProduct, type RawProduct } from '../model';

const ctx = (over: Partial<SaveContext> = {}): SaveContext => ({
  branchId: 1,
  viewCost: true,
  viewSale: true,
  imageUrls: ['https://cdn.example/a.jpg'],
  ...over,
});

const raw = (over: Partial<RawProduct> = {}): RawProduct => ({
  id: 5,
  code: 'SP000005',
  name: 'Siro dâu',
  type: 2,
  basePrice: '52000',
  unit: 'chai',
  conversionValue: '12',
  weight: '1',
  weightUnit: 'kg',
  vat: '8',
  parentName: 'Nguyên liệu',
  tradeMark: { id: 3, name: 'HS' },
  images: [{ image: 'https://cdn.example/a.jpg' }],
  attributes: [{ name: 'Vị', value: 'Dâu' }],
  inventories: [{ branchId: 1, cost: '30000', onHand: '40', minQuality: '5', maxQuality: '100' }],
  ...over,
});

const FORBIDDEN = ['cost', 'image', 'collaboratorPrice', 'misa_code', 'misa_name', 'misa_unit', 'initialInventory'];

describe('buildProductCreate', () => {
  it('hàng hóa: mã trống để tự tạo, gửi giá theo quyền, không gửi trường cấm', () => {
    const f: ProductForm = { ...newForm(2), name: '  Trà đen ', cost: 120000, basePrice: 185000, stock: 10, unit: 'gói' };
    const body = buildProductCreate(f, ctx({ costScope: { scope: 'all' } }));
    expect(body).toMatchObject({
      code: '',
      name: 'Trà đen',
      type: 2,
      branchId: 1,
      purchasePrice: 120000,
      basePrice: 185000,
      stockQuantity: 10,
      minStockAlert: 0,
      maxStockAlert: 0,
      unit: 'gói',
      conversionValue: 1,
      vat: 8,
      costScope: 'all',
      imageUrls: ['https://cdn.example/a.jpg'],
    });
    for (const k of FORBIDDEN) expect(body).not.toHaveProperty(k);
    expect(body).not.toHaveProperty('weight');
    expect(body).not.toHaveProperty('costBranchIds');
  });

  it('không có quyền xem giá thì không gửi giá', () => {
    const body = buildProductCreate({ ...newForm(2), name: 'A', cost: 5, basePrice: 9 }, ctx({ viewCost: false, viewSale: false }));
    expect(body).not.toHaveProperty('purchasePrice');
    expect(body).not.toHaveProperty('basePrice');
  });

  it('dịch vụ: không gửi tồn kho, khối lượng, quy cách', () => {
    const body = buildProductCreate({ ...newForm(3), name: 'Lắp đặt' }, ctx());
    expect(body).not.toHaveProperty('stockQuantity');
    expect(body).not.toHaveProperty('weightUnit');
    expect(body).not.toHaveProperty('conversionValue');
  });

  it('combo: gửi thành phần + nhóm hàng, giá vốn tự tính, không gửi tồn kho', () => {
    const a = toComponentFromProduct({ id: 7, code: 'A', name: 'A', basePrice: '10000', inventories: [{ branchId: 1, cost: '6000' }] }, 1, 2, 'gram');
    const b = toComponentFromProduct({ id: 8, code: 'B', name: 'B', basePrice: '5000', inventories: [{ branchId: 1, cost: '3000' }] }, 1, 1, 'gram');
    const f: ProductForm = { ...newForm(1), name: 'Combo', parentName: 'Quà tặng', components: [a, b] };
    const body = buildProductCreate(f, ctx({ costScope: { scope: 'specific', branchIds: [1, 2] } }));
    expect(body).toMatchObject({
      type: 1,
      parentName: 'Quà tặng',
      purchasePrice: 15000,
      // Giá bán trống → tổng giá bán thành phần.
      basePrice: 25000,
      components: [
        { componentProductId: 7, quantity: 2 },
        { componentProductId: 8, quantity: 1 },
      ],
      costScope: 'specific',
      costBranchIds: [1, 2],
    });
    expect(body).not.toHaveProperty('stockQuantity');
  });
});

describe('buildProductUpdate', () => {
  const o = toEditForm(raw(), 1);

  it('không đổi gì thì không gửi gì', () => {
    expect(formChanges(o, o).any).toBe(false);
    expect(buildProductUpdate(o, o, ctx())).toEqual({});
  });

  it('chỉ gửi trường đã đổi; mã chỉ gửi khi đổi', () => {
    expect(buildProductUpdate({ ...o, name: 'Siro dâu mới' }, o, ctx())).toEqual({ name: 'Siro dâu mới' });
    expect(buildProductUpdate({ ...o, code: 'SP9' }, o, ctx())).toEqual({ code: 'SP9' });
    expect(buildProductUpdate({ ...o, basePrice: 60000 }, o, ctx())).toEqual({ basePrice: 60000 });
    expect(buildProductUpdate({ ...o, basePrice: 60000 }, o, ctx({ viewSale: false }))).toEqual({});
  });

  it('bỏ nhóm hàng / thương hiệu', () => {
    expect(buildProductUpdate({ ...o, parentName: '', tradeMark: null }, o, ctx())).toEqual({ parentName: '', tradeMarkId: 0 });
  });

  it('đổi tồn kho: gửi stockQuantity kèm branchId, không gửi giá vốn', () => {
    expect(buildProductUpdate({ ...o, stock: 42 }, o, ctx())).toEqual({ stockQuantity: 42, branchId: 1 });
  });

  it('đổi định mức: gửi kèm giá vốn hiện tại (không hỏi phạm vi)', () => {
    const body = buildProductUpdate({ ...o, max: 200 }, o, ctx({ costScope: { scope: 'all' } }));
    expect(body).toEqual({ purchasePrice: 30000, minStockAlert: 5, maxStockAlert: 200, branchId: 1 });
    expect(needsCostScope({ ...o, max: 200 }, o, true)).toBe(false);
  });

  it('đổi giá vốn: hỏi phạm vi và gửi phạm vi', () => {
    const f = { ...o, cost: 32000 };
    expect(needsCostScope(f, o, true)).toBe(true);
    expect(needsCostScope(f, o, false)).toBe(false);
    expect(buildProductUpdate(f, o, ctx({ costScope: { scope: 'specific', branchIds: [1] } }))).toEqual({
      purchasePrice: 32000,
      costScope: 'specific',
      costBranchIds: [1],
      branchId: 1,
    });
  });

  it('ảnh / thuộc tính: gửi đủ danh sách khi đổi', () => {
    const f = { ...o, images: [...o.images, { key: 'n', uri: 'file:///b.jpg', remote: false }] };
    expect(buildProductUpdate(f, o, ctx({ imageUrls: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'] }))).toEqual({
      imageUrls: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
    });
    const g = { ...o, attributes: [...o.attributes, { key: 'x', name: 'Kích cỡ', value: ' 1L ' }] };
    expect(buildProductUpdate(g, o, ctx())).toEqual({
      attributes: [
        { name: 'Vị', value: 'Dâu' },
        { name: 'Kích cỡ', value: '1L' },
      ],
    });
  });

  it('không bao giờ gửi trường gây lỗi backend', () => {
    const f = { ...o, name: 'X', cost: 1, basePrice: 2, stock: 3, min: 1, max: 9, weight: 2, vat: 10, isDirectSale: true };
    const body = buildProductUpdate(f, o, ctx({ costScope: { scope: 'all' } }));
    for (const k of FORBIDDEN) expect(body).not.toHaveProperty(k);
  });
});

describe('hàng sản xuất', () => {
  const flour = toComponentFromProduct(
    { id: 7, code: 'BOT', name: 'Bột', unit: 'gói', weight: '1', weightUnit: 'kg', conversionValue: '20', inventories: [{ branchId: 1, cost: '100000' }] },
    1,
    250,
    'gram',
  );
  const cup = toComponentFromProduct({ id: 8, code: 'LY', name: 'Ly', unit: 'cái', isPieceUnit: true, inventories: [{ branchId: 1, cost: '500' }] }, 1, 2, 'piece');

  it('đổi cách nhập giữ nguyên lượng; tính giá vốn như backend', () => {
    expect(displayQty(flour)).toEqual({ value: 250, suffix: 'g' });
    const byQty = switchMode(flour, 'quantity');
    expect(byQty.quantity).toBe(250);
    expect(displayQty(byQty)).toEqual({ value: 0.25, suffix: 'gói' });
    const byCarton = switchMode(flour, 'carton');
    expect(byCarton.quantity).toBe(0.25);
    expect(displayQty(byCarton).value).toBeCloseTo(0.0125);
    expect(storedQty(byCarton, 1)).toBe(20);
    // 250g × 100.000/1000g + 2 ly × 500
    expect(formulaCost([flour, cup])).toBe(26000);
  });

  it('kiểm tra công thức giống backend', () => {
    const f: ProductForm = {
      ...newForm(4),
      name: 'Trà sữa',
      formulas: [
        { key: 'a', name: 'Chuẩn', isDefault: true, components: [flour] },
        { key: 'b', name: 'chuẩn', isDefault: false, components: [cup] },
      ],
    };
    expect(validateProductForm(f, false)).toMatch(/Trùng tên công thức/);
    expect(validateProductForm({ ...f, formulas: [{ ...f.formulas[0], components: [] }] }, false)).toMatch(/chưa có thành phần/);
    expect(validateProductForm({ ...f, formulas: [f.formulas[0]] }, false)).toBeNull();
    expect(validateProductForm({ ...f, formulas: [{ ...f.formulas[0], components: [{ ...flour, quantity: 0 }] }] }, false)).toMatch(/chưa nhập số lượng/);
  });

  it('giá vốn tự tính theo công thức mặc định; tự gõ thì gửi manualCostOverride', () => {
    const f: ProductForm = {
      ...newForm(4),
      name: 'Trà sữa',
      formulas: [{ key: 'a', name: 'Chuẩn', isDefault: true, components: [flour, cup] }],
    };
    expect(effectiveCost(f)).toBe(26000);
    const body = buildProductCreate(f, ctx());
    expect(body).toMatchObject({
      purchasePrice: 26000,
      manualCostOverride: false,
      formulas: [
        {
          name: 'Chuẩn',
          isDefault: true,
          components: [
            { componentProductId: 7, quantity: 250, inputMode: 'gram' },
            { componentProductId: 8, quantity: 2, inputMode: 'piece' },
          ],
        },
      ],
    });
    expect(buildProductCreate({ ...f, manualCost: true, cost: 30000 }, ctx())).toMatchObject({ purchasePrice: 30000, manualCostOverride: true });
  });

  it('sửa: giá vốn đang lưu khác giá tính → coi là tự gõ; đổi công thức chỉ gửi công thức (+ giá vốn khi đổi)', () => {
    const r = raw({
      type: 4,
      inventories: [{ branchId: 1, cost: '26000', onHand: '3' }],
      formulas: [
        {
          id: 11,
          name: 'Chuẩn',
          isDefault: true,
          components: [
            {
              componentProductId: 7,
              quantity: '250',
              inputMode: 'gram',
              componentProduct: { id: 7, code: 'BOT', name: 'Bột', unit: 'gói', weight: '1', weightUnit: 'kg', inventories: [{ branchId: 1, cost: '100000' }] },
            },
            {
              componentProductId: 8,
              quantity: '2',
              inputMode: 'piece',
              componentProduct: { id: 8, code: 'LY', name: 'Ly', isPieceUnit: true, inventories: [{ branchId: 1, cost: '500' }] },
            },
          ],
        },
      ],
    });
    const o = toEditForm(r, 1);
    expect(o.manualCost).toBe(false);
    expect(toEditForm(raw({ ...r, inventories: [{ branchId: 1, cost: '40000' }] }), 1).manualCost).toBe(true);

    const f = { ...o, formulas: [{ ...o.formulas[0], name: 'Chuẩn mới' }] };
    const body = buildProductUpdate(f, o, ctx());
    expect(body).toEqual({
      formulas: [expect.objectContaining({ id: 11, name: 'Chuẩn mới', isDefault: true })],
    });
  });
});

describe('validateProductForm', () => {
  it('bắt buộc tên; khi sửa bắt buộc mã; định mức; thuộc tính thiếu', () => {
    const f = { ...newForm(2), name: 'A' };
    expect(validateProductForm({ ...f, name: ' ' }, false)).toMatch(/tên hàng/);
    expect(validateProductForm(f, false)).toBeNull();
    expect(validateProductForm(f, true)).toMatch(/mã hàng/);
    expect(validateProductForm({ ...f, min: 10, max: 5 }, false)).toMatch(/Định mức/);
    expect(validateProductForm({ ...f, conversionValue: 0 }, false)).toMatch(/Định lượng đóng gói/);
    expect(validateProductForm({ ...f, attributes: [{ key: 'a', name: 'Vị', value: '' }] }, false)).toMatch(/Vị/);
    expect(validateProductForm({ ...newForm(1), name: 'C' }, false)).toMatch(/Combo cần/);
  });
});
