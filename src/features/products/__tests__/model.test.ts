import { describe, expect, it } from '@jest/globals';
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  productListQuery,
  productPerms,
  toProductDetail,
  toProductRow,
  toStockMove,
  type RawProduct,
} from '../model';

const raw = (over: Partial<RawProduct> = {}): RawProduct => ({
  id: 5,
  code: 'SP000005',
  name: 'Siro dâu',
  fullName: 'Siro dâu - 1L',
  type: 2,
  basePrice: '52000',
  unit: 'chai',
  conversionValue: '12',
  isActive: true,
  childName: 'Siro',
  parentName: 'Nguyên liệu',
  images: [{ image: 'https://cdn.example/a.jpg' }, { image: null }],
  inventories: [
    {
      branchId: 1,
      branch: { name: 'Kho tổng', isActive: true },
      cost: '30000',
      onHand: '40',
      damagedQuantity: '3',
      nearExpiryQuantity: '2',
      promoQuantity: '-1',
      reserved: '5',
      onOrder: '10',
      minQuality: '5',
      maxQuality: '100',
    },
    { branchId: 2, branch: { name: 'Chi nhánh cũ', isActive: false }, onHand: '9' },
    { branchId: 3, branchName: 'Cửa hàng 3', onHand: '0' },
  ],
  ...over,
});

describe('toProductRow', () => {
  it('đổi số Decimal, lấy tồn theo chi nhánh đang chọn', () => {
    expect(toProductRow(raw(), 1)).toMatchObject({
      id: 5,
      name: 'Siro dâu - 1L',
      type: 2,
      isActive: true,
      image: 'https://cdn.example/a.jpg',
      category: 'Siro',
      basePrice: 52000,
      cost: 30000,
      onHand: 40,
      damaged: 3,
      nearExpiry: 2,
    });
    expect(toProductRow(raw(), 3)).toMatchObject({ onHand: 0, cost: null });
    // Chi nhánh chưa có dòng tồn.
    expect(toProductRow(raw(), 9)).toMatchObject({ onHand: null, cost: null });
  });

  it('giá vốn bị backend ẩn (thiếu quyền) thì là null, không phải 0', () => {
    const r = raw();
    delete r.inventories?.[0].cost;
    expect(toProductRow(r, 1).cost).toBeNull();
  });

  it('combo: giá vốn = Σ giá vốn thành phần × số lượng', () => {
    const combo = raw({
      type: 1,
      comboComponents: [
        { componentProductId: 7, quantity: '2', componentProduct: { id: 7, code: 'A', name: 'A', inventories: [{ branchId: 1, cost: '1000' }] } },
        { componentProductId: 8, quantity: '3', componentProduct: { id: 8, code: 'B', name: 'B', inventories: [{ branchId: 1, cost: '500' }] } },
      ],
    });
    expect(toProductRow(combo, 1).cost).toBe(3500);
  });
});

describe('toProductDetail', () => {
  it('tồn mọi chi nhánh còn hoạt động, hàng tốt trừ bục rách / cận date / khuyến mãi dương', () => {
    const d = toProductDetail(raw(), 1);
    expect(d.stocks.map((s) => s.branchId)).toEqual([1, 3]);
    expect(d.stock).toMatchObject({ branchName: 'Kho tổng', onHand: 40, good: 35, reserved: 5, onOrder: 10, min: 5, max: 100, cost: 30000 });
    expect(d.stocks[1]).toMatchObject({ branchName: 'Cửa hàng 3', cost: null });
    expect(d).toMatchObject({ conversionValue: 12, vat: 8, cargoType: 'NORMAL', images: ['https://cdn.example/a.jpg'], weight: null });
  });

  it('hàng sản xuất: đọc công thức và thành phần', () => {
    const d = toProductDetail(
      raw({
        type: 4,
        formulas: [
          {
            id: 1,
            name: 'Chuẩn',
            isDefault: true,
            components: [{ componentProductId: 7, quantity: '250', inputMode: 'gram', componentProduct: { id: 7, code: 'A', name: 'Bột' } }],
          },
          { id: 2, name: 'Thay thế', components: [] },
        ],
      }),
      1,
    );
    expect(d.formulas).toHaveLength(2);
    expect(d.formulas[0]).toMatchObject({ isDefault: true, components: [{ productId: 7, quantity: 250, inputMode: 'gram', name: 'Bột' }] });
  });
});

describe('productListQuery', () => {
  it('luôn có limit, mặc định chỉ lấy hàng đang hoạt động', () => {
    expect(productListQuery('', DEFAULT_FILTERS, 1, 1, true)).toEqual({ page: 1, limit: 20, search: undefined, branchId: 1, isActive: true });
  });

  it('đúng tên tham số backend, không dùng categoryIds', () => {
    const q = productListQuery(
      ' siro ',
      {
        ...DEFAULT_FILTERS,
        status: 'all',
        types: [2, 4],
        parentNames: ['Nguyên liệu'],
        childNames: ['Siro', 'Bột, kem'],
        tradeMarkIds: [3],
        stock: 'instock',
        condition: 'damaged',
        directSale: false,
        cargoType: 'COLD',
        sort: 'price_asc',
      },
      2,
      3,
      true,
    );
    expect(q).toEqual({
      page: 3,
      limit: 20,
      search: 'siro',
      branchId: 2,
      types: '2,4',
      parentName: 'Nguyên liệu',
      childNames: ['Siro', 'Bột, kem'],
      tradeMarkId: 3,
      stockStatus: 'instock',
      conditionStatus: 'damaged',
      isDirectSale: false,
      cargoType: 'COLD',
      orderBy: 'basePrice',
      orderDirection: 'asc',
    });
    expect(q).not.toHaveProperty('categoryIds');
    expect(q).not.toHaveProperty('isActive');
  });

  it('không sắp xếp theo giá vốn khi không có quyền xem giá vốn', () => {
    const q = productListQuery('', { ...DEFAULT_FILTERS, sort: 'cost_desc' }, 1, 1, false);
    expect(q).not.toHaveProperty('orderBy');
  });

  it('đếm số nhóm lọc đang bật (không tính trạng thái, sắp xếp)', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, status: 'all', sort: 'price_asc', types: [1], directSale: false })).toBe(2);
  });
});

describe('productPerms', () => {
  it('ngừng hoạt động cần cả quyền sửa và quyền xóa', () => {
    expect(productPerms({ permissions: ['products:update'] }).toggleActive).toBe(false);
    expect(productPerms({ permissions: ['products:update', 'products:delete'] }).toggleActive).toBe(true);
    expect(productPerms({ roles: ['Super Admin'] })).toMatchObject({ toggleActive: true, viewCost: true, viewSale: true });
  });
});

describe('toStockMove', () => {
  it('nhãn giao dịch, tồn cuối, chỉ hóa đơn bán mới mở được', () => {
    expect(
      toStockMove({ id: 1, transactionType: 'SALE', refType: 'invoice', refId: 77, refCode: 'HD077', quantity: '-2', tonCuoi: '38', costPrice: '30000' }),
    ).toMatchObject({ code: 'HD077', label: 'Bán hàng', quantity: -2, balance: 38, invoiceId: 77, costPrice: 30000, price: null });
    expect(toStockMove({ id: 2, transactionType: 'PURCHASE', refType: 'purchase_order', refId: 3, quantity: '10' })).toMatchObject({
      label: 'Nhập hàng',
      invoiceId: null,
    });
    expect(toStockMove({ id: 3, transactionType: 'LẠ' }).label).toBe('LẠ');
  });
});
