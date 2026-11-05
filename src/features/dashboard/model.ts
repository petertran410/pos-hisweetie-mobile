import { canDo, isAdminRole, type PermissionHolder } from '@/core/can';
import { isoDate, money, periodRange, qty } from '@/core/format';
import { isRange, type DateRange } from '@/core/period';
import type { AccentName, IconName, SelectOption, Tone } from '@/ui';
import type {
  BranchComparison,
  BranchMetric,
  CashflowSummary,
  CategoryDimension,
  CategorySlice,
  ChannelRow,
  DashBranch,
  DashPeriod,
  DashPreset,
  DashRange,
  FinanceData,
  FinancePeriod,
  HeatCell,
  ReturnsSummary,
  SellerRow,
  TaskType,
  TopBuyer,
  TopMetric,
  TopProduct,
} from './api';

// ---------- Quyền ----------

/**
 * Quyền trên Tổng quan (giống web): mọi khối số liệu cần `dashboard:view`
 * (backend chặn 403 nếu thiếu); lợi nhuận, biên lợi nhuận chỉ Admin, Super
 * Admin thấy; nợ nhà cung cấp cần quyền xem nhà cung cấp. Các báo cáo thêm
 * cần thêm quyền của báo cáo tương ứng trên web (backend cũng kiểm như vậy).
 */
export function dashboardPerms(user: PermissionHolder | null | undefined) {
  const view = canDo(user, 'dashboard:view');
  const and = (permission: string) => view && canDo(user, permission);
  return {
    view,
    profit: view && isAdminRole(user),
    supplierDebt: and('suppliers:view'),
    /** Thu chi sổ quỹ: quyền xem Sổ quỹ. */
    cashflow: and('cash_flows:view'),
    /** Doanh thu theo nhân viên: Báo cáo bán hàng › Nhân viên. */
    sellers: and('reports:sale_soldby'),
    /** Khung giờ bán: Báo cáo bán hàng › Thời gian. */
    heatmap: and('reports:sale_time'),
    /** Trả hàng: Báo cáo bán hàng › Trả hàng. */
    returns: and('reports:sale_refund'),
  };
}

export type DashboardPerms = ReturnType<typeof dashboardPerms>;

// ---------- Bộ lọc ----------

export const RANGE_OPTIONS: { value: DashPreset; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'yesterday', label: 'Hôm qua' },
  { value: 'week', label: '7 ngày' },
  { value: 'month', label: 'Tháng này' },
  { value: 'lastMonth', label: 'Tháng trước' },
];

/** Kỳ của So sánh chi nhánh (giống `BRANCH_PERIODS` của web). */
export const PERIOD_OPTIONS: { value: DashPeriod; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'yesterday', label: 'Hôm qua' },
  { value: 'd7', label: '7 ngày' },
  { value: 'd30', label: '30 ngày' },
  { value: 'thisWeek', label: 'Tuần này' },
  { value: 'thisMonth', label: 'Tháng này' },
  { value: 'lastMonth', label: 'Tháng trước' },
];

/** Kỳ của Công nợ, COD: thêm "Tất cả" (giống `FINANCE_PERIODS` của web). */
export const FINANCE_OPTIONS: { value: DashPeriod | 'all'; label: string }[] = [...PERIOD_OPTIONS, { value: 'all', label: 'Tất cả' }];

export const CATEGORY_OPTIONS: SelectOption<CategoryDimension>[] = [
  { value: 'parent', label: 'Loại hàng' },
  { value: 'middle', label: 'Nguồn gốc' },
  { value: 'child', label: 'Danh mục' },
];

export function topMetricOptions(canProfit: boolean): SelectOption<TopMetric>[] {
  const all: SelectOption<TopMetric>[] = [
    { value: 'rev', label: 'Doanh thu' },
    { value: 'qty', label: 'Số lượng' },
    { value: 'profit', label: 'Lợi nhuận' },
  ];
  return canProfit ? all : all.filter((o) => o.value !== 'profit');
}

export const BRANCH_METRIC_OPTIONS: SelectOption<BranchMetric>[] = [
  { value: 'rev', label: 'Doanh thu' },
  { value: 'profit', label: 'Lợi nhuận' },
];

