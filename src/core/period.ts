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
