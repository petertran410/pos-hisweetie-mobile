import { dayKey, dayLabel } from '@/core/format';
import type { DocRow } from './api';

export type ListItem = { type: 'day'; key: string; label: string } | { type: 'row'; key: string; row: DocRow };

/** Chèn tiêu đề ngày giữa các chứng từ (danh sách đã xếp mới nhất trước). */
export function groupByDay(rows: DocRow[], now = new Date()): ListItem[] {
  const out: ListItem[] = [];
  let last = '';
  for (const row of rows) {
    const k = dayKey(row.date) || 'unknown';
    if (k !== last) {
      out.push({ type: 'day', key: `d-${k}`, label: row.date ? dayLabel(row.date, now) : 'Không rõ ngày' });
      last = k;
    }
    out.push({ type: 'row', key: `r-${row.id}`, row });
  }
  return out;
}