/** "Tất cả chi nhánh" + các chi nhánh của tài khoản (lấy từ phiên đăng nhập). */
export function branchOptions(branches: { id: number; name: string }[]): SelectOption<DashBranch>[] {
  return [{ value: 'all', label: 'Tất cả chi nhánh' }, ...branches.map((b) => ({ value: b.id, label: b.name }))];
}

/** Kỳ của Khung giờ bán (kỳ ngắn như hôm nay không đủ dữ liệu để so khung giờ). */
export const HEAT_OPTIONS: { value: DashPeriod; label: string }[] = PERIOD_OPTIONS.filter(
  (o) => o.value !== 'today' && o.value !== 'yesterday',
);

/** Bộ lọc của từng khối (mặc định giống web). */
export interface DashFilters {
  range: DashRange;
  catDim: CategoryDimension;
  topMetric: TopMetric;
  topRange: DashRange;
  buyerRange: DashRange;
  branchMetric: BranchMetric;
  branchPeriod: DashPeriod | DateRange;
  finPeriod: FinancePeriod;
  heatPeriod: DashPeriod | DateRange;
}

export const DEFAULT_DASH_FILTERS: DashFilters = {
  range: 'today',
  catDim: 'parent',
  topMetric: 'rev',
  topRange: 'month',
  buyerRange: 'month',
  branchMetric: 'rev',
  branchPeriod: 'd7',
  finPeriod: 'all',
  heatPeriod: 'd30',
};

const PRESET_PERIOD = { today: 'today', yesterday: 'yesterday', week: 'last7', month: 'thisMonth', lastMonth: 'lastMonth' } as const;

/** Khoảng ngày của kỳ đang xem (để lịch chọn ngày mở sẵn đúng chỗ). */
export function dashRangeDates(range: DashRange, now = new Date()): DateRange {
  return isRange(range) ? range : periodRange(PRESET_PERIOD[range], now);
}

/** Như trên cho kỳ của So sánh chi nhánh / Công nợ; "Tất cả" → null. */
export function periodDates(period: FinancePeriod, now = new Date()): DateRange | null {
  if (isRange(period)) return period;
  const day = (d: Date) => isoDate(d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case 'all':
      return null;
    case 'd7':
      return periodRange('last7', now);
    case 'd30':
      return { from: day(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)), to: day(today) };
    case 'thisWeek':
      return { from: day(new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7))), to: day(today) };
    default:
      return periodRange(period, now);
  }
}

// ---------- Định dạng số ----------

/** Làm tròn `digits` chữ số thập phân, dấu phẩy thập phân ("22,2"). */
const dec = (n: number, digits: number) => qty(Math.round(n * 10 ** digits) / 10 ** digits);

