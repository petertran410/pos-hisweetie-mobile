import { describe, expect, it } from '@jest/globals';
import {
  activeFilterCount,
  addressLine,
  allocatePayment,
  availableCredit,
  customerFilterQuery,
  customerListQuery,
  customerPerms,
  DEFAULT_FILTERS,
  defaultOffsets,
  setInvoiceOffset,
  setInvoicePay,
  sumAmounts,
  toAllocItems,
  toCustomerDetail,
  toCustomerRow,
  toDebtEntry,
  toUnpaidInvoices,
} from '../model';

const NOW = new Date(2026, 10, 4, 9, 0);

describe('customerListQuery', () => {
  it('phân trang bằng pageSize + currentItem, tìm bằng name, mặc định khách đang hoạt động', () => {
    const q = customerListQuery('an', DEFAULT_FILTERS, 3, true, NOW);
    expect(q).toMatchObject({ pageSize: 20, currentItem: 40, name: 'an', isActive: true, orderBy: 'createdAt', orderDirection: 'desc' });
    expect(q).not.toHaveProperty('page');
    expect(q).not.toHaveProperty('limit');
    expect(q).not.toHaveProperty('includeInactive');
  });

  it('"Tất cả" gửi includeInactive (không chỉ bỏ isActive như web)', () => {
    const q = customerFilterQuery('', { ...DEFAULT_FILTERS, status: 'all' }, true, NOW);
    expect(q.includeInactive).toBe(true);
    expect(q.isActive).toBeUndefined();
    expect(customerFilterQuery('', { ...DEFAULT_FILTERS, status: 'inactive' }, true, NOW).isActive).toBe(false);
  });

  it('lọc nhóm, ngày tạo, giao dịch, tổng bán; công nợ chỉ khi có quyền xem nợ', () => {
    const f = {
      ...DEFAULT_FILTERS,
      groupIds: [3, 5],
      created: 'today' as const,
      lastTx: 'last7' as const,
      purchasedFrom: 1000,
      debtFrom: 1,
      debtTo: 5000,
    };
    const q = customerFilterQuery('', f, true, NOW);
    expect(q.groupIds).toEqual([3, 5]);
    expect(new Date(String(q.createdDateFrom)).getHours()).toBe(0);
    expect(new Date(String(q.createdDateTo)).getHours()).toBe(23);
    expect(q.lastTransactionFrom).toBeDefined();
    expect(q).toMatchObject({ totalPurchasedFrom: 1000, debtFrom: 1, debtTo: 5000 });
    const noDebt = customerFilterQuery('', f, false, NOW);
    expect(noDebt.debtFrom).toBeUndefined();
    expect(activeFilterCount(f, true)).toBe(5);
    expect(activeFilterCount(f, false)).toBe(4);
  });

  it('ngày tạo theo khoảng ngày tự chọn', () => {
    const f = { ...DEFAULT_FILTERS, created: { from: '2026-10-01', to: '2026-10-15' } };
    const q = customerFilterQuery('', f, true, NOW);
    expect(q.createdDateFrom).toBe(new Date(2026, 9, 1, 0, 0, 0, 0).toISOString());
    expect(q.createdDateTo).toBe(new Date(2026, 9, 15, 23, 59, 59, 999).toISOString());
    expect(activeFilterCount(f, true)).toBe(1);
  });

  it('không có quyền xem nợ thì không sắp xếp theo nợ', () => {
    expect(customerListQuery('', { ...DEFAULT_FILTERS, sort: 'debtMost' }, 1, false, NOW).orderBy).toBe('createdAt');
    expect(customerListQuery('', { ...DEFAULT_FILTERS, sort: 'debtMost' }, 1, true, NOW)).toMatchObject({
      orderBy: 'totalDebt',
      orderDirection: 'desc',
    });
  });
});

describe('mappers', () => {
  it('đổi số Decimal, lấy SĐT 1 rồi SĐT 2, địa chỉ mặc định', () => {
    const r = toCustomerRow({
      id: 1,
      code: 'KH01',
      name: ' Quán A ',
      phone: '0911',
      totalDebt: '1500.50',
      totalPurchased: '20000',
      addresses: [{ address: '1 Lê Lợi', newWardName: 'Phường Bến Thành', newCityName: 'TP Hồ Chí Minh', isDefault: true }],
    });
    expect(r).toMatchObject({ name: 'Quán A', phone: '0911', totalDebt: 1500.5, totalPurchased: 20000, isActive: true });
    expect(r.address).toBe('1 Lê Lợi, Phường Bến Thành, TP Hồ Chí Minh');
  });

  it('địa chỉ cũ 3 cấp khi chưa có địa chỉ mới', () => {
    expect(addressLine({ address: '5 Trần Phú', wardName: 'Phường 1', districtName: 'Quận 5', cityName: 'HCM' })).toBe(
      '5 Trần Phú, Phường 1, Quận 5, HCM',
    );
  });

  it('chi tiết: nợ khách con, nhóm, địa chỉ mặc định lên đầu, thông tin xuất hóa đơn', () => {
    const d = toCustomerDetail({
      id: 2,
      code: 'KH02',
      name: 'Công ty B',
      type: 1,
      organization: 'Công ty TNHH B',
      taxCode: '0101234567',
      totalDebt: '100',
      children: [
        { id: 3, code: 'KH02.1', name: 'Chi nhánh 1', totalDebt: '40' },
        { id: 4, code: 'KH02.2', name: 'Chi nhánh 2', totalDebt: '60', isActive: false },
      ],
      addresses: [{ id: 1, address: 'A' }, { id: 2, address: 'B', isDefault: true }],
      customerGroupDetails: [{ customerGroup: { id: 9, name: 'Sỉ' } }],
    });
    expect(d.childrenDebt).toBe(100);
    expect(d.children[1].isActive).toBe(false);
    expect(d.addresses[0].id).toBe(2);
    expect(d.groups).toEqual([{ id: 9, name: 'Sỉ' }]);
    expect(d.isCompany).toBe(true);
    expect(d.invoiceInfo.map((l) => l.label)).toEqual(['Tên công ty', 'Mã số thuế']);
  });
});

