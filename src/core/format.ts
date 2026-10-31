/** 1250000 → "1.250.000" (không phụ thuộc Intl). */
export function money(value: number | string | null | undefined): string {
  const n = Math.round(Number(value) || 0);
  const sign = n < 0 ? '-' : '';
  return sign + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 1250000 → "1.250.000 ₫". */
export function vnd(value: number | string | null | undefined): string {
  return `${money(value)} ₫`;
}

/** Số lượng: tối đa 2 chữ số thập phân, dấu phẩy thập phân. */
export function qty(value: number | string | null | undefined): string {
  const n = Number(value) || 0;
  const rounded = Math.round(n * 100) / 100;
  const [int, dec] = String(Math.abs(rounded)).split('.');
  const s = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? `,${dec}` : '');
  return rounded < 0 ? `-${s}` : s;
}

/** "1.250.000" / "1250000" → 1250000; rỗng → 0. */
export function parseMoney(text: string): number {
  const digits = text.replace(/[^\d-]/g, '');
  return digits ? Number(digits) : 0;
}

/** "2,5" → 2.5 (số lượng có thể lẻ khi quy đổi thùng). */
export function parseQty(text: string): number {
  const cleaned = text.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 31/10/2026 */
export function dateVN(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '';
}

/** 10:42 */
export function timeVN(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
}

/** 31/10/2026 10:42 */
export function dateTimeVN(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? `${dateVN(d)} ${timeVN(d)}` : '';
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** "Hôm nay, 31/10" / "Hôm qua, 30/10" / "Thứ Hai, 27/10" — tiêu đề nhóm theo ngày. */
export function dayLabel(value: string | number | Date | null | undefined, now = new Date()): string {
  const d = toDate(value);
  if (!d) return '';
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000);
  const short = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  if (diff === 0) return `Hôm nay, ${short}`;
  if (diff === 1) return `Hôm qua, ${short}`;
  const weekday = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][d.getDay()];
  return d.getFullYear() === now.getFullYear() ? `${weekday}, ${short}` : dateVN(d);
}

/** Thời điểm gọn: "19:42" (hôm nay), "Hôm qua 19:42", "28/10 19:42". */
export function shortWhen(value: string | number | Date | null | undefined, now = new Date()): string {
  const d = toDate(value);
  if (!d) return '';
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000);
  if (diff === 0) return timeVN(d);
  if (diff === 1) return `Hôm qua ${timeVN(d)}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${timeVN(d)}`;
}

/** Khoá nhóm theo ngày (yyyy-mm-dd theo giờ máy). */
export function dayKey(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
}

/** Ngày dạng yyyy-mm-dd để gửi API. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Chữ cái đầu cho avatar: "Quán Trà Mây" → "TM". */
export function initials(name?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const pick = words.length > 1 ? [words[words.length - 2], words[words.length - 1]] : [words[0]];
  return pick.map((w) => w[0]?.toUpperCase() ?? '').join('');
}

export type PeriodKey = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth';

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'yesterday', label: 'Hôm qua' },
  { key: 'last7', label: '7 ngày' },
  { key: 'thisMonth', label: 'Tháng này' },
  { key: 'lastMonth', label: 'Tháng trước' },
];

/** Khoảng ngày [from, to] (yyyy-mm-dd) cho các kỳ thường dùng. */
export function periodRange(key: PeriodKey, now = new Date()): { from: string; to: string } {
  const today = startOfDay(now);
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  switch (key) {
    case 'today':
      return { from: isoDate(today), to: isoDate(today) };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { from: isoDate(y), to: isoDate(y) };
    }
    case 'last7':
      return { from: isoDate(addDays(today, -6)), to: isoDate(today) };
    case 'thisMonth':
      return { from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: isoDate(today) };
    case 'lastMonth':
      return {
        from: isoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: isoDate(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
  }
}
