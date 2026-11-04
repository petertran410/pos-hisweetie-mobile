import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/core/http', () => ({ http: {} }));
jest.mock('@/core/session', () => ({ useSession: () => null }));

// eslint-disable-next-line import/first
import { hasActiveCashSlip, listQuery, toDocDetail, toDocRow } from '../api';
// eslint-disable-next-line import/first
import { groupByDay } from '../group';
// eslint-disable-next-line import/first
import { dayBoundsIso, invoiceActions, kindFromSlug, orderActions, payState, statusOf } from '../model';

const NOW = new Date(2026, 10, 1, 9, 0); // 01/11/2026 09:00 giờ máy

describe('listQuery', () => {
  it('hóa đơn: lọc chi nhánh, trạng thái số, ngày bán; chỉ phân trang bằng page + limit', () => {
    const q = listQuery('invoice', { search: 'HD01', status: '3', period: 'today' }, 2, 1, NOW);
    expect(q).toMatchObject({
      page: 1,
      limit: 20,
      search: 'HD01',
      branchIds: [2],
      statusIds: [3],
      orderBy: 'purchaseDate',
      orderDirection: 'desc',
      includeStatusCounts: true,
    });
    expect(q.fromPurchaseDate).toBe(new Date(2026, 10, 1, 0, 0, 0, 0).toISOString());
    expect(q.toPurchaseDate).toBe(new Date(2026, 10, 1, 23, 59, 59, 999).toISOString());
    expect(q).not.toHaveProperty('pageSize');
    expect(q).not.toHaveProperty('currentItem');
  });

  it('đặt hàng: trạng thái dạng chữ, ngày đặt cần cả from + to, không gửi paymentStatus', () => {
    const q = listQuery('order', { search: '', status: 'pending', period: 'last7' }, 2, 3, NOW);
    expect(q).toMatchObject({ page: 3, branchId: 2, statuses: ['pending'], orderBy: 'orderDate' });
    expect(q.fromDate).toBeDefined();
    expect(q.toDate).toBeDefined();
    expect(q.search).toBeUndefined();
    expect(q).not.toHaveProperty('paymentStatus');
  });

  it('toàn thời gian, tất cả trạng thái: không gửi ngày hay trạng thái', () => {
    const q = listQuery('order', { search: '', status: 'all', period: 'all' }, 2, 1, NOW);
    expect(q.fromDate).toBeUndefined();
    expect(q.statuses).toBeUndefined();
  });
});

describe('model', () => {
  it('nhãn trạng thái theo web (6 = Đang giao hàng)', () => {
    expect(statusOf('invoice', 6).label).toBe('Đang giao hàng');
    expect(statusOf('order', 5).label).toBe('Đã xác nhận');
    expect(statusOf('order', 99).label).toBe('Không rõ');
  });

  it('thanh toán suy từ số tiền', () => {
    expect(payState(0, 100).label).toBe('Chưa thu');
    expect(payState(50, 50).label).toBe('Thu 1 phần');
    expect(payState(100, 0).label).toBe('Đã thu đủ');
  });

  it('slug đường dẫn', () => {
    expect(kindFromSlug('hoa-don')).toBe('invoice');
    expect(kindFromSlug('dat-hang')).toBe('order');
  });

  it('khoảng ngày theo giờ máy', () => {
    const b = dayBoundsIso('2026-11-01', '2026-11-01');
    expect(new Date(b.fromIso).getHours()).toBe(0);
    expect(new Date(b.toIso).getHours()).toBe(23);
  });
});

describe('toDocRow / groupByDay', () => {
  it('nhóm theo ngày, khách trống là khách vãng lai', () => {
    const rows = [
      toDocRow('order', {
        id: 1,
        code: 'DH1',
        orderDate: new Date(2026, 10, 1, 8).toISOString(),
        status: 1,
        grandTotal: '100',
        debtAmount: '100',
      }),
      toDocRow('order', { id: 2, code: 'DH2', orderDate: new Date(2026, 10, 1, 7).toISOString(), status: 1, grandTotal: '50' }),
      toDocRow('order', { id: 3, code: 'DH3', orderDate: new Date(2026, 9, 31, 7).toISOString(), status: 1, grandTotal: '50' }),
    ];
    expect(rows[0].customerName).toBe('Khách vãng lai');
    expect(rows[0].grandTotal).toBe(100);
    const items = groupByDay(rows, NOW);
    expect(items.map((i) => i.type)).toEqual(['day', 'row', 'row', 'day', 'row']);
    expect(items[0]).toMatchObject({ label: 'Hôm nay, 01/11' });
    expect(items[3]).toMatchObject({ label: 'Hôm qua, 31/10' });
  });
});

describe('toDocDetail', () => {
  it('đặt hàng: cộng số đã ra hóa đơn (bỏ hóa đơn đã hủy), không đọc giá vốn', () => {
    const d = toDocDetail('order', {
      id: 9,
      code: 'DH9',
      status: 6,
      grandTotal: '300',
      paidAmount: '100',
      debtAmount: '200',
      customer: { name: 'Quán A', phone: '0900000000' },
      items: [
        {
          id: 1,
          productId: 7,
          productName: 'Trà',
          quantity: '3',
          price: '100',
          totalPrice: '300',
          product: { unit: 'Gói', inventories: [{ cost: '55' }] } as never,
        },
      ],
      invoices: [
        { id: 20, code: 'HD20', status: 3, details: [{ productId: 7, quantity: '2' }] },
        { id: 21, code: 'HD21', status: 2, details: [{ productId: 7, quantity: '1' }] },
      ],
    });
    expect(d.lines[0]).toMatchObject({ name: 'Trà', unit: 'Gói', quantity: 3, invoicedQty: 2 });
    expect(JSON.stringify(d)).not.toContain('cost');
    expect(d.customer?.phone).toBe('0900000000');
    expect(d.invoices).toHaveLength(2);
  });
});