describe('công nợ', () => {
  it('bán hàng, phiếu chi làm tăng nợ; thu tiền, trả hàng làm giảm', () => {
    expect(toDebtEntry({ type: 'invoice', id: 1, code: 'HD1', amount: 100, debtSnapshot: '100' })).toMatchObject({
      delta: 100,
      balance: 100,
      label: 'Bán hàng',
    });
    expect(toDebtEntry({ type: 'payment', id: 2, code: 'TTHD1', amount: 40 })).toMatchObject({ delta: -40, label: 'Thanh toán hóa đơn' });
    expect(toDebtEntry({ type: 'payment', id: 3, code: 'TT0001', amount: 10 }).label).toBe('Thu tiền khách');
    expect(toDebtEntry({ type: 'return_order', id: 4, code: 'TH1', amount: 5 }).delta).toBe(-5);
    expect(toDebtEntry({ type: 'expense', id: 5, code: 'PC1', amount: 7 }).delta).toBe(7);
  });

  it('hóa đơn còn nợ: bỏ hóa đơn hủy, đã trả hàng đủ; cũ trước', () => {
    const list = toUnpaidInvoices([
      { id: 1, code: 'HD1', purchaseDate: '2026-11-02', status: 3, debtAmount: '100' },
      { id: 2, code: 'HD2', purchaseDate: '2026-11-01', status: 7, debtAmount: '50' },
      { id: 3, code: 'HD3', purchaseDate: '2026-10-01', status: 2, debtAmount: '80' },
      { id: 4, code: 'HD4', purchaseDate: '2026-10-02', status: 1, debtAmount: '0' },
      { id: 5, code: 'HD5', purchaseDate: '2026-10-03', status: 7, debtAmount: '30', returnOrderAmount: '30' },
    ]);
    expect(list.map((i) => i.code)).toEqual(['HD2', 'HD1']);
  });

  const inv = (id: number, debt: number) => ({ id, code: `HD${id}`, date: String(id), debt, total: debt, customerName: null });

  it('chia tiền thu vào hóa đơn cũ trước, phần dư không gán', () => {
    const list = [inv(1, 50), inv(2, 100)];
    expect(allocatePayment(120, list)).toEqual({ 1: 50, 2: 70 });
    expect(sumAmounts(allocatePayment(500, list))).toBe(150);
    expect(allocatePayment(0, list)).toEqual({});
  });

  it('chia tiền thu trừ phần đã cấn trừ', () => {
    const list = [inv(1, 50), inv(2, 100)];
    expect(allocatePayment(120, list, { 1: 30 })).toEqual({ 1: 20, 2: 100 });
    expect(allocatePayment(120, list, { 1: 50 })).toEqual({ 2: 100 });
  });

  it('cấn trừ: phần nợ hóa đơn vượt nợ thực, mặc định dồn vào hóa đơn cũ nhất', () => {
    const list = [inv(1, 50), inv(2, 100)];
    expect(availableCredit(list, 150)).toBe(0);
    expect(availableCredit(list, 200)).toBe(0);
    expect(availableCredit(list, 80)).toBe(70);
    expect(defaultOffsets(list, 30)).toEqual({ 1: 30 });
    expect(defaultOffsets(list, 70)).toEqual({ 1: 50 });
    expect(defaultOffsets(list, 0)).toEqual({});
    expect(defaultOffsets([], 70)).toEqual({});
  });

  it('sửa tiền thu / cấn trừ từng hóa đơn không vượt giới hạn', () => {
    const list = [inv(1, 50), inv(2, 100)];
    expect(setInvoicePay(list, {}, { 1: 30 }, 1, 999)).toEqual({ 1: 20 });
    expect(setInvoicePay(list, { 1: 20 }, {}, 2, -5)).toEqual({ 1: 20, 2: 0 });
    expect(setInvoicePay(list, {}, {}, 9, 10)).toEqual({});
    // Cấn trừ tối đa 70: hóa đơn 1 đã dùng 50 → hóa đơn 2 còn 20.
    expect(setInvoiceOffset(list, { 1: 50 }, 70, 2, 60)).toEqual({ 1: 50, 2: 20 });
    expect(setInvoiceOffset(list, { 1: 50 }, 70, 1, 80)).toEqual({ 1: 50 });
  });

  it('gửi API theo thứ tự hóa đơn, bỏ dòng 0 và hóa đơn đã mất', () => {
    const list = [inv(1, 50), inv(2, 100)];
    expect(toAllocItems({ 2: 40, 1: 0, 7: 10 }, list)).toEqual([{ invoiceId: 2, amount: 40 }]);
  });
});

describe('customerPerms', () => {
  it('sửa ghi chú: quyền sửa khách hoặc quyền riêng', () => {
    expect(customerPerms({ permissions: ['customers:update_comments'] }).editNote).toBe(true);
    expect(customerPerms({ permissions: ['customers:view'] })).toMatchObject({ view: true, editNote: false, viewDebt: false });
  });
});
