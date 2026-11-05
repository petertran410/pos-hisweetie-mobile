import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/core/http', () => ({ http: {} }));

// eslint-disable-next-line import/first
import {
  branchCompareQuery,
  branchParam,
  categoryQuery,
  cashflowQuery,
  financeQuery,
  heatmapQuery,
  periodParams,
  rangeParams,
  returnsQuery,
  safeMetric,
  sellersQuery,
  statsQuery,
  tasksQuery,
  topBuyersQuery,
  topProductsQuery,
} from '../api';

const OCT = { from: '2026-10-01', to: '2026-10-15' };
const OCT_ISO = {
  from: new Date(2026, 9, 1, 0, 0, 0, 0).toISOString(),
  to: new Date(2026, 9, 15, 23, 59, 59, 999).toISOString(),
};

describe('rangeParams / periodParams', () => {
  it('kỳ có sẵn gửi range; khoảng tự chọn gửi range=custom kèm from/to (đầu ngày → cuối ngày)', () => {
    expect(rangeParams('week')).toEqual({ range: 'week' });
    expect(rangeParams('lastMonth')).toEqual({ range: 'lastMonth' });
    expect(rangeParams(OCT)).toEqual({ range: 'custom', ...OCT_ISO });
  });

  it('So sánh chi nhánh / Công nợ gửi period (kể cả "all" và custom)', () => {
    expect(periodParams('d30')).toEqual({ period: 'd30' });
    expect(periodParams('all')).toEqual({ period: 'all' });
    expect(periodParams(OCT)).toEqual({ period: 'custom', ...OCT_ISO });
  });
});

describe('tham số từng API (đúng tên query của backend)', () => {
  it('"Tất cả chi nhánh" không gửi branchId', () => {
    expect(branchParam('all')).toBeUndefined();
    expect(branchParam(5)).toBe(5);
    expect(statsQuery('today', 'all')).toEqual({ range: 'today', branchId: undefined });
    expect(statsQuery(OCT, 6)).toEqual({ range: 'custom', ...OCT_ISO, branchId: 6 });
  });

  it('nhóm hàng gửi dimension', () => {
    expect(categoryQuery('month', 1, 'middle')).toEqual({ range: 'month', branchId: 1, dimension: 'middle' });
  });

  it('bán chạy: top 10, người không phải Admin không bao giờ gửi metric=profit', () => {
    expect(topProductsQuery('month', 1, 'qty', false)).toEqual({ range: 'month', branchId: 1, metric: 'qty', limit: 10 });
    expect(topProductsQuery('month', 1, 'profit', false)).toMatchObject({ metric: 'rev' });
    expect(topProductsQuery('month', 1, 'profit', true)).toMatchObject({ metric: 'profit' });
    expect(safeMetric('profit', false)).toBe('rev');
  });

  it('khách mua nhiều: top 10 theo kỳ và chi nhánh', () => {
    expect(topBuyersQuery('yesterday', 'all')).toEqual({ range: 'yesterday', branchId: undefined, limit: 10 });
  });

  it('so sánh chi nhánh không gửi branchId; lợi nhuận chỉ Admin', () => {
    expect(branchCompareQuery('d7', 'rev', true)).toEqual({ period: 'd7', metric: 'rev' });
    expect(branchCompareQuery('d7', 'profit', false)).toEqual({ period: 'd7', metric: 'rev' });
    expect(branchCompareQuery(OCT, 'profit', true)).toEqual({ period: 'custom', ...OCT_ISO, metric: 'profit' });
  });

  it('công nợ: period + branchId', () => {
    expect(financeQuery('all', 1)).toEqual({ period: 'all', branchId: 1 });
    expect(financeQuery('thisMonth', 'all')).toEqual({ period: 'thisMonth', branchId: undefined });
  });

  it('việc cần xử lý: type, chi nhánh, giới hạn, trạng thái', () => {
    expect(tasksQuery('debt', 'all', 'overdue')).toEqual({ type: 'debt', branchId: undefined, limit: 200, status: 'overdue' });
  });

  it('báo cáo thêm: thu chi, trả hàng theo kỳ + chi nhánh; nhân viên top 10; khung giờ theo period', () => {
    expect(cashflowQuery('today', 1)).toEqual({ range: 'today', branchId: 1 });
    expect(returnsQuery(OCT, 'all')).toEqual({ range: 'custom', ...OCT_ISO, branchId: undefined });
    expect(sellersQuery('month', 6)).toEqual({ range: 'month', branchId: 6, limit: 10 });
    expect(heatmapQuery('d30', 'all')).toEqual({ period: 'd30', branchId: undefined });
    expect(heatmapQuery(OCT, 5)).toEqual({ period: 'custom', ...OCT_ISO, branchId: 5 });
  });
});