describe('orderActions (giống web)', () => {
  const all = { update: true, cancel: true };

  it('phiếu tạm: xử lý, đổi trạng thái, kết thúc, hủy đều được', () => {
    expect(orderActions({ status: 1, invoices: [] }, all)).toEqual({
      process: true,
      changeStatus: true,
      complete: true,
      cancel: true,
      cancelBlocked: false,
    });
  });

  it('đơn đã hoàn thành / đã hủy: không đổi trạng thái, không kết thúc', () => {
    expect(orderActions({ status: 3, invoices: [] }, all)).toMatchObject({ changeStatus: false, complete: false, cancel: true });
    expect(orderActions({ status: 4, invoices: [] }, all)).toMatchObject({ changeStatus: false, complete: false, cancel: false });
  });

  it('có hóa đơn đang giao: không đổi trạng thái; còn hóa đơn chưa hủy thì chặn hủy đơn', () => {
    const a = orderActions({ status: 6, invoices: [{ status: 6 }, { status: 2 }] }, all);
    expect(a.changeStatus).toBe(false);
    expect(a.cancelBlocked).toBe(true);
    expect(orderActions({ status: 5, invoices: [{ status: 2 }] }, all).cancelBlocked).toBe(false);
  });

  it('xử lý đơn hàng (giống web): cần quyền sửa đơn, đơn Phiếu tạm / Đã xác nhận / Ra 1 phần HĐ', () => {
    expect([1, 5, 6, 3, 4].map((status) => orderActions({ status, invoices: [] }, all).process)).toEqual([true, true, true, false, false]);
    expect(orderActions({ status: 5, invoices: [] }, { ...all, update: false }).process).toBe(false);
  });

  it('thiếu quyền thì ẩn thao tác', () => {
    expect(orderActions({ status: 1, invoices: [] }, { update: false, cancel: true })).toMatchObject({
      changeStatus: false,
      complete: false,
      cancel: false,
    });
    expect(orderActions({ status: 1, invoices: [] }, { update: true, cancel: false }).cancel).toBe(false);
  });
});

describe('invoiceActions (giống web)', () => {
  const all = { update: true, cancel: true };

  it('hóa đơn đang xử lý: đổi trạng thái, kết thúc, hủy', () => {
    expect(invoiceActions({ status: 3 }, all, false)).toEqual({ process: true, changeStatus: true, complete: true, cancel: true });
    expect(invoiceActions({ status: 7 }, all, false)).toEqual({ process: false, changeStatus: true, complete: true, cancel: true });
  });

  it('xử lý hóa đơn: không với hóa đơn đã hủy; giao thành công / hoàn thành cần thêm quyền', () => {
    expect([3, 5, 6, 4, 8, 7, 1, 2].map((status) => invoiceActions({ status }, all, false).process)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
    const finalized = { ...all, updateFinalized: true };
    expect([7, 1, 2].map((status) => invoiceActions({ status }, finalized, false).process)).toEqual([true, true, false]);
    expect(invoiceActions({ status: 3 }, all, true).process).toBe(false);
    expect(invoiceActions({ status: 3 }, { ...all, update: false }, false).process).toBe(false);
  });

  it('hoàn thành: chỉ còn hủy; đã hủy: không còn thao tác', () => {
    expect(invoiceActions({ status: 1 }, all, false)).toEqual({ process: false, changeStatus: false, complete: false, cancel: true });
    expect(invoiceActions({ status: 2 }, all, false)).toEqual({ process: false, changeStatus: false, complete: false, cancel: false });
  });

  it('có phiếu đóng hàng thu tiền mặt: khóa đổi trạng thái và hủy, vẫn kết thúc được', () => {
    expect(invoiceActions({ status: 6 }, all, true)).toEqual({ process: false, changeStatus: false, complete: true, cancel: false });
  });

  it('thiếu quyền thì ẩn thao tác', () => {
    expect(invoiceActions({ status: 3 }, { update: false, cancel: true }, false)).toEqual({
      process: false,
      changeStatus: false,
      complete: false,
      cancel: true,
    });
    expect(invoiceActions({ status: 3 }, { update: true, cancel: false }, false).cancel).toBe(false);
  });
});

describe('hasActiveCashSlip', () => {
  it('chỉ tính phiếu chưa hủy, thu tiền mặt', () => {
    expect(hasActiveCashSlip({ data: [{ paymentMethod: 'cash', cancelledAt: null }] })).toBe(true);
    expect(hasActiveCashSlip({ data: [{ paymentMethod: 'cash', cancelledAt: '2026-11-01T00:00:00Z' }] })).toBe(false);
    expect(hasActiveCashSlip({ data: [{ paymentMethod: 'transfer', cancelledAt: null }] })).toBe(false);
    expect(hasActiveCashSlip([{ paymentMethod: 'cash' }])).toBe(true);
    expect(hasActiveCashSlip(null)).toBe(false);
  });
});
