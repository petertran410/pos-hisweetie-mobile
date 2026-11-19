import { describe, expect, it } from '@jest/globals';
import {
  agingRows,
  cashBars,
  channelParts,
  HEAT_OPTIONS,
  heatColor,
  heatGrid,
  paymentRows,
  returnRows,
  sellerRows,
  areaPath,
  axisMoney,
  branchBars,
  branchOptions,
  buyerRows,
  categoryParts,
  CHART,
  compactMoney,
  dashboardPerms,
  dashRangeDates,
  deltaTone,
  formatDelta,
  greetingFor,
  isValidTaskType,
  marginText,
  nearestIndex,
  niceScale,
  overdueNote,
  parseBranchParam,
  periodDates,
  pointLabel,
  productRows,
  shortName,
  smoothPath,
  sparseLabels,
  taskStatusLabel,
  topMetricOptions,
  trendCaption,
} from '../model';

describe('dashboardPerms', () => {
  const NONE = { view: false, profit: false, supplierDebt: false, cashflow: false, sellers: false, heatmap: false, returns: false };

  it('không có dashboard:view → ẩn hết số liệu (không gọi API), kể cả khi có quyền báo cáo khác', () => {
    expect(dashboardPerms({ roles: ['Sale'], permissions: ['invoices:create', 'cash_flows:view', 'reports:sale_time'] })).toEqual(NONE);
    expect(dashboardPerms(null)).toEqual(NONE);
  });

  it('nhân viên có dashboard:view: thấy số liệu chung, không thấy lợi nhuận và các báo cáo chưa được cấp', () => {
    expect(dashboardPerms({ roles: ['Sale'], permissions: ['dashboard:view'] })).toEqual({ ...NONE, view: true });
    expect(dashboardPerms({ roles: ['Kế toán'], permissions: ['dashboard:view', 'suppliers:view'] }).supplierDebt).toBe(true);
  });

  it('mỗi báo cáo thêm cần quyền của báo cáo tương ứng', () => {
    const p = dashboardPerms({
      roles: ['Quản lý'],
      permissions: ['dashboard:view', 'cash_flows:view', 'reports:sale_soldby', 'reports:sale_time', 'reports:sale_refund'],
    });
    expect(p).toEqual({ ...NONE, view: true, cashflow: true, sellers: true, heatmap: true, returns: true });
    expect(dashboardPerms({ roles: [], permissions: ['dashboard:view', 'reports:sale_time'] }).heatmap).toBe(true);
    expect(dashboardPerms({ roles: [], permissions: ['dashboard:view', 'reports:sale_time'] }).cashflow).toBe(false);
  });

  it('Admin có dashboard:view thấy lợi nhuận; Super Admin thấy tất cả', () => {
    expect(dashboardPerms({ roles: ['Admin'], permissions: ['dashboard:view'] }).profit).toBe(true);
    // Admin chưa được cấp dashboard:view thì backend chặn → không hiện gì.
    expect(dashboardPerms({ roles: ['Admin'], permissions: [] })).toEqual(NONE);
    expect(Object.values(dashboardPerms({ roles: ['Super Admin'], permissions: [] })).every(Boolean)).toBe(true);
  });

  it('tiêu chí "Lợi nhuận" chỉ có cho Admin', () => {
    expect(topMetricOptions(false).map((o) => o.value)).toEqual(['rev', 'qty']);
    expect(topMetricOptions(true).map((o) => o.value)).toEqual(['rev', 'qty', 'profit']);
  });
});

describe('bộ lọc', () => {
  const NOW = new Date(2026, 10, 5, 9, 0); // Thứ Năm 05/11/2026

  it('chi nhánh: "Tất cả" đứng đầu, sau đó các chi nhánh của tài khoản', () => {
    expect(branchOptions([{ id: 1, name: 'A' }])).toEqual([
      { value: 'all', label: 'Tất cả chi nhánh' },
      { value: 1, label: 'A' },
    ]);
    expect(parseBranchParam('all')).toBe('all');
    expect(parseBranchParam('6')).toBe(6);
    expect(parseBranchParam('x')).toBeNull();
    expect(parseBranchParam(undefined)).toBeNull();
  });

  it('khoảng ngày của kỳ để lịch mở đúng chỗ', () => {
    expect(dashRangeDates('today', NOW)).toEqual({ from: '2026-11-05', to: '2026-11-05' });
    expect(dashRangeDates('week', NOW)).toEqual({ from: '2026-10-30', to: '2026-11-05' });
    expect(dashRangeDates('lastMonth', NOW)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodDates('d30', NOW)).toEqual({ from: '2026-10-07', to: '2026-11-05' });
    expect(periodDates('thisWeek', NOW)).toEqual({ from: '2026-11-02', to: '2026-11-05' });
    expect(periodDates('all', NOW)).toBeNull();
    expect(periodDates({ from: '2026-10-01', to: '2026-10-15' }, NOW)).toEqual({ from: '2026-10-01', to: '2026-10-15' });
  });

  it('biểu đồ theo giờ / ngày / tháng giống backend', () => {
    expect(trendCaption('today')).toBe('Theo giờ');
    expect(trendCaption('month')).toBe('Theo ngày');
    expect(trendCaption({ from: '2026-10-05', to: '2026-10-05' })).toBe('Theo giờ');
    expect(trendCaption({ from: '2026-08-01', to: '2026-10-31' })).toBe('Theo ngày');
    expect(trendCaption({ from: '2026-01-01', to: '2026-10-31' })).toBe('Theo tháng');
  });
});

