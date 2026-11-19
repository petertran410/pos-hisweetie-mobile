import { isoDate, periodRange, type PeriodKey } from './format';

/** Khoảng ngày tự chọn, dạng yyyy-mm-dd (giờ máy), tính cả hai đầu. */
export interface DateRange {
  from: string;
  to: string;
}

/** Bộ lọc thời gian: kỳ có sẵn, "toàn thời gian" hoặc khoảng ngày tự chọn. */
export type PeriodChoice = PeriodKey | 'all' | DateRange;

export const isRange = (v: unknown): v is DateRange =>
  typeof v === 'object' && v !== null && typeof (v as DateRange).from === 'string' && typeof (v as DateRange).to === 'string';

/** Khoảng ngày của bộ lọc; null = không lọc theo thời gian. */
export function resolvePeriod(p: PeriodChoice, now = new Date()): DateRange | null {
  if (p === 'all') return null;
  if (isRange(p)) return p;
  return periodRange(p, now);
}

/**
 * Các mốc có sẵn của bộ lọc thời gian trên web (`components/shared/TimeRangeFilter.tsx`),
 * cùng nhóm, cùng tên. Tuần bắt đầu thứ Hai.
 */
export type RangePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'last_7_days'
  | 'this_month'
  | 'last_month'
  | 'last_30_days'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year';

export const RANGE_PRESETS: { value: RangePreset; label: string; group: string }[] = [
  { value: 'today', label: 'Hôm nay', group: 'Theo ngày' },
  { value: 'yesterday', label: 'Hôm qua', group: 'Theo ngày' },
  { value: 'this_week', label: 'Tuần này', group: 'Theo tuần' },
  { value: 'last_week', label: 'Tuần trước', group: 'Theo tuần' },
  { value: 'last_7_days', label: '7 ngày qua', group: 'Theo tuần' },
  { value: 'this_month', label: 'Tháng này', group: 'Theo tháng' },
  { value: 'last_month', label: 'Tháng trước', group: 'Theo tháng' },
  { value: 'last_30_days', label: '30 ngày qua', group: 'Theo tháng' },
  { value: 'this_quarter', label: 'Quý này', group: 'Theo quý' },
  { value: 'last_quarter', label: 'Quý trước', group: 'Theo quý' },
  { value: 'this_year', label: 'Năm nay', group: 'Theo năm' },
  { value: 'last_year', label: 'Năm trước', group: 'Theo năm' },
];

/** Bộ lọc thời gian kiểu web: mốc có sẵn, "toàn thời gian" hoặc khoảng ngày tự chọn. */
export type RangeChoice = RangePreset | 'all' | DateRange;

/**
 * Khoảng ngày của 1 mốc, tính như web (`getDateRangeFromPreset`): "7 ngày qua" / "30 ngày qua"
 * tính từ 7 / 30 ngày trước đến hôm nay. Kỳ đang chạy kết thúc ở hôm nay.
 */
export function presetRange(p: RangePreset, now = new Date()): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const day = (yy: number, mm: number, dd: number) => isoDate(new Date(yy, mm, dd));
  const today = day(y, m, d);
  // Số ngày từ thứ Hai đầu tuần tới hôm nay.
  const sinceMonday = (now.getDay() + 6) % 7;
  const q = Math.floor(m / 3);
  switch (p) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday':
      return { from: day(y, m, d - 1), to: day(y, m, d - 1) };
    case 'this_week':
      return { from: day(y, m, d - sinceMonday), to: today };
    case 'last_week':
      return { from: day(y, m, d - sinceMonday - 7), to: day(y, m, d - sinceMonday - 1) };
    case 'last_7_days':
      return { from: day(y, m, d - 7), to: today };
    case 'this_month':
      return { from: day(y, m, 1), to: today };
    case 'last_month':
      return { from: day(y, m - 1, 1), to: day(y, m, 0) };
    case 'last_30_days':
      return { from: day(y, m, d - 30), to: today };
    case 'this_quarter':
      return { from: day(y, q * 3, 1), to: today };
    case 'last_quarter':
      return { from: day(y, q * 3 - 3, 1), to: day(y, q * 3, 0) };
    case 'this_year':
      return { from: day(y, 0, 1), to: today };
    case 'last_year':
      return { from: day(y - 1, 0, 1), to: day(y - 1, 11, 31) };
  }
}

/** Khoảng ngày của bộ lọc kiểu web; null = không lọc theo thời gian. */
export function resolveRange(c: RangeChoice, now = new Date()): DateRange | null {
  if (c === 'all') return null;
  if (isRange(c)) return c;
  return presetRange(c, now);
}

/** yyyy-mm-dd (giờ máy) → ISO đầu ngày / cuối ngày (giống web gửi). */
export function dayBoundsIso(from: string, to: string): { fromIso: string; toIso: string } {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return {
    fromIso: new Date(fy, fm - 1, fd, 0, 0, 0, 0).toISOString(),
    toIso: new Date(ty, tm - 1, td, 23, 59, 59, 999).toISOString(),
  };
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ddmmyyyy = (iso: string) => `${ddmm(iso)}/${iso.slice(0, 4)}`;

/** "05/10 – 12/10" (trong năm nay), "28/12/2025 – 03/01/2026", 1 ngày: "05/10/2026". */
export function rangeLabel(r: DateRange, now = new Date()): string {
  if (r.from === r.to) return ddmmyyyy(r.from);
  const year = String(now.getFullYear());
  if (r.from.startsWith(year) && r.to.startsWith(year)) return `${ddmm(r.from)} – ${ddmm(r.to)}`;
  return `${ddmmyyyy(r.from)} – ${ddmmyyyy(r.to)}`;
}

/** Ngày dạng dd/mm/yyyy cho ô "Từ ngày" / "Đến ngày". */
export const dayText = (iso: string | null) => (iso ? ddmmyyyy(iso) : '');

/** Đang chọn trên lịch: có thể mới có ngày đầu. */
export interface RangeDraft {
  from: string | null;
  to: string | null;
}

/**
 * Bấm một ngày trên lịch: chưa có ngày đầu (hoặc đã đủ hai đầu) → bắt đầu khoảng
 * mới; đã có ngày đầu → chốt ngày cuối, bấm ngày trước ngày đầu thì đổi chỗ.
 */
export function pickDay(cur: RangeDraft, day: string): RangeDraft {
  if (!cur.from || cur.to) return { from: day, to: null };
  return day < cur.from ? { from: day, to: cur.from } : { from: cur.from, to: day };
}

/** Lưới 1 tháng (tháng 0–11), tuần bắt đầu thứ Hai; ô ngoài tháng = null. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => isoDate(new Date(year, month, i + 1))),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
