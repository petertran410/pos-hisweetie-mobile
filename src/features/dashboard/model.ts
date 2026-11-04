import { periodRange, type PeriodKey } from '@/core/format';
import { isRange, type DateRange } from '@/core/period';
import type { AccentName, IconName, Tone } from '@/ui';
import type { DashPreset, DashRange, TaskType } from './api';

export const RANGE_OPTIONS: { value: DashPreset; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'yesterday', label: 'Hôm qua' },
  { value: 'week', label: 'Tuần này' },
  { value: 'month', label: 'Tháng này' },
];

const PRESET_PERIOD: Record<DashPreset, PeriodKey> = { today: 'today', yesterday: 'yesterday', week: 'last7', month: 'thisMonth' };

/** Khoảng ngày của kỳ đang xem (để lịch chọn ngày mở sẵn đúng chỗ). */
export function dashRangeDates(range: DashRange, now = new Date()): DateRange {
  return isRange(range) ? range : periodRange(PRESET_PERIOD[range], now);
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

export const TASKS: Record<
  TaskType,
  { title: string; short: string; icon: IconName; color: AccentName; empty: string }
> = {
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
    title: 'Tiền thu hộ (COD)',
    short: 'COD chưa thu',
    icon: 'banknote',
    color: 'orange',
    empty: 'Không có đơn COD nào chưa thu.',
  },
  stock: {
    title: 'Hàng sắp hết',
    short: 'Hàng sắp hết',
    icon: 'triangle-alert',
    color: 'pink',
    empty: 'Không có mặt hàng nào sắp hết.',
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

export function taskStatusLabel(type: TaskType, status: string): string {
  if (type === 'orders') return ORDER_STATUS[status] ?? status;
  if (type === 'debt') return DEBT_STATUS[status] ?? status;
  if (type === 'stock') return STOCK_STATUS[status] ?? status;
  return '';
}

export function isValidTaskType(value: unknown): value is TaskType {
  return value === 'orders' || value === 'debt' || value === 'cod' || value === 'stock';
}

/** Màu nhãn thay đổi: tăng xanh, giảm đỏ, không đổi xám. */
export function deltaTone(pct: number | null | undefined): Tone {
  if (!pct || !Number.isFinite(pct)) return 'neutral';
  return pct > 0 ? 'success' : 'danger';
}

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

/** Chỉ hiện nhãn trục cách quãng để không chồng chữ. */
export function sparseLabels(labels: string[], max = 7): string[] {
  if (labels.length <= max) return labels;
  const step = Math.ceil(labels.length / max);
  return labels.map((l, i) => (i % step === 0 ? l : ''));
}