/** Tiền rút gọn kiểu web: "1,25 tỷ", "22,2 tr", "925k", "800". */
export function compactMoney(vnd: number): string {
  const n = Number(vnd) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${dec(n / 1e9, 2)} tỷ`;
  if (abs >= 1e6) return `${dec(n / 1e6, 1)} tr`;
  if (abs >= 1e3) return `${money(n / 1e3)}k`;
  return money(n);
}

/** Nhãn trục tiền: "2 tỷ", "1,5 tỷ", "200tr", "50k". */
export function axisMoney(vnd: number): string {
  const abs = Math.abs(vnd);
  if (abs >= 1e9) return `${dec(vnd / 1e9, abs >= 1e10 ? 0 : 1)} tỷ`;
  if (abs >= 1e6) return `${dec(vnd / 1e6, abs >= 1e7 ? 0 : 1)}tr`;
  if (abs >= 1e3) return `${money(vnd / 1e3)}k`;
  return money(vnd);
}

/** Biên lợi nhuận: backend trả tỷ lệ 0–1 → "23%" (giống web). */
export function marginText(marginAvg: number | null | undefined): string {
  return `${Math.round((Number(marginAvg) || 0) * 100)}%`;
}

/** "+12,5%" / "-3%" / "0%"; null khi không có kỳ trước để so. */
export function formatDelta(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  const rounded = Math.round(pct * 10) / 10;
  const text = String(Math.abs(rounded)).replace('.', ',');
  if (rounded > 0) return `+${text}%`;
  if (rounded < 0) return `-${text}%`;
  return '0%';
}

/** Màu nhãn thay đổi: tăng xanh, giảm đỏ, không đổi xám. */
export function deltaTone(pct: number | null | undefined): Tone {
  if (!pct || !Number.isFinite(pct)) return 'neutral';
  return pct > 0 ? 'success' : 'danger';
}

const dayNo = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000;

/**
 * Biểu đồ theo giờ / ngày / tháng (giống backend `getRevenueTrend`): hôm nay,
 * hôm qua theo giờ; kỳ khác theo ngày; khoảng tự chọn 1 ngày theo giờ, tới
 * 92 ngày theo ngày, dài hơn theo tháng.
 */
export function trendCaption(range: DashRange): string {
  if (!isRange(range)) return range === 'today' || range === 'yesterday' ? 'Theo giờ' : 'Theo ngày';
  const days = dayNo(range.to) - dayNo(range.from) + 1;
  return days <= 1 ? 'Theo giờ' : days <= 92 ? 'Theo ngày' : 'Theo tháng';
}

/** Nhãn mốc thời gian của backend: giờ "08" → "8h"; thứ, ngày, tháng giữ nguyên. */
export function pointLabel(label: string): string {
  return /^\d{2}$/.test(label) ? `${Number(label)}h` : label;
}

/** Chỉ hiện nhãn trục cách quãng để không chồng chữ. */
export function sparseLabels(labels: string[], max = 7): string[] {
  if (labels.length <= max) return labels;
  const step = Math.ceil(labels.length / max);
  return labels.map((l, i) => (i % step === 0 ? l : ''));
}

// ---------- Biểu đồ ----------

/** Màu biểu đồ (đã kiểm độ tương phản và người mù màu phân biệt được). */
export const CHART = {
  revenue: '#0891A3',
  profit: '#D97706',
  grid: '#E6ECF1',
  /** Nhóm hàng: thứ tự cố định, nhóm thứ 7 trở đi gộp vào "Khác". */
  categories: ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#008300'],
  other: '#9AA4B2',
  /** Thu / chi sổ quỹ (cùng cặp màu đã kiểm như doanh thu / lợi nhuận). */
  receipt: '#0891A3',
  payment: '#D97706',
  /** Khung giờ: một màu nhạt → đậm theo doanh thu; ô không có đơn màu xám. */
  heat: ['#B4E1E9', '#86CCD8', '#52B2C3', '#2391A6', '#0B6F7C'],
  heatEmpty: '#EEF2F6',
} as const;

/** Thang trục tung "tròn số": 0 → mốc trên, chia `count` khoảng; có số âm thì kéo xuống dưới 0. */
export function niceScale(values: number[], count = 4): { min: number; max: number; ticks: number[] } {
  const hi = Math.max(0, ...values);
  const lo = Math.min(0, ...values);
  // Bước nhỏ nhất 1 đồng (toàn số 0 vẫn có trục hợp lệ).
  const raw = Math.max((hi - lo) / count, 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const min = Math.floor(lo / step) * step;
  const max = Math.max(Math.ceil(hi / step) * step, min + step);
  const ticks: number[] = [];
  for (let i = 0; min + i * step <= max + step / 2; i++) ticks.push(min + i * step);
  return { min, max, ticks };
}

export interface XY {
  x: number;
  y: number;
}

/**
 * Đường cong mượt qua các điểm (monotone, không vọt quá đỉnh/đáy thật:
 * doanh thu không bị vẽ âm giữa hai điểm dương).
 */
export function smoothPath(pts: XY[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  const n = pts.length;
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x || 1));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  const r = (v: number) => Math.round(v * 10) / 10;
  let path = `M${r(pts[0].x)},${r(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (pts[i + 1].x - pts[i].x) / 3;
    path += ` C${r(pts[i].x + dx)},${r(pts[i].y + m[i] * dx)} ${r(pts[i + 1].x - dx)},${r(pts[i + 1].y - m[i + 1] * dx)} ${r(pts[i + 1].x)},${r(pts[i + 1].y)}`;
  }
  return path;
}

/** Vùng tô dưới đường (khép xuống đường đáy `baseY`). */
export function areaPath(pts: XY[], baseY: number): string {
  if (pts.length < 2) return '';
  return `${smoothPath(pts)} L${pts[pts.length - 1].x},${baseY} L${pts[0].x},${baseY} Z`;
}

/** Điểm gần nhất theo trục hoành (chạm vào biểu đồ). */
export function nearestIndex(xs: number[], x: number): number {
  let best = 0;
  xs.forEach((v, i) => {
    if (Math.abs(v - x) < Math.abs(xs[best] - x)) best = i;
  });
  return best;
}

// ---------- Đổi dữ liệu cho từng khối ----------

export interface BarRow {
  key: string | number;
  title: string;
  sub?: string;
  value: string;
  /** Tỷ lệ so với dòng lớn nhất (0–1) để vẽ thanh. */
  share: number;
}

const shareOf = (v: number, max: number) => (max > 0 ? Math.max(0, Math.min(1, v / max)) : 0);

/** So sánh chi nhánh: tổng từng chi nhánh, lớn trước. Bỏ phần "— địa chỉ" trong tên cho gọn. */
export function branchBars(cmp: BranchComparison | undefined): BarRow[] {
  const list = [...(cmp?.branches ?? [])].sort((a, b) => b.total - a.total);
  const max = Math.max(0, ...list.map((b) => b.total));
  return list.map((b) => ({
    key: b.id,
    title: b.name.split('—')[0].trim() || b.name,
    value: compactMoney(b.total),
    share: shareOf(b.total, max),
  }));
}

export interface CategoryPart {
  name: string;
  revenue: number;
  percent: number;
  color: string;
}

/** Cơ cấu nhóm hàng: tối đa 6 nhóm lớn nhất, còn lại (và nhóm "Khác" của backend) gộp vào "Khác". */
export function categoryParts(slices: CategorySlice[] | undefined, max = 6): CategoryPart[] {
  const sorted = [...(slices ?? [])].filter((s) => s.revenue > 0).sort((a, b) => b.revenue - a.revenue);
  const named = sorted.filter((s) => s.name !== 'Khác');
  const head = named.slice(0, max);
  const rest = [...named.slice(max), ...sorted.filter((s) => s.name === 'Khác')];
  const total = sorted.reduce((sum, s) => sum + s.revenue, 0) || 1;
  const pct = (v: number) => Math.round((v / total) * 1000) / 10;
  const parts: CategoryPart[] = head.map((s, i) => ({ name: s.name, revenue: s.revenue, percent: pct(s.revenue), color: CHART.categories[i] }));
  if (rest.length > 0) {
    const revenue = rest.reduce((sum, s) => sum + s.revenue, 0);
    parts.push({ name: 'Khác', revenue, percent: pct(revenue), color: CHART.other });
  }
  return parts;
}

/** Giá trị xếp hạng của một mặt hàng theo tiêu chí đang chọn. */
export function topValue(p: TopProduct, metric: TopMetric): number {
  return metric === 'qty' ? p.totalQuantity : metric === 'profit' ? p.totalProfit : p.totalRevenue;
}

export function productRows(items: TopProduct[] | undefined, metric: TopMetric): BarRow[] {
  const list = items ?? [];
  const max = Math.max(0, ...list.map((p) => topValue(p, metric)));
  return list.map((p) => {
    const v = topValue(p, metric);
    return {
      key: p.productId,
      title: p.name,
      sub: metric === 'qty' ? `${p.code}, ${compactMoney(p.totalRevenue)}` : `${p.code}, đã bán ${qty(p.totalQuantity)}`,
      value: metric === 'qty' ? qty(v) : compactMoney(v),
      share: shareOf(v, max),
    };
  });
}

export function buyerRows(items: TopBuyer[] | undefined): BarRow[] {
  const list = items ?? [];
  const max = Math.max(0, ...list.map((b) => b.totalRevenue));
  return list.map((b) => ({
    key: b.id,
    title: b.name,
    sub: `${b.code}, ${money(b.invoiceCount)} hóa đơn`,
    value: compactMoney(b.totalRevenue),
    share: shareOf(b.totalRevenue, max),
  }));
}

export interface AgingRow {
  key: 'inTerm' | 'd1to30' | 'over30';
  label: string;
  value: number;
  share: number;
  /** Màu trạng thái (kèm nhãn chữ, không chỉ dựa vào màu). */
  tone: 'success' | 'warning' | 'danger';
}

/** Phân tuổi nợ: tỷ lệ theo tổng các nhóm (giống web). */
export function agingRows(f: FinanceData | undefined): AgingRow[] {
  const a = f?.aging ?? { inTerm: 0, d1to30: 0, over30: 0 };
  const sum = a.inTerm + a.d1to30 + a.over30;
  const share = (v: number) => (sum > 0 ? v / sum : 0);
  return [
    { key: 'inTerm', label: 'Trong hạn', value: a.inTerm, share: share(a.inTerm), tone: 'success' },
    { key: 'd1to30', label: 'Quá hạn 1–30 ngày', value: a.d1to30, share: share(a.d1to30), tone: 'warning' },
    { key: 'over30', label: 'Quá hạn trên 30 ngày', value: a.over30, share: share(a.over30), tone: 'danger' },
  ];
}

/** "Quá hạn 12,4 tr, 35%" của tổng phải thu. */
export function overdueNote(f: FinanceData | undefined): string {
  if (!f) return '';
  const sum = f.aging.inTerm + f.aging.d1to30 + f.aging.over30;
  const pct = sum > 0 ? Math.round((f.overdue / sum) * 100) : 0;
  return `Quá hạn ${compactMoney(f.overdue)}, ${pct}%`;
}

export function sellerRows(items: SellerRow[] | undefined): BarRow[] {
  const list = items ?? [];
  const max = Math.max(0, ...list.map((r) => r.revenue));
  return list.map((r, i) => ({
    key: r.id ?? `none-${i}`,
    title: r.name,
    sub: `${money(r.invoiceCount)} hóa đơn`,
    value: compactMoney(r.revenue),
    share: shareOf(r.revenue, max),
  }));
}

/** Kênh bán: dùng chung cách gộp của cơ cấu nhóm hàng (tối đa 6 kênh + "Khác"). */
export function channelParts(items: ChannelRow[] | undefined): CategoryPart[] {
  return categoryParts((items ?? []).map((c) => ({ name: c.name, revenue: c.revenue, percent: c.percent })));
}

export interface CashBar {
  label: string;
  receipt: number;
  payment: number;
}

export function cashBars(data: CashflowSummary | undefined): CashBar[] {
  return (data?.series ?? []).map((r) => ({ label: pointLabel(r.label), receipt: r.receipt, payment: r.payment }));
}

/** 5 nhóm chi lớn nhất, thanh theo nhóm lớn nhất. */
export function paymentRows(data: CashflowSummary | undefined): BarRow[] {
  const list = data?.topPayments ?? [];
  const max = Math.max(0, ...list.map((g) => g.amount));
  return list.map((g) => ({ key: g.name, title: g.name, value: compactMoney(g.amount), share: shareOf(g.amount, max) }));
}

/** Thứ hiển thị từ Thứ Hai → Chủ nhật (dow của Postgres: 0 = CN). */
export const HEAT_DAYS: { dow: number; label: string }[] = [
  { dow: 1, label: 'T2' },
  { dow: 2, label: 'T3' },
  { dow: 3, label: 'T4' },
  { dow: 4, label: 'T5' },
  { dow: 5, label: 'T6' },
  { dow: 6, label: 'T7' },
  { dow: 0, label: 'CN' },
];

export interface HeatGrid {
  /** Các giờ hiển thị (cột), liền nhau. */
  hours: number[];
  rows: { dow: number; label: string; cells: { revenue: number; count: number }[] }[];
  max: number;
  /** Ô doanh thu cao nhất; null khi không có đơn. */
  peak: { label: string; hour: number; revenue: number; count: number } | null;
}

/**
 * Lưới khung giờ: chỉ giữ các giờ có bán (từ giờ sớm nhất tới muộn nhất),
 * không có dữ liệu thì hiện 8h–20h.
 */
export function heatGrid(cells: HeatCell[] | undefined): HeatGrid {
  const list = (cells ?? []).filter((c) => c.revenue > 0 || c.count > 0);
  const lo = list.length ? Math.min(...list.map((c) => c.hour)) : 8;
  const hi = list.length ? Math.max(...list.map((c) => c.hour)) : 20;
  const hours = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const at = new Map(list.map((c) => [`${c.dow}:${c.hour}`, c]));
  let peak: HeatGrid['peak'] = null;
  const rows = HEAT_DAYS.map((d) => ({
    dow: d.dow,
    label: d.label,
    cells: hours.map((h) => {
      const c = at.get(`${d.dow}:${h}`);
      const cell = { revenue: c?.revenue ?? 0, count: c?.count ?? 0 };
      if (cell.revenue > 0 && (!peak || cell.revenue > peak.revenue)) peak = { label: d.label, hour: h, ...cell };
      return cell;
    }),
  }));
  return { hours, rows, max: Math.max(0, ...list.map((c) => c.revenue)), peak };
}

/** Màu ô theo doanh thu so với ô cao nhất (5 bậc, 0 = xám). */
export function heatColor(revenue: number, max: number): string {
  if (revenue <= 0 || max <= 0) return CHART.heatEmpty;
  const step = Math.min(CHART.heat.length - 1, Math.floor((revenue / max) * CHART.heat.length));
  return CHART.heat[step];
}

export function returnRows(data: ReturnsSummary | undefined): BarRow[] {
  const list = data?.topProducts ?? [];
  const max = Math.max(0, ...list.map((p) => p.amount));
  return list.map((p) => ({
    key: p.productId,
    title: p.name,
    sub: `${p.code}, trả ${qty(p.quantity)}`,
    value: compactMoney(p.amount),
    share: shareOf(p.amount, max),
  }));
}

// ---------- Việc cần xử lý ----------

export const TASKS: Record<TaskType, { title: string; short: string; icon: IconName; color: AccentName; empty: string }> = {
  orders: {
    title: 'Đơn đặt chờ xử lý',
    short: 'Đơn chờ xử lý',
    icon: 'clipboard-list',
    color: 'violet',
    empty: 'Không có đơn đặt nào đang chờ.',
  },
  debt: {
    title: 'Hóa đơn còn nợ',
    short: 'Hóa đơn còn nợ',
    icon: 'credit-card',
    color: 'red',
    empty: 'Không có hóa đơn nào còn nợ.',
  },
  cod: {
    title: 'Cần giao (COD)',
    short: 'Cần giao COD',
    icon: 'truck',
    color: 'orange',
    empty: 'Không có đơn COD nào cần giao.',
  },
  stock: {
    title: 'Tồn kho cảnh báo',
    short: 'Tồn cảnh báo',
    icon: 'triangle-alert',
    color: 'pink',
    empty: 'Không có mặt hàng nào cần cảnh báo.',
  },
};

export const TASK_ORDER: TaskType[] = ['orders', 'debt', 'cod', 'stock'];

const ORDER_STATUS: Record<string, string> = {
  pending: 'Phiếu tạm',
  confirmed: 'Đã xác nhận',
  partially_invoiced: 'Đã ra 1 phần hóa đơn',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

const DEBT_STATUS: Record<string, string> = {
  in_term: 'Trong hạn',
  due: 'Đến hạn',
  overdue: 'Quá hạn trên 30 ngày',
};

const STOCK_STATUS: Record<string, string> = {
  negative: 'Tồn âm',
  out: 'Hết hàng',
  low: 'Sắp hết',
};

/** Trạng thái hóa đơn 1–8 (giống `INVOICE_STATUS_LABELS` của web). */
const INVOICE_STATUS: Record<string, string> = {
  '1': 'Hoàn thành',
  '2': 'Đã hủy',
  '3': 'Đang xử lý',
  '4': 'Không giao được',
  '5': 'Đóng hàng',
  '6': 'Đang giao hàng',
  '7': 'Giao thành công',
  '8': 'Trả hàng',
};

export function taskStatusLabel(type: TaskType, status: string): string {
  if (type === 'orders') return ORDER_STATUS[status] ?? status;
  if (type === 'debt') return DEBT_STATUS[status] ?? status;
  if (type === 'stock') return STOCK_STATUS[status] ?? status;
  return INVOICE_STATUS[status] ?? '';
}

export function isValidTaskType(value: unknown): value is TaskType {
  return value === 'orders' || value === 'debt' || value === 'cod' || value === 'stock';
}

/** Chi nhánh truyền qua đường dẫn ("all" hoặc số) → bộ lọc; sai thì null. */
export function parseBranchParam(value: unknown): DashBranch | null {
  if (value === 'all') return 'all';
  const n = Number(value);
  return typeof value === 'string' && Number.isInteger(n) && n > 0 ? n : null;
}

// ---------- Đầu trang ----------

/** Lời chào theo giờ trong ngày. */
export function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 11) return 'Chào buổi sáng!';
  if (h < 14) return 'Chào buổi trưa!';
  if (h < 18) return 'Chào buổi chiều!';
  return 'Chào buổi tối!';
}

/** Tên gọi ngắn: lấy chữ cuối của họ tên ("Nguyễn Thị Lan" → "Lan"). */
export function shortName(name?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return words[words.length - 1] ?? '';
}
