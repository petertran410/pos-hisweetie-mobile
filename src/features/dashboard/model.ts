import type { TaskType } from './api';

export const RANGE_OPTIONS = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'yesterday', label: 'Hôm qua' },
  { value: 'week', label: 'Tuần này' },
  { value: 'month', label: 'Tháng này' },
] as const;

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
  { title: string; icon: 'shippingbox' | 'creditcard' | 'banknote' | 'exclamationmark.triangle'; empty: string }
> = {
  orders: { title: 'Đơn đặt chờ xử lý', icon: 'shippingbox', empty: 'Không có đơn đặt nào đang chờ.' },
  debt: { title: 'Hóa đơn còn nợ', icon: 'creditcard', empty: 'Không có hóa đơn nào còn nợ.' },
  cod: { title: 'Tiền thu hộ (COD)', icon: 'banknote', empty: 'Không có đơn COD nào chưa thu.' },
  stock: { title: 'Hàng sắp hết', icon: 'exclamationmark.triangle', empty: 'Không có mặt hàng nào sắp hết.' },
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
