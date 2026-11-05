import { describe, expect, it, jest } from '@jest/globals';
import { canEnterArea, splitTabs } from '../tabs';

// babel-jest đưa jest.mock lên trước các import.
jest.mock('@/core/session', () => ({ useSession: jest.fn() }));

const keys = (tabs: { key: string }[]) => tabs.map((t) => t.key);

describe('tabs by permission', () => {
  it('Super Admin: 4 tabs + Báo đơn, Phiếu kho moved to Thêm', () => {
    const { visible, overflow } = splitTabs({ roles: ['Super Admin'], permissions: [] });
    expect(keys(visible)).toEqual(['tong-quan', 'ban-hang', 'don-hang', 'khach-hang']);
    expect(keys(overflow)).toEqual(['bao-don', 'phieu-kho']);
  });

  it('driver gets Báo đơn and Phiếu kho as tabs', () => {
    const { visible, overflow } = splitTabs({
      roles: ['Lái xe'],
      permissions: ['invoices:view', 'packing_slips:create', 'packing_loadings:create', 'vehicles:create', 'warehouse_expense:create'],
    });
    expect(keys(visible)).toEqual(['don-hang', 'bao-don', 'phieu-kho']);
    expect(overflow).toEqual([]);
  });

  it('salesperson without dashboard keeps Báo đơn as a tab', () => {
    const { visible, overflow } = splitTabs({
      roles: ['Sale'],
      permissions: ['invoices:create', 'invoices:view', 'customers:view', 'packing_slips:create'],
    });
    expect(keys(visible)).toEqual(['ban-hang', 'don-hang', 'khach-hang', 'bao-don']);
    expect(overflow).toEqual([]);
  });

  it('warehouse staff only sees Báo đơn', () => {
    const { visible } = splitTabs({ roles: ['Kho'], permissions: ['packing_hangs:create'] });
    expect(keys(visible)).toEqual(['bao-don']);
  });

  it('no permission → no tabs (only Thêm)', () => {
    expect(splitTabs(null).visible).toEqual([]);
  });
});

describe('area guard (link mở thẳng vào mục bị ẩn)', () => {
  const driver = { roles: ['Lái xe'], permissions: ['packing_loadings:create', 'vehicles:create'] };

  it('chặn mục không có quyền, kể cả Hàng hóa (không phải tab)', () => {
    expect(canEnterArea(driver, 'bao-don')).toBe(true);
    expect(canEnterArea(driver, 'phieu-kho')).toBe(true);
    expect(canEnterArea(driver, 'khach-hang')).toBe(false);
    expect(canEnterArea(driver, 'don-hang')).toBe(false);
    expect(canEnterArea(driver, 'ban-hang')).toBe(false);
    expect(canEnterArea(driver, 'tong-quan')).toBe(false);
    expect(canEnterArea(driver, 'hang-hoa')).toBe(false);
    expect(canEnterArea({ roles: [], permissions: ['products:view'] }, 'hang-hoa')).toBe(true);
  });

  it('chưa đăng nhập: không vào được mục nào; Super Admin vào hết', () => {
    expect(canEnterArea(null, 'tong-quan')).toBe(false);
    expect(canEnterArea({ roles: ['Super Admin'], permissions: [] }, 'hang-hoa')).toBe(true);
  });
});