describe('định dạng số', () => {
  it('tiền rút gọn kiểu web', () => {
    expect(compactMoney(1_250_000_000)).toBe('1.25 tỷ');
    expect(compactMoney(22_200_000)).toBe('22.2 tr');
    expect(compactMoney(925_000)).toBe('925k');
    expect(compactMoney(800)).toBe('800');
    expect(compactMoney(-5_120_000)).toBe('-5.1 tr');
    expect(axisMoney(2_000_000)).toBe('2tr');
    expect(axisMoney(1_500_000_000)).toBe('1.5 tỷ');
    expect(axisMoney(0)).toBe('0');
  });

  it('biên lợi nhuận: backend trả tỷ lệ 0–1', () => {
    expect(marginText(0.2306)).toBe('23%');
    expect(marginText(undefined)).toBe('0%');
  });

  it('mức thay đổi so với kỳ trước', () => {
    expect(formatDelta(12.345)).toBe('+12.3%');
    expect(formatDelta(-3)).toBe('-3%');
    expect(formatDelta(0)).toBe('0%');
    expect(formatDelta(null)).toBeNull();
    expect(formatDelta(Number.POSITIVE_INFINITY)).toBeNull();
    expect(deltaTone(5)).toBe('success');
    expect(deltaTone(-1)).toBe('danger');
    expect(deltaTone(0)).toBe('neutral');
  });

  it('nhãn mốc giờ và nhãn trục thưa', () => {
    expect(pointLabel('08')).toBe('8h');
    expect(pointLabel('T2')).toBe('T2');
    expect(pointLabel('05/11')).toBe('05/11');
    const labels = sparseLabels(Array.from({ length: 24 }, (_, i) => String(i)), 6);
    expect(labels.filter(Boolean).length).toBeLessThanOrEqual(6);
    expect(labels[0]).toBe('0');
  });
});

describe('biểu đồ', () => {
  it('trục tung tròn số, có số âm thì kéo xuống dưới 0', () => {
    expect(niceScale([0, 3_600_000])).toEqual({ min: 0, max: 4_000_000, ticks: [0, 1_000_000, 2_000_000, 3_000_000, 4_000_000] });
    const neg = niceScale([2_000_000, -500_000]);
    expect(neg.min).toBeLessThan(0);
    expect(neg.ticks).toContain(0);
    expect(niceScale([0, 0])).toEqual({ min: 0, max: 1, ticks: [0, 1] });
  });

  it('đường cong đi qua đúng các điểm, không vọt quá khi gặp đỉnh', () => {
    const pts = [
      { x: 0, y: 100 },
      { x: 10, y: 0 },
      { x: 20, y: 100 },
    ];
    const d = smoothPath(pts);
    expect(d.startsWith('M0,100')).toBe(true);
    expect(d).toContain(' 10,0');
    expect(d.endsWith(' 20,100')).toBe(true);
    // Đỉnh (y nhỏ nhất) phẳng: điểm điều khiển quanh đỉnh không vượt lên trên đỉnh.
    const ys = [...d.matchAll(/-?\d+(?:\.\d+)?,(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBe(0);
    expect(areaPath(pts, 120).endsWith('L20,120 L0,120 Z')).toBe(true);
    expect(smoothPath([])).toBe('');
  });

  it('chạm vào biểu đồ chọn mốc gần nhất', () => {
    expect(nearestIndex([10, 50, 90], 62)).toBe(1);
    expect(nearestIndex([10, 50, 90], 200)).toBe(2);
  });
});

describe('đổi dữ liệu cho từng khối', () => {
  it('so sánh chi nhánh: lớn trước, tên gọn, tỷ lệ theo chi nhánh lớn nhất', () => {
    const rows = branchBars({
      labels: [],
      branches: [
        { id: 1, name: 'Kho Sài Gòn — 12 Đường Mẫu', data: [], total: 50_000_000 },
        { id: 5, name: 'Văn phòng Hà Nội', data: [], total: 100_000_000 },
      ],
    });
    expect(rows.map((r) => r.key)).toEqual([5, 1]);
    expect(rows[1].title).toBe('Kho Sài Gòn');
    expect(rows.map((r) => r.share)).toEqual([1, 0.5]);
    expect(rows[0].value).toBe('100 tr');
    expect(branchBars(undefined)).toEqual([]);
  });

  it('nhóm hàng: tối đa 6 nhóm, phần còn lại và "Khác" gộp làm một, màu theo thứ tự cố định', () => {
    const slices = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((name, i) => ({ name, revenue: (10 - i) * 100, percent: 0 }));
    const parts = categoryParts([...slices, { name: 'Khác', revenue: 50, percent: 0 }, { name: 'Z', revenue: 0, percent: 0 }]);
    expect(parts.map((p) => p.name)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'Khác']);
    expect(parts[6].revenue).toBe(450);
    expect(parts[6].color).toBe(CHART.other);
    expect(parts.slice(0, 6).map((p) => p.color)).toEqual([...CHART.categories]);
    expect(parts.reduce((s, p) => s + p.percent, 0)).toBeCloseTo(100, 0);
  });

  it('bán chạy: giá trị theo tiêu chí đang chọn', () => {
    const items = [
      { productId: 1, code: 'SP1', name: 'Trà', totalQuantity: 10, totalRevenue: 2_000_000, totalProfit: 300_000 },
      { productId: 2, code: 'SP2', name: 'Siro', totalQuantity: 40, totalRevenue: 1_000_000, totalProfit: 600_000 },
    ];
    expect(productRows(items, 'rev').map((r) => [r.value, r.share])).toEqual([
      ['2 tr', 1],
      ['1 tr', 0.5],
    ]);
    expect(productRows(items, 'qty').map((r) => r.value)).toEqual(['10', '40']);
    expect(productRows(items, 'qty')[1].share).toBe(1);
    expect(productRows(items, 'profit')[1].value).toBe('600k');
    expect(productRows(items, 'rev')[0].sub).toBe('SP1, đã bán 10');
  });

  it('khách mua nhiều', () => {
    expect(buyerRows([{ id: 3, code: 'KH3', name: 'Quán A', totalRevenue: 6_400_000, invoiceCount: 5 }])).toEqual([
      { key: 3, title: 'Quán A', sub: 'KH3, 5 hóa đơn', value: '6.4 tr', share: 1 },
    ]);
  });

  it('phân tuổi nợ và ghi chú quá hạn', () => {
    const f = { debt: 100, overdue: 40, unpaidCount: 2, codAmount: 0, codCount: 0, aging: { inTerm: 60, d1to30: 30, over30: 10 } };
    expect(agingRows(f).map((r) => [r.key, r.share, r.tone])).toEqual([
      ['inTerm', 0.6, 'success'],
      ['d1to30', 0.3, 'warning'],
      ['over30', 0.1, 'danger'],
    ]);
    expect(overdueNote({ ...f, overdue: 4_000_000, aging: { inTerm: 6_000_000, d1to30: 3_000_000, over30: 1_000_000 } })).toBe('Quá hạn 4 tr, 40%');
    expect(agingRows(undefined).every((r) => r.share === 0)).toBe(true);
  });
});

describe('việc cần xử lý và đầu trang', () => {
  it('nhãn trạng thái tiếng Việt (COD theo trạng thái hóa đơn)', () => {
    expect(taskStatusLabel('orders', 'partially_invoiced')).toBe('Đã ra 1 phần hóa đơn');
    expect(taskStatusLabel('debt', 'overdue')).toBe('Quá hạn trên 30 ngày');
    expect(taskStatusLabel('stock', 'out')).toBe('Hết hàng');
    expect(taskStatusLabel('cod', '6')).toBe('Đang giao hàng');
    expect(taskStatusLabel('cod', '99')).toBe('');
    expect(isValidTaskType('debt')).toBe(true);
    expect(isValidTaskType('hack')).toBe(false);
  });

  it('lời chào và tên gọi', () => {
    expect(greetingFor(new Date(2026, 9, 31, 8))).toBe('Chào buổi sáng!');
    expect(greetingFor(new Date(2026, 9, 31, 12))).toBe('Chào buổi trưa!');
    expect(greetingFor(new Date(2026, 9, 31, 16))).toBe('Chào buổi chiều!');
    expect(greetingFor(new Date(2026, 9, 31, 21))).toBe('Chào buổi tối!');
    expect(shortName('Nguyễn Thị Lan')).toBe('Lan');
    expect(shortName('')).toBe('');
  });
});

describe('báo cáo thêm', () => {
  it('nhân viên bán: hóa đơn chưa gán nhân viên vẫn có khoá riêng', () => {
    const rows = sellerRows([
      { id: 11, name: 'An', revenue: 2_000_000, invoiceCount: 3 },
      { id: null, name: 'Chưa gán nhân viên', revenue: 500_000, invoiceCount: 1 },
    ]);
    expect(rows.map((r) => [r.key, r.value, r.sub, r.share])).toEqual([
      [11, '2 tr', '3 hóa đơn', 1],
      ['none-1', '500k', '1 hóa đơn', 0.25],
    ]);
  });

  it('kênh bán: tỷ trọng và màu theo thứ tự cố định', () => {
    const parts = channelParts([
      { id: null, name: 'Bán trực tiếp', revenue: 300, invoiceCount: 3, percent: 75 },
      { id: 1, name: 'Zalo', revenue: 100, invoiceCount: 1, percent: 25 },
    ]);
    expect(parts.map((p) => [p.name, p.percent, p.color])).toEqual([
      ['Bán trực tiếp', 75, CHART.categories[0]],
      ['Zalo', 25, CHART.categories[1]],
    ]);
    expect(channelParts(undefined)).toEqual([]);
  });

  it('thu chi: cột theo mốc (giờ "08" → "8h") và nhóm chi lớn nhất', () => {
    const data = {
      receipt: 300,
      payment: 100,
      net: 200,
      count: 3,
      series: [
        { label: '08', receipt: 200, payment: 0 },
        { label: '09', receipt: 100, payment: 100 },
      ],
      topPayments: [
        { name: 'Xăng', amount: 80_000 },
        { name: 'Khác', amount: 20_000 },
      ],
    };
    expect(cashBars(data)).toEqual([
      { label: '8h', receipt: 200, payment: 0 },
      { label: '9h', receipt: 100, payment: 100 },
    ]);
    expect(paymentRows(data).map((r) => [r.title, r.value, r.share])).toEqual([
      ['Xăng', '80k', 1],
      ['Khác', '20k', 0.25],
    ]);
    expect(cashBars(undefined)).toEqual([]);
  });

  it('khung giờ: thứ Hai → Chủ nhật, chỉ giữ giờ có bán, tìm ô đông nhất', () => {
    const grid = heatGrid([
      { dow: 0, hour: 9, revenue: 500, count: 2 },
      { dow: 1, hour: 15, revenue: 900, count: 3 },
      { dow: 3, hour: 11, revenue: 0, count: 0 },
    ]);
    expect(grid.hours).toEqual([9, 10, 11, 12, 13, 14, 15]);
    expect(grid.rows.map((r) => r.label)).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);
    expect(grid.rows[0].cells[6]).toEqual({ revenue: 900, count: 3 });
    expect(grid.rows[6].cells[0]).toEqual({ revenue: 500, count: 2 });
    expect(grid.max).toBe(900);
    expect(grid.peak).toEqual({ label: 'T2', hour: 15, revenue: 900, count: 3 });
    const empty = heatGrid(undefined);
    expect(empty.hours[0]).toBe(8);
    expect(empty.peak).toBeNull();
  });

  it('màu ô khung giờ: 0 xám, cao nhất đậm nhất', () => {
    expect(heatColor(0, 100)).toBe(CHART.heatEmpty);
    expect(heatColor(1, 100)).toBe(CHART.heat[0]);
    expect(heatColor(100, 100)).toBe(CHART.heat[CHART.heat.length - 1]);
    expect(HEAT_OPTIONS.map((o) => o.value)).not.toContain('today');
  });

  it('trả hàng', () => {
    const data = {
      count: 4,
      amount: 720_000,
      revenue: 22_200_000,
      rate: 3.2,
      pendingCount: 2,
      topProducts: [{ productId: 2, code: 'SP2', name: 'Siro', quantity: 3, amount: 288_000 }],
    };
    expect(returnRows(data)).toEqual([{ key: 2, title: 'Siro', sub: 'SP2, trả 3', value: '288k', share: 1 }]);
    expect(returnRows(undefined)).toEqual([]);
  });
});
